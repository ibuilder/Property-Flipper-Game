/** Presentation helpers. Kept out of the engine, which deals only in numbers. */

export function money(n: number): string {
  const v = Math.round(n);
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US');
}

/** Compact form for dense table cells: $1.2M, $340k. */
export function moneyShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`;
  return money(n);
}

export function signedMoney(n: number): string {
  return (n > 0 ? '+' : '') + money(n);
}

export function percent(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function signedPercent(n: number, digits = 1): string {
  return (n > 0 ? '+' : '') + percent(n, digits);
}

/** Day number to a readable in-game date. Day 1 is 1 March, Year 1. */
export function gameDate(day: number): string {
  const start = new Date(2001, 2, 1);
  const d = new Date(start.getTime() + (day - 1) * 86400000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function conditionLabel(condition: number): { text: string; tone: string } {
  if (condition >= 0.85) return { text: 'Turnkey', tone: 'good' };
  if (condition >= 0.65) return { text: 'Good', tone: 'good' };
  if (condition >= 0.45) return { text: 'Dated', tone: 'warn' };
  if (condition >= 0.3) return { text: 'Rough', tone: 'warn' };
  return { text: 'Distressed', tone: 'bad' };
}

export const VERDICT_COPY: Record<string, { title: string; body: string }> = {
  strong: {
    title: 'Strong deal',
    body: 'Margin clears 15% of ARV. This is the shape of deal you are looking for.',
  },
  fair: {
    title: 'Workable',
    body: 'Between 8% and 15% margin. Real, but one bad surprise eats it.',
  },
  thin: {
    title: 'Too thin',
    body: 'Under 8% margin. A single change order or a slow sale turns this negative.',
  },
  loss: {
    title: 'Loses money',
    body: 'The costs exceed the after-repair value. Walk away.',
  },
};
