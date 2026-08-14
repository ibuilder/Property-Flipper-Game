/**
 * Contrast audit, run inside the real renderer.
 *
 * This exists because `tests/theme.test.ts` is necessary and not sufficient.
 * That test checks a *token* against a *ground*. It cannot know what a token
 * will actually be drawn on top of, and in this interface text lands on at
 * least four different grounds: the page, the modal surface, an opaque
 * selected-row tint, and semi-transparent accent plates. Every contrast bug
 * found so far lived in that gap -- a label reading 4.66:1 against the
 * background and 3.88:1 where it was really painted.
 *
 * It cannot be a unit test. It needs a real cascade and real compositing, so
 * jsdom will not do. It runs in Electron rather than under Playwright because
 * Electron is already a dependency, already launched by CI on all three
 * platforms, and needs no browser download.
 *
 * Evaluated as a single expression by `executeJavaScript`, so it is written as
 * one IIFE and returns a plain object.
 */
(() => {
  const AA_NORMAL = 4.5;
  const AA_LARGE = 3.0;
  /** Below this, WCAG's large-text allowance does not apply. */
  const LARGE_PX = 18;
  const LARGE_BOLD_PX = 14;

  const parse = (css) => {
    const n = css.match(/[\d.]+/g);
    if (!n) return [0, 0, 0, 1];
    // `color(srgb r g b / a)` gives 0-1 channels; rgb()/rgba() give 0-255.
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
   * What is actually behind this element.
   *
   * Walks up collecting every layer that paints something, stopping at the
   * first opaque one, then composites them back down. Taking the first
   * non-transparent background instead -- which is the obvious shortcut --
   * reports a 7%-alpha tint as though it were the ground and under-reports
   * badly.
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

  const audit = (theme) => {
    const failures = [];
    for (const el of document.querySelectorAll('body *')) {
      if (SKIP.has(el.tagName)) continue;
      // Only elements holding their own text: otherwise a wrapper is blamed
      // for the colour of a child that sets its own.
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
          theme,
          selector: (el.className && String(el.className).trim().split(/\s+/).slice(0, 3).join('.')) || el.tagName.toLowerCase(),
          text: el.textContent.trim().slice(0, 32),
          size,
          ratio: Math.round(ratio * 100) / 100,
          bar,
        });
      }
    }
    return failures;
  };

  const root = document.documentElement;
  const restore = root.getAttribute('data-theme');

  /*
   * Freeze transitions before switching themes.
   *
   * Without this the audit measures its own animation. Buttons carry a 120ms
   * background transition, so reading computed styles straight after flipping
   * the theme returns an interpolated colour that is still most of the way to
   * the *previous* theme's value -- which reported the primary button at
   * 1.78:1 in light when it is actually fine. The give-away was the same
   * selector reporting two different ratios in one run.
   */
  const freeze = document.createElement('style');
  freeze.textContent =
    '*,*::before,*::after{transition:none!important;animation:none!important}';
  document.head.appendChild(freeze);

  root.removeAttribute('data-theme');
  const dark = audit('dark');
  root.setAttribute('data-theme', 'light');
  const light = audit('light');

  freeze.remove();

  if (restore === null) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', restore);

  // Deduplicate: one bad rule usually paints twenty cells, and twenty
  // identical lines hide the other nine problems.
  const seen = new Map();
  for (const f of [...dark, ...light]) {
    const key = `${f.theme}|${f.selector}|${f.size}|${f.ratio}`;
    const at = seen.get(key);
    if (at) at.count++;
    else seen.set(key, { ...f, count: 1 });
  }

  const unique = [...seen.values()].sort((a, b) => a.ratio - b.ratio);
  return {
    checked: document.querySelectorAll('body *').length,
    darkFailures: dark.length,
    lightFailures: light.length,
    unique,
  };
})();
