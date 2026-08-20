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
      if (box) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        ).set;
        /*
         * Capped, because an offer above the bank balance is refused just as
         * flatly as one below the reserve. First Flip opens with $175,000 and
         * buy-side closing takes 2% on top, so this leaves room for both.
         */
        const over = Math.round(Number(box.value || 0) * 2.2) || 160_000;
        setter.call(box, String(Math.min(over, 160_000)));
        box.dispatchEvent(new Event('input', { bubbles: true }));
        await settle();
      }

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
  window.__PF_SCENES = { scenes, settle, sleep, byText, click, openTab, closeModal };
})();
