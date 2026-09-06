import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { readPng } from '../scripts/image.mjs';

describe('the press kit', () => {
  it('assembles named files at the storefront sizes', () => {
    execFileSync('node', ['scripts/press-kit.mjs'], { stdio: 'pipe' });
    expect(existsSync('docs/press-kit/FACTSHEET.md')).toBe(true);
    const sheet = readFileSync('docs/press-kit/FACTSHEET.md', 'utf8');
    expect(sheet).toContain('Property Flipper');
    expect(sheet).not.toMatch(/Flip Empire/i);

    const cover = readPng('docs/press-kit/cover-630x500.png');
    expect([cover.w, cover.h]).toEqual([630, 500]);
    expect(existsSync('docs/press-kit/shots/05-renovation.png')).toBe(true);
  });
});
