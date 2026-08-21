/**
 * Getting to each screen, once, for anything that needs to look at them.
 *
 * Two harnesses walk the same seven screens: the accessibility audit, which
 * measures contrast and target size, and the screenshot capture that produces
 * the store images. Reaching a screen is the expensive, fiddly part -- half of
 * what is below is a note about something that looked like it worked and did
 * not -- so it lives in one place and both load it.
 *
 * Evaluated in the renderer by the main process, before whichever harness needs
 * it. It defines `window.__PF_SCENES` and returns nothing useful.
 *
 * Each scene reports whether it actually arrived. A screen that cannot be
 * reached is reported rather than skipped: a harness that silently shrinks its
 * own sample is worse than one that fails.
 */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = () => sleep(500);

  /*
   * One game, every run.
   *
   * `startGame` seeds itself from `Math.random()` when the menu button is
   * clicked, so both harnesses were walking a different town each time. That
   * made the audit flaky in the way that matters least and costs most -- one
   * run in several could not afford the house the `owned` scene needs, and
   * reported a screen it could not reach rather than a problem -- and it made
   * every screenshot run rewrite all seven PNGs with a different address.
   *
   * Pinning `Math.random` rather than the seed is what keeps this to the
   * harness: nothing in the app has to grow a test hook, and everything
   * downstream of the seed is pinned too.
   */
  const SEED = 20250820;
  let t = SEED >>> 0;
  Math.random = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

// ---- navigation helpers -------------------------------------------------

const byText = (sel, text) =>
  [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text));

const click = (el) => {
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
};

const openTab = (label) => click(byText('.tab, button', label));
const closeModal = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

// ---- scenes -------------------------------------------------------------
//
// Each returns whether it reached the screen. A scene that cannot be reached
// is reported rather than skipped quietly: an audit that silently shrinks
// its own sample is worse than one that fails.

