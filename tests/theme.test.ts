import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The themes, checked as colour rather than as text.
 *
 * A second theme is the kind of feature that looks finished and is not: every
 * component renders, nothing throws, and a third of the text is unreadable
 * because one token was tuned for the other ground. Nothing in the type system
 * or the render tests can see that. So this parses the real stylesheet,
 * resolves the tokens the way a browser would, and measures contrast.
 *
 * It caught a live regression while being written: inverting the data ramp for
 * the dark theme left the map's labels painted in the background colour on top
 * of fills that had become dark, so the bottom half of the ramp was invisible.
 */

const RAW = readFileSync('src/ui/styles.css', 'utf8');

/**
 * Comments out, before anything else looks at this.
 *
 * Declarations are found by splitting on `;` and then on the first `:`, and
 * the comments in this stylesheet contain both. A comment sitting above a
 * declaration silently swallowed it, so half the tokens below read as missing
 * when they were defined all along -- which is a much more confusing failure
 * than a missing token, because the stylesheet is correct.
 */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Pull the custom properties out of every block matching a selector pattern.
 *
 * The pattern is passed in already written rather than escaped from a string:
 * building it with `new RegExp` from a template literal put a `${}` (from the
 * escaping character class) inside an interpolation, which does not mean what
 * it looks like it means.
 */
function block(re: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of CSS.matchAll(re)) {
    for (const decl of m[1].split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const name = decl.slice(0, i).trim();
      if (name.startsWith('--')) out[name] = decl.slice(i + 1).trim();
    }
  }
  return out;
}

const DARK = block(/:root\s*\{([^}]*)\}/g);
const LIGHT = { ...DARK, ...block(/:root\[data-theme='light'\]\s*\{([^}]*)\}/g) };

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hex(value: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Resolve a token to a concrete colour, following `var()` and flattening the
 * `color-mix(in srgb, X p%, transparent)` form over a known backdrop -- which
 * is what the browser composites it to.
 */
function resolve(tokens: Record<string, string>, value: string, over: Rgb, depth = 0): Rgb | null {
  if (depth > 8) return null;
  const v = value.trim();

  const direct = hex(v);
  if (direct) return direct;

  const varMatch = /^var\((--[a-z0-9-]+)\)$/i.exec(v);
  if (varMatch) {
    const next = tokens[varMatch[1]];
    return next === undefined ? null : resolve(tokens, next, over, depth + 1);
  }

  const mix = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+?)\)$/i.exec(v);
  if (mix) {
    const a = resolve(tokens, mix[1], over, depth + 1);
    if (!a) return null;
    const p = Number(mix[2]) / 100;
    const b = mix[3].trim() === 'transparent' ? over : resolve(tokens, mix[3], over, depth + 1);
    if (!b) return null;
    return {
      r: a.r * p + b.r * (1 - p),
      g: a.g * p + b.g * (1 - p),
      b: a.b * p + b.b * (1 - p),
    };
  }
  return null;
}

