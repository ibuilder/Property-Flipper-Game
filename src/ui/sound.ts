/**
 * A small synthesised sound set.
 *
 * Deliberately generated rather than sampled: no binary assets to ship, no
 * licensing to track, and the whole thing is a few hundred bytes in the bundle
 * instead of a few hundred kilobytes. The palette is four short cues rather
 * than a sound for every action -- audio that fires constantly stops carrying
 * information and starts being noise, which is why the day tick has none.
 *
 * Off by default. Sound that begins without being asked for is a bug.
 */

export type Cue = 'good' | 'bad' | 'warn' | 'money' | 'work';

const STORAGE_KEY = 'flipper:sound';

let ctx: AudioContext | null = null;
let enabled = read();

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* the setting simply will not persist */
  }
  // Browsers only allow an AudioContext to start inside a user gesture, and
  // toggling this on is one -- so open it here rather than at the first cue.
  if (on) void resume();
}

async function resume(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = ctx ?? new Ctor();
  if (ctx.state === 'suspended') await ctx.resume();
  return ctx;
}

/** One short enveloped tone. Everything below is built from these. */
function tone(
  at: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
): void {
  const osc = at.createOscillator();
  const amp = at.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at.currentTime + start);
  // A hard start or stop on a gain node clicks; ramp both ends.
  amp.gain.setValueAtTime(0.0001, at.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(gain, at.currentTime + start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, at.currentTime + start + duration);
  osc.connect(amp).connect(at.destination);
  osc.start(at.currentTime + start);
  osc.stop(at.currentTime + start + duration + 0.02);
}

export function play(cue: Cue): void {
  if (!enabled) return;
  void resume().then((at) => {
    if (!at) return;
    switch (cue) {
      // A rising third: something went your way.
      case 'good':
        tone(at, 523.25, 0, 0.12, 0.09);
        tone(at, 659.25, 0.09, 0.18, 0.08);
        break;
      // A falling minor second, low and short. Unpleasant on purpose.
      case 'bad':
        tone(at, 196, 0, 0.16, 0.1, 'triangle');
        tone(at, 155.56, 0.1, 0.26, 0.09, 'triangle');
        break;
      case 'warn':
        tone(at, 392, 0, 0.1, 0.07, 'triangle');
        tone(at, 392, 0.14, 0.1, 0.06, 'triangle');
        break;
      // Two bright clinks. Money arriving.
      case 'money':
        tone(at, 1046.5, 0, 0.07, 0.06);
        tone(at, 1396.9, 0.06, 0.1, 0.055);
        tone(at, 1760, 0.13, 0.2, 0.045);
        break;
      // A dull knock: the crew is on site.
      case 'work':
        tone(at, 130.81, 0, 0.09, 0.11, 'square');
        break;
    }
  });
}

/**
 * Which cue an engine log line deserves.
 *
 * Reading the log rather than instrumenting every action means the audio
 * cannot drift out of step with what the simulation actually did -- if it was
 * worth telling you about, it is worth a sound.
 */
export function cueForLog(tone: 'info' | 'good' | 'bad' | 'warn', message: string): Cue | null {
  if (/sold|refinanced|cash out|rent collected/i.test(message)) return 'money';
  if (/work started|crew/i.test(message)) return 'work';
  if (tone === 'good') return 'good';
  if (tone === 'bad') return 'bad';
  if (tone === 'warn') return 'warn';
  return null;
}
