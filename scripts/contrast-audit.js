/**
 * Contrast audit, run inside the real renderer, across several screens.
 *
 * This exists because `tests/theme.test.ts` is necessary and not sufficient.
 * That test checks a *token* against a *ground*. It cannot know what a token
 * will actually be drawn on top of, and in this interface text lands on at
 * least four grounds: the page, the modal surface, an opaque selected-row
 * tint, and semi-transparent accent plates. Every contrast bug found so far
 * lived in that gap -- a label reading 4.66:1 against the background and
 * 3.88:1 where it was really painted.
 *
 * It cannot be a unit test. It needs a real cascade and real compositing, so
 * jsdom will not do. It runs in Electron rather than under Playwright because
 * Electron is already a dependency, already launched by CI on all three
 * platforms, and needs no browser download.
 *
 * It walks scenes rather than auditing one screen. That is not thoroughness
 * for its own sake: it previously saw only the opening market table, and
 * shipped a bug on the *quiet* variant of a component because the seeded
 * market happened to render only the loud one. What the audit cannot reach,
 * it cannot defend, so the scene list is the real measure of its coverage --
 * and the report names any scene it failed to reach rather than passing
 * silently on a smaller sample.
 *
 * Returns a promise; Electron's executeJavaScript resolves it.
 */
