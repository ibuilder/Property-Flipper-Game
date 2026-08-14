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
  return {
    scenes: reached,
    missed,
    darkFailures: all.filter((f) => f.theme === 'dark').length,
    lightFailures: all.filter((f) => f.theme === 'light').length,
    unique,
  };
})();
