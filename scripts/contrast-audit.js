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
  const CONTROL_SELECTOR =
    'button,a[href],input,select,textarea,[role="button"],[tabindex="0"]';

  /**
   * Every control on screen, measured at the box that actually receives the
   * click. Shared by the size check and the collision check below.
   */
  const controlBoxes = () => {
    const boxes = [];
    for (const el of document.querySelectorAll(CONTROL_SELECTOR)) {
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
    return boxes;
  };

  // Closest edge-to-edge distance; 0 when they touch or overlap.
  const offset = (a, b) => {
    const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
    const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
    return Math.hypot(dx, dy);
  };

  // `el.className` is an SVGAnimatedString on SVG elements, which stringifies
  // to "[object SVGAnimatedString]" and names nothing. The attribute is a
  // string on both.
  const name = (el) => {
    const cls = (el.getAttribute('class') || '').trim();
    return cls ? cls.split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase();
  };

  const label = (el) =>
    (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24);

  const targetFailures = (scene) => {
    const boxes = controlBoxes();
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
        selector: name(x.el),
        text: label(x.el),
        w: Math.round(x.b.width),
        h: Math.round(x.b.height),
      });
    }
    return out;
  };

  /**
   * Content above the top of its own scroll container.
   *
   * A scroll container that also centres on the scrolling axis puts half its
   * overflow at a negative offset, and `scrollTop` cannot go below zero, so
   * that half is not reachable by any means the player has. The main menu did
   * this: `display: flex` with `align-items: center` and `overflow-y: auto`, so
   * on an 800px-tall window -- the size the store page specifies -- the first
   * 180px of the menu, the game's title included, was above the top of the
   * screen with the scrollbar already at the top.
   *
   * Measured against where scrolling can actually reach rather than against
   * what is on screen now, so it holds wherever the container happens to be
   * scrolled to when the audit arrives.
   */
  const unreachable = (scene) => {
    const found = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') continue;
      if (el.clientHeight <= 0) continue;
      const top = el.getBoundingClientRect().top + parseFloat(cs.borderTopWidth || '0');
      const floor = minScrollTop(el);
      for (const kid of el.children) {
        const kcs = getComputedStyle(kid);
        if (kcs.position === 'absolute' || kcs.position === 'fixed') continue;
        if (kcs.display === 'none') continue;
        // How far above the fully-scrolled-up position this child begins.
        const above = top - (el.scrollTop - floor) - kid.getBoundingClientRect().top;
        if (above <= 1) continue;
        found.push({ scene, selector: name(el), child: name(kid), above: Math.round(above) });
      }
    }
    return found;
  };

  /**
   * How far up a container can actually be scrolled.
   *
   * Not always zero, and assuming it was reported the activity rail as broken
   * across four screens. A `flex-direction: column-reverse` list -- the standard
   * way to pin a log to the bottom -- puts its scroll origin at the far end, so
   * `scrollTop` runs from `clientHeight - scrollHeight` up to `0` and the
   * oldest entry is reached by scrolling *negative*. Measured by asking the
   * element rather than derived from its style, because the same is true of
   * `wrap-reverse`, of right-to-left writing modes, and of whatever the next
   * one turns out to be.
   */
  const minScrollTop = (el) => {
    const held = el.scrollTop;
    el.scrollTop = -1e7;
    const floor = el.scrollTop;
    el.scrollTop = held;
    return floor;
  };

  /**
   * A box given a fixed height, holding content that does not fit in it.
   *
   * `.topbar` was `height: 60px` around a button row with `flex-wrap: wrap`,
   * which is a contradiction the browser resolves by drawing outside the box:
   * at 1280 the seventh control wrapped to a second line and that line was
   * painted through the tab strip below. A declared height and wrappable
   * content are only compatible while the content happens to fit, and nothing
   * says when it stops.
   *
   * Only `visible` overflow counts. A fixed height over `hidden`, `auto` or
   * `clip` is a decision about what to do with the excess; over `visible` it is
   * an accident waiting for a longer word.
   *
   * Geometry, so once per scene.
   */
  const spills = (scene) => {
    const found = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.overflowY !== 'visible' || el.clientHeight <= 0) continue;
      if (el.scrollHeight - el.clientHeight <= 2) continue;

      /*
       * Only laid-out children count.
       *
       * `getComputedStyle().height` reports the *used* height, so it reads as a
       * pixel value whether the author wrote one or the content produced it --
       * there is no way to ask "was this height declared?". Asking who is
       * sticking out answers the same question better. Every blueprint panel
       * has corner marks positioned 6px outside it on purpose; the top bar had
       * a flex row in normal flow that no longer fit. Absolute and fixed
       * children were placed where they are deliberately, so the ones still in
       * flow are the finding.
       */
      const rect = el.getBoundingClientRect();
      const limit = rect.top + parseFloat(cs.borderTopWidth || '0') + el.clientHeight;
      let worst = 0;
      for (const kid of el.children) {
        const kcs = getComputedStyle(kid);
        if (kcs.position === 'absolute' || kcs.position === 'fixed') continue;
        if (kcs.display === 'none') continue;
        worst = Math.max(worst, kid.getBoundingClientRect().bottom - limit);
      }
      // Sub-pixel rounding and the odd descender are not this.
      if (worst <= 2) continue;
      found.push({ scene, selector: name(el), height: el.clientHeight, over: Math.round(worst) });
    }
    return found;
  };

  /**
   * Two live controls drawn on top of each other.
   *
   * The top bar was a fixed 60px tall with a wrapping row of buttons in it. At
   * 1280 -- the width the store page tells people to play at -- `Menu` wrapped
   * to a second line and was painted straight through the `Track record` tab
   * below it. Both were clickable, one was on top, and nothing in the audit
   * noticed because each was individually large enough and legible enough.
   *
   * A pair only counts when both are reachable where they are: at their own
   * centres, hit testing has to land on them. That is what keeps every control
   * behind a modal backdrop -- covered, inert, and overlapping half the dialog
   * -- from being reported as a collision. Nesting is skipped for the same
   * reason: an icon inside a button is not two things fighting for one pixel.
   */
  const collisions = (scene) => {
    const boxes = controlBoxes().filter((x) => {
      const cx = x.b.left + x.b.width / 2;
      const cy = x.b.top + x.b.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false;
      const at = document.elementFromPoint(cx, cy);
      return !!at && (at === x.el || x.el.contains(at) || at.contains(x.el));
    });

    const out = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        /*
         * The board is exempt, for the reason its lots are exempt from the
         * size rule: it is a projection. Two houses standing side by side on
         * an isometric street have bounding *rectangles* that overlap by
         * design while the drawn shapes do not touch, and hit testing follows
         * the shapes. Comparing rectangles here would report the map as
         * broken every time it drew a street correctly.
         */
        if (a.el.closest('.board-frame') && b.el.closest('.board-frame')) continue;
        const w = Math.min(a.b.right, b.b.right) - Math.max(a.b.left, b.b.left);
        const h = Math.min(a.b.bottom, b.b.bottom) - Math.max(a.b.top, b.b.top);
        // A shared 1px border is two controls sitting next to each other.
        if (w <= 1 || h <= 1) continue;
        out.push({
          scene,
          a: `${name(a.el)} "${label(a.el)}"`,
          b: `${name(b.el)} "${label(b.el)}"`,
          w: Math.round(w),
          h: Math.round(h),
        });
      }
    }
    return out;
  };

  /**
   * Scroll containers that scroll by less than a scrollbar.
   *
   * A box that scrolls one axis cannot be `visible` on the other -- CSS
   * computes it to `auto` -- so a few stray pixels of decoration inside a
   * vertically-scrolling panel grow a full-width horizontal scrollbar under
   * content that was never too wide. The deal analyser had one: the blueprint
   * corner marks hang 6px outside the panel they decorate, and 5 of those
   * pixels landed in the scrollable area. It was found in a screenshot rather
   * than in play, which is the argument for checking it here.
   *
   * The test is whether the scroll is worth its own bar. A table genuinely
   * wider than its column scrolls by hundreds of pixels and is doing its job; a
   * container that scrolls by less than the ~15px the scrollbar itself occupies
   * is spending more room announcing the scroll than it has to show.
   *
   * Geometry again, so once per scene rather than once per theme.
   */
  const slivers = (scene) => {
    const BAR = 15;
    const found = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      for (const axis of ['x', 'y']) {
        const mode = axis === 'x' ? cs.overflowX : cs.overflowY;
        if (mode !== 'auto' && mode !== 'scroll') continue;
        const client = axis === 'x' ? el.clientWidth : el.clientHeight;
        const scroll = axis === 'x' ? el.scrollWidth : el.scrollHeight;
        const over = scroll - client;
        if (client <= 0 || over <= 0 || over >= BAR) continue;
        found.push({
          scene,
          axis,
          selector:
            (el.className && String(el.className).trim().split(/\s+/).slice(0, 2).join('.')) ||
            el.tagName.toLowerCase(),
          client,
          over,
        });
      }
    }
    return found;
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

  /*
   * Navigation and the scene list come from scripts/scenes.js, which the main
   * process evaluates first. They are shared with the screenshot capture so the
   * two cannot drift apart -- reaching these screens is the fiddly part and it
   * is worth having exactly one copy of it.
   */
  const shared = window.__PF_SCENES;
  if (!shared) throw new Error('contrast-audit: scripts/scenes.js was not loaded first');
  const { scenes, byText, click, openTab, closeModal } = shared;
  void byText;
  void click;
  void openTab;
  void closeModal;

  const all = [];
  const reached = [];
  const missed = [];

  const targets = [];
  const slivered = [];
  const collided = [];
  const spilled = [];
  const stranded = [];
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
    slivered.push(...slivers(scene.name));
    collided.push(...collisions(scene.name));
    spilled.push(...spills(scene.name));
    stranded.push(...unreachable(scene.name));
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

  // And again for slivers: one bad rule can slice every row of a list.
  const sseen = new Map();
  for (const v of slivered) {
    const key = `${v.scene}|${v.axis}|${v.selector}|${v.over}`;
    const at = sseen.get(key);
    if (at) at.count++;
    else sseen.set(key, { ...v, count: 1 });
  }

  return {
    scenes: reached,
    missed,
    darkFailures: all.filter((f) => f.theme === 'dark').length,
    lightFailures: all.filter((f) => f.theme === 'light').length,
    unique,
    targetFailures: targets.length,
    targets: [...tseen.values()].sort((a, b) => a.w * a.h - b.w * b.h),
    sliverCount: slivered.length,
    slivers: [...sseen.values()].sort((a, b) => a.over - b.over),
    collisions: collided,
    spills: spilled,
    unreachable: stranded,
  };
})();