function luminance(c: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES: [string, Record<string, string>][] = [
  ['dark', DARK],
  ['light', LIGHT],
];

function colour(tokens: Record<string, string>, name: string): Rgb {
  const bg = hex(tokens['--color-bg'])!;
  const c = resolve(tokens, tokens[name] ?? '', bg);
  expect(c, `${name} does not resolve to a colour`).not.toBeNull();
  return c!;
}

describe('the theme tokens', () => {
  it('parses both themes out of the real stylesheet', () => {
    // If this fails the rest of the file is testing nothing.
    expect(Object.keys(DARK).length).toBeGreaterThan(30);
    expect(DARK['--color-bg']).toBeTruthy();
    expect(LIGHT['--color-bg']).toBeTruthy();
    expect(DARK['--color-bg']).not.toBe(LIGHT['--color-bg']);
  });

  it('defines every ramp step in both themes', () => {
    for (const [name, tokens] of THEMES) {
      for (let i = 0; i < 8; i++) {
        expect(tokens[`--ramp-${i}`], `${name} is missing --ramp-${i}`).toBeTruthy();
      }
      for (const step of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
        expect(tokens[`--color-neutral-${step}`], `${name} neutral-${step}`).toBeTruthy();
        expect(tokens[`--color-accent-${step}`], `${name} accent-${step}`).toBeTruthy();
      }
    }
  });

  it('runs the data ramp away from the ground, in both themes', () => {
    // The property every consumer depends on: index is magnitude, so step 0
    // must sit nearest the background and step 7 furthest from it. Inverting
    // one theme and not the other is the failure this prevents.
    for (const [name, tokens] of THEMES) {
      const bg = colour(tokens, '--color-bg');
      let previous = -1;
      for (let i = 0; i < 8; i++) {
        const c = contrast(colour(tokens, `--ramp-${i}`), bg);
        expect(c, `${name} --ramp-${i} is not further from the ground than --ramp-${i - 1}`).toBeGreaterThan(
          previous,
        );
        previous = c;
      }
    }
  });

  it('has no ramp step a label could safely be painted straight onto', () => {
    // Why labels go on plates rather than picking an ink by ramp step. The
    // crossover where paper starts beating ink is not the same in both themes,
    // so no fixed rule is right in both -- measured, light mode bottoms out at
    // 2.55:1 around the middle of the ramp. If this ever stops being true the
    // plates could go, but it is not true today and the test says which step.
    const worst: string[] = [];
    for (const [name, tokens] of THEMES) {
      const bg = colour(tokens, '--color-bg');
      const text = colour(tokens, '--color-text');
      for (let i = 0; i < 8; i++) {
        const fill = colour(tokens, `--ramp-${i}`);
        const best = Math.max(contrast(bg, fill), contrast(text, fill));
        if (best < 4.5) worst.push(`${name} --ramp-${i} best ink is ${best.toFixed(2)}:1`);
      }
    }
    expect(worst.length, `steps that need a plate:\n${worst.join('\n')}`).toBeGreaterThan(0);
  });

  it('keeps a plated label legible, which is what the map actually draws', () => {
    for (const [name, tokens] of THEMES) {
      const c = contrast(colour(tokens, '--color-text'), colour(tokens, '--color-bg'));
      expect(c, `${name} plated label`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('meets AA for body text on both grounds', () => {
    for (const [name, tokens] of THEMES) {
      const bg = colour(tokens, '--color-bg');
      const surface = colour(tokens, '--color-surface');
      const text = colour(tokens, '--color-text');
      expect(contrast(text, bg), `${name} text on bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(text, surface), `${name} text on surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('meets AA for every token that carries small text, on both grounds', () => {
    // Two corrections live in this test, both found by measuring a real
    // rendered element rather than a token.
    //
    // The bar was 3:1, on the reasoning that these carry labels rather than
    // body copy. That is wrong: AA's 3:1 allowance is for 18px, or 14px bold,
    // and these carry 9.5px micro labels and 11px formula lines.
    //
    // And it measured against `--color-bg` alone. Panels are transparent, so
    // most text actually sits on `--color-surface` -- which in the dark theme
    // is the *lighter* of the two and therefore the harder ground. A label
    // reading 4.66:1 against the background was 3.88:1 where it was really
    // drawn. Both grounds, worst case.
    for (const [name, tokens] of THEMES) {
      const grounds: [string, Rgb][] = [
        ['bg', colour(tokens, '--color-bg')],
        ['surface', colour(tokens, '--color-surface')],
      ];
      for (const token of ['--text-dim', '--text-faint', '--color-accent-ink']) {
        for (const [where, ground] of grounds) {
          const c = contrast(colour(tokens, token), ground);
          expect(c, `${name} ${token} on ${where} is ${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('sends micro labels through the semantic token, not a raw ramp step', () => {
    // `.figure-label` painted itself `--color-neutral-600` directly, so it
    // never picked up the tuning done on --text-faint and failed AA in both
    // themes at 9.5px.
    const i = CSS.indexOf('\n.figure-label {');
    expect(i).toBeGreaterThan(-1);
    const body = CSS.slice(i, CSS.indexOf('}', i));
    expect(body).not.toMatch(/color:\s*var\(--color-neutral-\d00\)/);
    expect(body).toMatch(/color:\s*var\(--text-faint\)/);
  });

  it('sends accent-coloured small text through the ink token, not the line one', () => {
    // --color-accent is the identity colour and is allowed to be a line that
    // does not carry text. Anything setting it as a *colour* on small text has
    // to use the ink step or it is illegible on paper.
    for (const sel of ['.figure-formula', '.coach-math', '.mastery-count', '.live-kicker']) {
      const i = CSS.indexOf(`
${sel} {`);
      expect(i, `no rule for ${sel}`).toBeGreaterThan(-1);
      const body = CSS.slice(i, CSS.indexOf('}', i));
      expect(body, `${sel} paints small text with the line accent`).not.toMatch(
        /color:\s*var\(--color-accent\)/,
      );
      expect(body).toMatch(/color:\s*var\(--color-accent-ink\)/);
    }
  });

  it('keeps the signal colours readable on both grounds', () => {
    for (const [name, tokens] of THEMES) {
      const bg = colour(tokens, '--color-bg');
      for (const token of ['--accent', '--good', '--warn', '--bad', '--color-loss']) {
        const c = contrast(colour(tokens, token), bg);
        expect(c, `${name} ${token} on bg is ${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('gives the loss red a ground it is legible on', () => {
    for (const [name, tokens] of THEMES) {
      const c = contrast(colour(tokens, '--color-loss'), colour(tokens, '--color-loss-bg'));
      expect(c, `${name} loss on its plate is ${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('leaves the divider visible without shouting', () => {
    for (const [name, tokens] of THEMES) {
      const c = contrast(colour(tokens, '--color-divider'), colour(tokens, '--color-bg'));
      expect(c, `${name} divider`).toBeGreaterThan(1.15);
      expect(c, `${name} divider is too loud at ${c.toFixed(2)}:1`).toBeLessThan(6);
    }
  });

  it('resolves every legacy alias in both themes', () => {
    // The existing UI is written against these. If one fails to resolve, that
    // part of the interface renders with no colour at all.
    const legacy = [
      '--bg',
      '--bg-raised',
      '--bg-inset',
      '--panel',
      '--border',
      '--border-strong',
      '--text',
      '--text-dim',
      '--text-faint',
      '--accent',
      '--accent-dim',
      '--good',
      '--good-dim',
      '--warn',
      '--warn-dim',
      '--bad',
      '--bad-dim',
    ];
    for (const [name, tokens] of THEMES) {
      for (const token of legacy) {
        expect(tokens[token], `${name} is missing ${token}`).toBeTruthy();
        expect(colour(tokens, token), `${name} ${token}`).toBeTruthy();
      }
    }
  });

  it('sets colour-scheme per theme so form controls follow', () => {
    expect(CSS).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark/);
    expect(CSS).toMatch(/data-theme='light'\]\s*\{[^}]*color-scheme:\s*light/);
  });

  it('names dark as the bare default, so it paints before any script runs', () => {
    // Light is the attribute case. If dark needed an attribute too, every load
    // would show one frame of the wrong ground.
    expect(CSS).not.toMatch(/:root\[data-theme='dark'\]/);
  });
});

describe('the blueprint geometry', () => {
  /** The declarations of one top-level rule, as written. */
  function rule(selector: string): string {
    const i = CSS.indexOf(`\n${selector} {`);
    expect(i, `no rule for ${selector}`).toBeGreaterThan(-1);
    return CSS.slice(i, CSS.indexOf('}', i));
  }

  it('is square', () => {
    expect(DARK['--radius']).toBe('0px');
  });

  it('draws panels as lines rather than surfaces', () => {
    // "Never a surface fill, never a radius." A filled card competes with the
    // one filled object that is supposed to mean "do this".
    const panel = rule('.panel');
    expect(panel).toMatch(/background:\s*transparent/);
    expect(panel).toMatch(/border:\s*1px solid var\(--color-divider\)/);
    expect(panel).toMatch(/border-radius:\s*var\(--radius\)/);
  });

  it('gives panels their registration marks', () => {
    expect(CSS).toMatch(/\.panel::before,\s*\n\.panel::after/);
    expect(CSS).toContain('var(--mark)');
    expect(DARK['--mark']).toBeTruthy();
  });

  it('leaves the primary button as the only filled object', () => {
    expect(rule('.btn')).toMatch(/background:\s*transparent/);
    expect(rule('.btn.primary')).toMatch(/background:\s*var\(--color-accent-solid\)/);
    expect(rule('.pill')).toMatch(/background:\s*transparent/);
  });

  it('keeps the primary label legible on its fill', () => {
    for (const [name, tokens] of THEMES) {
      const c = contrast(colour(tokens, '--color-bg'), colour(tokens, '--color-accent-solid'));
      expect(c, `${name} primary button label is ${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the components', () => {
  it('carry no theme-dependent colour of their own', () => {
    // House.tsx is exempt: a brick house is brick-coloured on paper and on
    // screen, and those literals are artwork rather than interface.
    const files = import.meta.glob('../src/ui/**/*.tsx', { eager: true, query: '?raw', import: 'default' });
    const offenders: string[] = [];
    for (const [path, src] of Object.entries(files)) {
      if (path.includes('House.tsx')) continue;
      const body = String(src)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const m of body.matchAll(/#[0-9a-fA-F]{6}\b/g)) offenders.push(`${path} ${m[0]}`);
    }
    expect(offenders, `hardcoded colours outside the artwork:\n${offenders.join('\n')}`).toEqual([]);
  });
});