const scenes = [
  { name: 'menu', reach: async () => true },
  {
    name: 'market',
    reach: async () => {
      const ok = click(byText('button', 'The First Flip'));
      await settle();
      // The line style explicitly, not by default: the choice persists to
      // localStorage and the `board` scene later switches it, so a second run
      // would otherwise open on the first run's preference.
      const line = [...document.querySelectorAll('button')].find(
        (b) => b.textContent.trim() === 'line',
      );
      if (line) {
        click(line);
        await settle();
      }
      return ok && !!document.querySelector('tbody tr');
    },
  },
  {
    name: 'deal',
    reach: async () => {
      const row = document.querySelector('tbody tr');
      click(row);
      await settle();
      return !!document.querySelector('.modal');
    },
  },
  {
    name: 'owned',
    reach: async () => {
      // Buy it, so the portfolio and its panels have something in them.
      // The offer button is a ConfirmButton: it opens a second dialog rather
      // than committing, which is why this scene was unreachable at first.
      /*
       * Pay over the odds first.
       *
       * The offer box is seeded with the more conservative of the two
       * maximum offers, which is usually *below* the seller's hidden
       * reserve -- so submitting it is refused and the scene never gets a
       * property. The audit is not testing whether the bot can underwrite;
       * it needs an owned house to look at, so it overpays deliberately.
       *
       * React owns the input's value, so setting `.value` directly is
       * ignored. The native setter plus a bubbled input event is what makes
       * React see the change.
       */
      const box = document.querySelector('.modal input[type="number"]');
      if (!box) return false;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      ).set;

      /*
       * Bid up until it is taken, rather than overpaying by a fixed multiple.
       *
       * The box is seeded with the more conservative of the two maximum
       * offers, which is usually *below* the seller's hidden reserve, so
       * submitting it as-is is refused and the scene never gets a property.
       * The first fix here multiplied it by 2.2, which bought the house and
       * paid $56,791 for one asking $37,110 -- an offer no player would make
       * and a track record that read "lost money" for the rest of the walk.
       *
       * Raising in steps is what a buyer would actually do and lands near the
       * reserve rather than far above it. Capped by the opening bank balance
       * less the 2% buy-side closing, because an offer above the cash on hand
       * is refused as flatly as one below the reserve.
       */
      const seeded = Number(box.value || 0) || 30_000;
      let bought = false;
      for (const step of [1, 1.08, 1.16, 1.25, 1.35, 1.5, 1.7]) {
        const offer = Math.min(Math.round(seeded * step), 170_000);
        setter.call(box, String(offer));
        box.dispatchEvent(new Event('input', { bubbles: true }));
        await settle();

        click(byText('.modal button', 'Submit offer'));
        await settle();
        /*
         * Confirm in the *topmost* dialog.
         *
         * The offer button is a ConfirmButton, so it opens a second modal
         * rather than committing. Searching `.modal .btn.primary` across the
         * document matched the outer modal's own trigger first and simply
         * re-clicked it, which is why this scene sat unreachable while looking
         * like it was doing something.
         */
        const dialogs = document.querySelectorAll('.modal');
        const top = dialogs[dialogs.length - 1];
        if (top && dialogs.length > 1) {
          click(top.querySelector('.btn.primary'));
          await settle();
        }
        // A taken offer closes the listing modal and puts a row in Portfolio.
        if (!document.querySelector('.modal input[type="number"]')) {
          bought = true;
          break;
        }
      }
      if (!bought) return false;

      closeModal();
      await settle();
      openTab('Portfolio');
      await settle();
      return !!document.querySelector('tbody tr');
    },
  },
  {
    name: 'renovation',
    reach: async () => {
      // Back into the house just bought, and put a crew on it. The scope
      // builder is the screen where the game stops being a spreadsheet and
      // starts being a decision, and nothing else reaches it.
      openTab('Portfolio');
      await settle();
      click(byText('tbody tr button', 'Manage') || document.querySelector('tbody tr'));
      await settle();
      // A named template rather than ticking line items one at a time: it is
      // one click, and it is what a player would actually do.
      click(byText('.modal button', 'Cosmetic refresh'));
      await settle();
      click(byText('.modal button', 'Start work'));
      await settle();
      // `Start work` is a ConfirmButton, same as the offer.
      const dialogs = document.querySelectorAll('.modal');
      const top = dialogs[dialogs.length - 1];
      if (top && dialogs.length > 1) {
        click(top.querySelector('.btn.primary'));
        await settle();
      }
      return !!byText('.modal h2', 'Work in progress');
    },
  },
  {
    name: 'board',
    reach: async () => {
      /*
       * The town in colour, with a job running.
       *
       * The board opens in the line style -- a survey plat, which is the right
       * default over a colour data ramp and the wrong one for the first
       * picture anybody sees of this. Both sets are complete, so both get
       * photographed: `market` is the line town, this is the coloured one, and
       * because the renovation scene ran first Scout is standing on the lot he
       * is working.
       *
       * The style persists to localStorage, so it is set by clicking rather
       * than assumed -- otherwise the second run of the harness would find the
       * first run's choice already made.
       */
      closeModal();
      await settle();
      openTab('Market');
      await settle();
      const pick = (label) =>
        click([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label));
      if (!pick('colour')) return false;
      await settle();
      // And in closer than the whole town. At `town` a lot is about twenty
      // pixels across, which is the right zoom for reading a price ramp and
      // far too small to see that there is a house drawn on it at all.
      pick('block');
      await settle();
      return !!document.querySelector('.board-frame svg');
    },
  },
  {
    name: 'sale',
    reach: async () => {
      /*
       * Finish the flip, so the second half of the game is covered too.
       *
       * The walk used to stop on the day the house was bought, which left the
       * ledger, the trends and the whole track record empty -- three screens
       * audited with nothing in them, and the one screen that carries the
       * argument that this game teaches something never seen at all.
       *
       * It also ends on the deal card, which is what the game shows the moment
       * a flip closes. That is the payoff, and a payoff nothing walks through
       * is a payoff nobody notices is broken.
       */
      const advance = () =>
        click(
          [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '+30d'),
        );
      const manage = async () => {
        openTab('Portfolio');
        await settle();
        return click(byText('tbody tr button', 'Manage') || document.querySelector('tbody tr'));
      };

      // Wait out the crew.
      closeModal();
      await settle();
      for (let i = 0; i < 4; i++) {
        advance();
        await settle();
        closeModal();
        await settle();
        await manage();
        if (byText('.modal button', 'List at')) break;
        closeModal();
        await settle();
      }
      if (!click(byText('.modal button', 'List at'))) return false;
      await settle();
      let dialogs = document.querySelectorAll('.modal');
      if (dialogs.length > 1) {
        click(dialogs[dialogs.length - 1].querySelector('.btn.primary'));
        await settle();
      }

      /*
       * Then cut the price until somebody bites. The suggested list price sits
       * above what buyers will actually pay, deliberately -- learning that is
       * half the game -- so a walk that lists once and waits sits on the market
       * for four hundred days and never closes.
       */
      for (let i = 0; i < 6; i++) {
        closeModal();
        await settle();
        advance();
        await settle();
        closeModal();
        await settle();
        if (!(await manage())) return false;
        if (byText('.modal button', 'Accept')) {
          click(byText('.modal button', 'Accept'));
          await settle();
          dialogs = document.querySelectorAll('.modal');
          if (dialogs.length > 1) {
            click(dialogs[dialogs.length - 1].querySelector('.btn.primary'));
            await settle();
          }
          break;
        }
        click(byText('.modal button', 'Cut 4%'));
        await settle();
      }

      await settle();
      // The card raises itself the moment the flip closes.
      return !!byText('.modal', 'Sold —');
    },
  },
  {
    name: 'finance',
    reach: async () => {
      openTab('Finance');
      await settle();
      return true;
    },
  },
  {
    name: 'skills',
    reach: async () => {
      openTab('Skills');
      await settle();
      return !!document.querySelector('.mastery-grid');
    },
  },
  {
    name: 'track-record',
    reach: async () => {
      openTab('Track record');
      await settle();
      return true;
    },
  },
];
/* ---- clips ---------------------------------------------------------------
 *
 * Short animations for social, which is the one thing on the marketing plan
 * that needs the game to be *moving* rather than photographed. Each clip says
 * how to reach its starting state and then supplies a list of steps; the main
 * process captures one frame after every step, so a clip is however many steps
 * long it declares.
 *
 * One mechanism covers both kinds of clip. Where the motion is a tween the
 * steps are just short waits, and the capture rate becomes the frame rate.
 * Where the motion is the player doing something -- typing an offer, changing
 * zoom -- each step is the action and the frames land on the states that
 * matter. Nothing here needs to know which kind it is.
 */

