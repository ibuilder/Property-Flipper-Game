import { useState } from 'react';
import {
  buildTimeline,
  describeDeployment,
  deploymentRate,
  type CampaignTimeline as Timeline,
  type GameState,
  type TimelineSpan,
} from '../../engine';
import { money, percent } from '../format';
import { Icon } from '../components/Art';

/**
 * The campaign, as a shape.
 *
 * A 450-day campaign was represented by one integer. Every question about
 * pacing — how long did that renovation really take, how long did the last one
 * sit unsold, was I ever running two at once, how much of the clock did my
 * money spend doing nothing — needed the whole log to answer, so nobody asked
 * them.
 *
 * One lane per property against a shared clock, with the bar for a deal that
 * lost money drawn in the loss colour. The idle stretches are the point: they
 * are invisible in a game scored by profit per deal, and they are where a
 * year's return quietly goes.
 */

const LANE_H = 22;
const LANE_GAP = 5;
const PAD_L = 4;
const PAD_R = 4;
const AXIS_H = 20;
const W = 1000;

const SPAN_STYLE: Record<TimelineSpan['kind'], { fill: string; h: number; y: number }> = {
  // The full hold sits behind everything as a quiet track.
  owned: { fill: 'var(--border-strong)', h: 14, y: 4 },
  renovating: { fill: 'var(--warn)', h: 8, y: 7 },
  listed: { fill: 'var(--accent)', h: 8, y: 7 },
  let: { fill: 'var(--good)', h: 8, y: 7 },
};

export default function CampaignTimeline({ state }: { state: GameState }) {
  const [hover, setHover] = useState<string | null>(null);
  const t: Timeline = buildTimeline(state);

  if (t.lanes.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head">
          <Icon name="calendar" />
            <h2>The campaign</h2>
          <span className="faint" style={{ fontSize: 12 }}>
            day {t.today} of {t.toDay}
          </span>
        </div>
        <div className="empty">
          Nothing bought yet. The clock is running either way &mdash; {t.today - 1} days gone.
        </div>
      </div>
    );
  }

  const innerW = W - PAD_L - PAD_R;
  const span = Math.max(1, t.toDay - t.fromDay);
  const x = (day: number) => PAD_L + ((day - t.fromDay) / span) * innerW;
  const H = AXIS_H + t.lanes.length * (LANE_H + LANE_GAP);

  // Ticks every 30 days, thinned so they never crowd on a long campaign.
  const step = span > 700 ? 90 : span > 300 ? 60 : 30;
  const ticks: number[] = [];
  for (let d = t.fromDay; d <= t.toDay; d += step) ticks.push(d);

  const rate = deploymentRate(t);

  return (
    <div className="panel">
      <div className="panel-head">
        <Icon name="calendar" />
            <h2>The campaign</h2>
        <span className={`pill ${rate > 0.7 ? 'good' : rate > 0.45 ? 'warn' : 'bad'}`}>
          {percent(rate, 0)} deployed
        </span>
      </div>
      <div className="panel-body">
        <div className="table-wrap">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: 'auto', display: 'block', minWidth: 460 }}
            role="img"
            aria-label={`Campaign timeline: ${t.lanes.length} properties across ${t.today} days, capital deployed ${Math.round(
              rate * 100,
            )}% of the time`}
          >
            {/* Axis */}
            {ticks.map((d) => (
              <g key={d}>
                <line
                  x1={x(d)}
                  x2={x(d)}
                  y1={AXIS_H - 5}
                  y2={H}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <text x={x(d) + 3} y={11} fontSize="9" fill="var(--text-faint)">
                  {d === 1 ? 'day 1' : d}
                </text>
              </g>
            ))}

            {t.lanes.map((lane, i) => {
              const y = AXIS_H + i * (LANE_H + LANE_GAP);
              const lost = lane.profit !== null && lane.profit < 0;
              const isHover = hover === lane.propertyId;

              return (
                <g
                  key={lane.propertyId}
                  onMouseEnter={() => setHover(lane.propertyId)}
                  onMouseLeave={() => setHover(null)}
                >
                  {lane.spans.map((s, j) => {
                    const style = SPAN_STYLE[s.kind];
                    const x0 = x(s.from);
                    // Never narrower than a hairline, or a one-day span vanishes.
                    const w = Math.max(2, x(Math.max(s.to, s.from + 1)) - x0);
                    return (
                      <rect
                        key={j}
                        x={x0}
                        y={y + style.y}
                        width={w}
                        height={style.h}
                        rx={2}
                        fill={
                          s.kind === 'owned' && lost ? 'var(--bad-dim)' : style.fill
                        }
                        opacity={isHover ? 1 : 0.9}
                      >
                        <title>
                          {lane.address} — {s.kind}, day {s.from} to{' '}
                          {s.to === t.today && lane.open ? 'now' : s.to}
                        </title>
                      </rect>
                    );
                  })}

                  {/* The result, written at the end of the bar. */}
                  {lane.soldDay !== null && lane.profit !== null && (
                    <text
                      x={x(lane.soldDay) + 6}
                      y={y + 13}
                      fontSize="10"
                      fill={lane.profit >= 0 ? 'var(--good)' : 'var(--bad)'}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {lane.profit >= 0 ? '+' : ''}
                      {money(lane.profit)}
                    </text>
                  )}

                  <text
                    x={x(Math.min(...lane.spans.map((s) => s.from))) + 4}
                    y={y + 13}
                    fontSize="10"
                    fill="var(--text)"
                    opacity={isHover ? 1 : 0.75}
                    pointerEvents="none"
                  >
                    {lane.address}
                  </text>
                </g>
              );
            })}

            {/* Setbacks, marked on the axis rather than in a lane: they belong
                to the campaign, not to one house. */}
            {t.markers
              .filter((m) => m.kind === 'setback')
              .map((m, i) => (
                <g key={`s${i}`}>
                  <line
                    x1={x(m.day)}
                    x2={x(m.day)}
                    y1={AXIS_H - 6}
                    y2={AXIS_H - 1}
                    stroke="var(--bad)"
                    strokeWidth="2"
                  >
                    <title>
                      Day {m.day}: {m.label}
                    </title>
                  </line>
                </g>
              ))}

            {/* Today */}
            <line
              x1={x(t.today)}
              x2={x(t.today)}
              y1={AXIS_H - 8}
              y2={H}
              stroke="var(--text)"
              strokeWidth="1.5"
            />
            <circle cx={x(t.today)} cy={AXIS_H - 8} r="3" fill="var(--text)" />
          </svg>
        </div>

        <div className="timeline-key">
          <span className="key">
            <i style={{ background: 'var(--border-strong)' }} /> held
          </span>
          <span className="key">
            <i style={{ background: 'var(--warn)' }} /> renovating
          </span>
          <span className="key">
            <i style={{ background: 'var(--accent)' }} /> on the market
          </span>
          <span className="key">
            <i style={{ background: 'var(--good)' }} /> let
          </span>
          <span className="key">
            <i style={{ background: 'var(--bad)', width: 2 }} /> setback
          </span>
        </div>

        <p className="faint" style={{ fontSize: 12, margin: '10px 0 0' }}>
          {describeDeployment(t)}
        </p>
      </div>
    </div>
  );
}
