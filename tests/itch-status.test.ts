import { describe, expect, it } from 'vitest';
import {
  channelsOffVersion,
  normaliseVersion,
  versionForChannel,
  versionsByChannel,
} from '../scripts/itch-status.mjs';

const SAMPLE = `
+ https://example.itch.io/property-flipper

  • html5
      current: v2.2.0 (build 41)
  • windows
      current: v2.2.0 (build 42)
  • windows-portable
      current: v2.1.0 (build 40)
  • mac
      current: v2.2.0 (build 43)
  • linux
      current: v2.2.0 (build 44)
`;

describe('itch-status', () => {
  it('treats v2.2.0 and 2.2.0 as the same userversion', () => {
    expect(normaliseVersion('v2.2.0')).toBe('2.2.0');
    expect(normaliseVersion('2.2.0')).toBe('2.2.0');
  });

  it('reads a channel version off butler status text', () => {
    expect(versionForChannel(SAMPLE, 'html5')).toBe('2.2.0');
    expect(versionForChannel(SAMPLE, 'windows-portable')).toBe('2.1.0');
    expect(versionsByChannel(SAMPLE).mac).toBe('2.2.0');
  });

  it('names the channels that are not on the expected tag', () => {
    expect(channelsOffVersion(SAMPLE, 'v2.2.0')).toEqual(['windows-portable']);
    expect(channelsOffVersion(SAMPLE, '2.2.0', ['html5', 'windows', 'mac', 'linux'])).toEqual([]);
  });
});