const nativeValue = (el, v) => {
  // React installs its own value setter; assigning `.value` directly is
  // swallowed and the component never re-renders.
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const clips = [
  {
    /*
     * An offer walked up past the ceiling.
     *
     * Green with headroom, then over, then well over, with the figure and the
     * sentence changing underneath. Four seconds, and it is the argument the
     * whole game makes: there is a number above which this stops being a deal,
     * and it is not the asking price.
     *
     * The meter's amber state -- over the itemised maximum, under the rule of
     * thumb -- is deliberately not filmed, because it cannot be reached.
     * Measured across 1,260 listings in all four campaigns, on cash and on
     * hard money, the rule of thumb is *never* the generous one: the itemised
     * ceiling sits about 5.8% of ARV above it. Financing moves it by under 3%,
     * which is not enough to cross. See the roadmap.
     */
    name: 'offer-meter',
    reach: async () => {
      click(byText('button', 'The First Flip'));
      await settle();
      click(document.querySelector('tbody tr'));
      await settle();
      return !!document.querySelector('.offer-meter');
    },
    steps: (() => {
      const box = () => document.querySelector('.modal input[type="number"]');
      const out = [];
      out.push(async () => {
        window.__clipBase = Number(box().value || 30000);
        nativeValue(box(), String(Math.round(window.__clipBase * 0.62)));
        await sleep(320);
      });
      // Up in even steps, from comfortably inside to comfortably outside.
      for (let i = 1; i <= 15; i++) {
        out.push(async () => {
          nativeValue(box(), String(Math.round(window.__clipBase * (0.62 + i * 0.042))));
          await sleep(140);
        });
      }
      // Hold on the last frame so a preview that freezes shows the point.
      for (let i = 0; i < 6; i++) out.push(async () => sleep(140));
      return out;
    })(),
  },
  {
    /*
     * The board, zoomed. Three stops, each held, then back out -- the clip
     * that reads as a game rather than a spreadsheet.
     */
    name: 'board-zoom',
    reach: async () => {
      closeModal();
      await settle();
      openTab('Market');
      await settle();
      const pick = (label) =>
        click([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label));
      pick('colour');
      await settle();
      pick('town');
      await settle();
      return !!document.querySelector('.board-frame svg');
    },
    steps: (() => {
      const pick = (label) =>
        click([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label));
      const hold = (n, fn) => {
        const out = [fn];
        for (let i = 1; i < n; i++) out.push(async () => sleep(110));
        return out;
      };
      return [
        ...hold(5, async () => sleep(110)),
        ...hold(6, async () => { pick('block'); await sleep(240); }),
        ...hold(7, async () => { pick('lot'); await sleep(240); }),
        ...hold(6, async () => { pick('town'); await sleep(240); }),
      ];
    })(),
  },
];

  window.__PF_SCENES = { scenes, clips, settle, sleep, byText, click, openTab, closeModal };
})();
