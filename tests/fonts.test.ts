import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Barlow is embedded on purpose. A linked webfont would flash fallback text
 * and would not travel with the single-file HTML build. The CSP used to omit
 * `font-src`, so every face registered and then failed with status "error".
 */
describe('embedded Barlow', () => {
  const css = readFileSync('src/ui/fonts.css', 'utf8');

  it('is imported by the renderer entry', () => {
    expect(readFileSync('src/main.tsx', 'utf8')).toContain("import './ui/fonts.css'");
  });

  it('declares the five subset faces the UI asks for', () => {
    expect(css.match(/@font-face/g)?.length).toBe(5);
    expect(css).toContain("font-family: 'Barlow'");
    expect(css).toContain("font-family: 'Barlow Condensed'");
    expect(css).toMatch(/font-weight:\s*400/);
    expect(css).toMatch(/font-weight:\s*500/);
    expect(css).toMatch(/font-weight:\s*600/);
    expect(css).toContain('data:font/woff2;base64,');
    expect(css).not.toMatch(/fonts\.googleapis\.com/);
  });

  it('is allowed by the page CSP', () => {
    expect(readFileSync('index.html', 'utf8')).toContain("font-src 'self' data:");
  });

  it('keeps the OFL next to the faces', () => {
    expect(existsSync('docs/design/FONT-LICENSE.txt')).toBe(true);
    expect(readFileSync('docs/design/FONT-LICENSE.txt', 'utf8')).toContain('SIL Open Font License');
  });
});
