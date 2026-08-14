import { describe, expect, it } from 'vitest';

/**
 * No mojibake, anywhere.
 *
 * This has now bitten three times, twice in ROADMAP.md and once in
 * `game.ts` where it reached the *player* -- a post-mortem told somebody they
 * had spent more than budgeted "â€” a wider scope", which is the game looking
 * broken at the exact moment it is trying to teach.
 *
 * Every instance came from the same thing: editing a UTF-8 file through a
 * PowerShell `Get-Content`/`Set-Content` round trip, which reads it as Latin-1
 * and re-encodes the damage. Nothing in the type system, the linter or the
 * render tests can see it, because `'â€”'` is a perfectly valid string.
 *
 * So it is checked here. The sequences below are what UTF-8 punctuation looks
 * like after that round trip, and finding any of them in source means a file
 * was mangled rather than authored.
 */

const MOJIBAKE = [
  'â€”', // em dash
  'â€“', // en dash
  'â€™', // right single quote
  'â€œ', // left double quote
  'â€', // right double quote
  'â€¦', // ellipsis
  'Ã©', // e-acute
  'Â·', // middle dot
  'Â£', // pound
];

/** Everything we author, excluding generated and vendored files. */
const SOURCES = import.meta.glob('../{src,scripts,electron}/**/*.{ts,tsx,css,js}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/**
 * Docs, including the ones at the repository root.
 *
 * Two globs rather than one: `../{docs,*.md}/**\/*.md` looked like it covered
 * both and silently matched only the subdirectory, so ROADMAP.md -- the exact
 * file this keeps happening to -- was not being scanned. A guard with a hole
 * in it is worse than no guard, because it is trusted.
 */
const DOCS = {
  ...import.meta.glob('../docs/**/*.md', { eager: true, query: '?raw', import: 'default' }),
  ...import.meta.glob('../*.md', { eager: true, query: '?raw', import: 'default' }),
};

describe('text encoding', () => {
  it('has no mojibake in any source file', () => {
    const found: string[] = [];
    for (const [path, raw] of Object.entries(SOURCES)) {
      // fonts.css is base64 and legitimately contains arbitrary byte
      // sequences; scanning it produces only false positives.
      if (path.includes('fonts.css')) continue;
      const text = String(raw);
      for (const bad of MOJIBAKE) {
        if (text.includes(bad)) found.push(`${path}: ${JSON.stringify(bad)}`);
      }
    }
    expect(found, `mangled text -- a UTF-8 file was round-tripped through a Latin-1 reader:\n${found.join('\n')}`).toEqual([]);
  });

  it('has no mojibake in the documentation either', () => {
    // The roadmap is the file this keeps happening to, and it is the one a
    // human is most likely to read.
    const found: string[] = [];
    for (const [path, raw] of Object.entries(DOCS)) {
      const text = String(raw);
      for (const bad of MOJIBAKE) {
        if (text.includes(bad)) found.push(`${path}: ${JSON.stringify(bad)}`);
      }
    }
    expect(found, `mangled documentation:\n${found.join('\n')}`).toEqual([]);
  });

  it('is actually looking at files, not passing by vacuity', () => {
    // The failure mode of a scanner is finding nothing because it read
    // nothing. If the globs ever stop matching, this fails rather than going
    // quietly green.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
    // Named explicitly: a count would have passed while the root markdown was
    // being missed, which is how the hole survived being written.
    const docs = Object.keys(DOCS).join(' ');
    expect(docs).toMatch(/ROADMAP\.md/);
    expect(docs).toMatch(/playthrough-findings\.md/);
  });

  it('would catch the exact string that shipped', () => {
    // Guards the guard: if MOJIBAKE is ever emptied or mistyped, this fails.
    const shipped = 'Spent $15,926 more than budgeted â€” a wider scope.';
    expect(MOJIBAKE.some((m) => shipped.includes(m))).toBe(true);
  });
});