(async () => {
  const AA_NORMAL = 4.5;
  const AA_LARGE = 3.0;
  const LARGE_PX = 18;
  const LARGE_BOLD_PX = 14;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /**
   * React commits asynchronously; give it a frame plus a generous margin.
   *
   * 260ms was enough for the production build and not for a debug one, which
   * would have made this flaky in exactly the way that teaches people to
   * re-run CI rather than read it.
   */
  const settle = () => sleep(500);

  const parse = (css) => {
    const n = css.match(/[\d.]+/g);
    if (!n) return [0, 0, 0, 1];
    return css.startsWith('color(')
      ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] === undefined ? 1 : +n[3]]
      : [+n[0], +n[1], +n[2], n[3] === undefined ? 1 : +n[3]];
  };

  const luminance = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  /**
   * What is actually behind this element: every layer that paints something,
   * composited back down. Taking the first non-transparent background instead
   * reports a 7%-alpha tint as though it were the ground and under-reports.
   */
  const groundOf = (el) => {
    const layers = [];
    let n = el;
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) break;
      n = n.parentElement;
    }
    let out = layers.length ? layers[layers.length - 1].slice(0, 3) : [255, 255, 255];
    for (let i = layers.length - 2; i >= 0; i--) {
      const [r, g, b, a] = layers[i];
      out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
    }
    return out;
  };

  const SKIP = new Set(['SCRIPT', 'STYLE', 'TITLE', 'HEAD', 'META', 'LINK', 'NOSCRIPT']);

  const auditOnce = (theme, scene) => {
    const failures = [];
    for (const el of document.querySelectorAll('body *')) {
      if (SKIP.has(el.tagName)) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;

      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      if (!el.offsetParent && cs.position !== 'fixed') continue;

      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = size >= LARGE_PX || (size >= LARGE_BOLD_PX && weight >= 700);
      const bar = large ? AA_LARGE : AA_NORMAL;

      const ratio = contrast(parse(cs.color), groundOf(el));
      if (ratio + 0.005 < bar) {
        failures.push({
          scene,
          theme,
          selector:
            (el.className && String(el.className).trim().split(/\s+/).slice(0, 3).join('.')) ||
            el.tagName.toLowerCase(),
          text: el.textContent.trim().slice(0, 32),
          size,
          ratio: Math.round(ratio * 100) / 100,
          bar,
        });
      }
    }
    return failures;
  };

  /**
   * WCAG 2.2 SC 2.5.8, Target Size (Minimum), Level AA.
   *
   * A pointer target must be at least 24 by 24 CSS pixels, *unless* it is
   * clear of every other target by 24 pixels -- the spacing exception, which is
   * what lets a tight row of small controls pass when it is genuinely alone on
   * the screen. Both halves are checked here, because checking only the size
   * fails a lot of perfectly usable interfaces and checking only the spacing
   * fails none of the ones that matter.
   *
   * Theme has no bearing on geometry, so this runs once per scene rather than
   * twice. It rides along with the contrast walk because the expensive part is
   * reaching the seven screens, and that work is already done.
   */
  const targetFailures = (scene) => {
    const SELECTOR = 'button,a[href],input,select,textarea,[role="button"],[tabindex="0"]';
    const boxes = [];
    for (const el of document.querySelectorAll(SELECTOR)) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      if (el.disabled) continue;
      /*
       * Measure what actually receives the interaction, not the element that
       * happens to look like a control.
       *
       * Two cases, both of which reported false failures here. A checkbox
       * inside a `<label>` is hit by clicking anywhere on the label, which in
       * the scope builder is a full-width row rather than a 13px box. And an
       * input that is `readonly` and `tabindex="-1"` is not a target at all --
       * the comp picker draws one inside each `<tr role="button">` purely as an
       * indicator, and the row is the thing you click.
       *
       * Anything that resolves to an ancestor is deduplicated below, so a row
       * with three such marks in it is still one target.
       */
      const inert =
        el.readOnly || el.getAttribute('tabindex') === '-1' || el.getAttribute('aria-hidden') === 'true';
      let hit = el;
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
        const wrapping = el.closest('label');
        const associated = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
        hit = wrapping || associated || el;
      }
      if (inert) {
        const owner = el.closest('button,a[href],[role="button"],[tabindex="0"],label');
        if (owner) hit = owner;
        else continue; // inert and owned by nothing: not a target
      }
      const b = hit.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) continue;
      if (boxes.some((x) => x.el === hit)) continue; // one label, one target
      boxes.push({ el: hit, b });
    }

    // Closest edge-to-edge distance; 0 when they touch or overlap.
    const offset = (a, b) => {
      const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
      const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
      return Math.hypot(dx, dy);
    };

    const out = [];
    for (const x of boxes) {
      if (x.b.width >= 24 && x.b.height >= 24) continue;
      const crowded = boxes.some((y) => y !== x && offset(x.b, y.b) < 24);
      if (!crowded) continue; // spacing exception carries it

      /*
       * A lot on the board is exempt, on two of the criterion's own grounds.
       *
       * Essential: the lot is drawn at its true size and position under the
       * projection. Enlarging one to 24px would put it somewhere it is not,
       * which is the information the map exists to convey.
       *
       * Equivalent control: every property reachable on the board is also a row
       * in the market table, the row is full height, and both set the same
       * selection -- so the same function is available at a conforming size.
       *
       * The player can also zoom the board, which enlarges the targets. Written
       * out rather than filtered quietly, because an exemption nobody can see
       * is indistinguishable from a bug nobody caught.
       */
      if (x.el.tagName === 'g' && x.el.closest('.board-frame')) continue;
      out.push({
        scene,
        selector:
          (x.el.className && String(x.el.className).trim().split(/\s+/).slice(0, 2).join('.')) ||
          x.el.tagName.toLowerCase(),
        text: (x.el.textContent || x.el.getAttribute('aria-label') || '').trim().slice(0, 24),
        w: Math.round(x.b.width),
        h: Math.round(x.b.height),
      });
    }
    return out;
  };

  /**
   * Both themes for whatever is on screen now.
   *
   * Transitions are frozen first. Without that the audit measures its own
   * animation: buttons carry a 120ms background transition, so reading
   * computed styles straight after a theme flip returns a colour still most of
   * the way to the previous theme. It once reported the primary button at
   * 1.78:1 when nothing was wrong with it, and the give-away was one selector
   * reporting two different ratios in a single run.
   */
  const auditScene = async (scene) => {
    const root = document.documentElement;
    const freeze = document.createElement('style');
    freeze.textContent =
      '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(freeze);

    root.removeAttribute('data-theme');
    await sleep(30);
    const dark = auditOnce('dark', scene);
    root.setAttribute('data-theme', 'light');
    await sleep(30);
    const light = auditOnce('light', scene);
    root.removeAttribute('data-theme');
    freeze.remove();
    return [...dark, ...light];
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
          setter.call(box, String(Math.round(Number(box.value || 0) * 2.2) || 400000));
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

  const all = [];
  const reached = [];
  const missed = [];

  const targets = [];
  for (const scene of scenes) {
    let ok = false;
    try {
      ok = await scene.reach();
    } catch {
      ok = false;
    }
    if (!ok) {
      missed.push(scene.name);
      continue;
    }
    reached.push(scene.name);
    all.push(...(await auditScene(scene.name)));
    targets.push(...targetFailures(scene.name));
  }

  // One bad rule usually paints twenty cells, and twenty identical lines hide
  // the other problems.
  const seen = new Map();
  for (const f of all) {
    const key = `${f.scene}|${f.theme}|${f.selector}|${f.size}|${f.ratio}`;
    const at = seen.get(key);
    if (at) at.count++;
    else seen.set(key, { ...f, count: 1 });
  }

  const unique = [...seen.values()].sort((a, b) => a.ratio - b.ratio);

  // Same collapsing for targets: one undersized rule is one finding, not one
  // per row of a table.
  const tseen = new Map();
  for (const t of targets) {
    const key = `${t.scene}|${t.selector}|${t.w}x${t.h}`;
    const at = tseen.get(key);
    if (at) at.count++;
    else tseen.set(key, { ...t, count: 1 });
  }

  return {
    scenes: reached,
    missed,
    darkFailures: all.filter((f) => f.theme === 'dark').length,
    lightFailures: all.filter((f) => f.theme === 'light').length,
    unique,
    targetFailures: targets.length,
    targets: [...tseen.values()].sort((a, b) => a.w * a.h - b.w * b.h),
  };
})();
