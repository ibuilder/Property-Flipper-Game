import { useMemo } from 'react';
import { DEFECTS_BY_ID, jobProgress, workFinishedSoFar } from '../../engine';
import type { HouseSubject, Property } from '../../engine';
import { HOUSE_GROUND_Y, HOUSE_VIEWBOX, HOUSE_W, buildHouseArt } from './houseArt';

/**
 * Renders a property's facade.
 *
 * Decorative in the sense that no gameplay depends on it, informative in that
 * every mark is derived from simulation state -- so a glance at the picture
 * tells you roughly what the condition number says, and the before/after of a
 * renovation is visible rather than arithmetic.
 */
export default function House({
  property,
  className,
  title,
  day = 150,
  showDefects = false,
}: {
  /** A live Property, or a snapshot from a closed deal. */
  property: Property | HouseSubject;
  className?: string;
  /** Accessible description; falls back to a generated one. */
  title?: string;
  /** Drives the season in the scene. */
  day?: number;
  /**
   * Pin known defects to where they are. Off at thumbnail size, where the pins
   * would be larger than the house.
   */
  showDefects?: boolean;
}) {
  // Deliberately not memoised on `property`. The engine mutates state in place,
  // so a Property keeps the same object identity from purchase to sale -- a memo
  // keyed on it would build the facade once and then never notice the crew
  // arriving, the roof being replaced, or the board going up in the yard.
  // Building this object is trivial; the expensive step below is memoised on
  // the fields it actually reads.
  const live = property as Property;
  const job = live.ownership?.renovation ?? null;
  const subject: HouseSubject = {
    ...(property as HouseSubject),
    renovating: 'renovating' in property ? property.renovating : !!job,
    forSale: 'forSale' in property ? property.forSale : !!live.ownership?.saleListing,
    // A snapshot from a closed deal carries its own values; a live property
    // derives them from the job actually running on it.
    workInProgress:
      'workInProgress' in property ? property.workInProgress : job ? workFinishedSoFar(job) : [],
    renovationProgress:
      'renovationProgress' in property
        ? property.renovationProgress
        : job
          ? jobProgress(job)
          : 0,
  };

  const art = useMemo(
    () => buildHouseArt(subject, day),
    // The picture only changes when the things it encodes change.
    [
      subject.id,
      subject.condition,
      subject.completedWork.join(','),
      subject.defects.map((d) => `${d.defId}:${d.revealed}:${d.repaired}`).join(','),
      subject.renovating,
      subject.forSale,
      // Without these the house would freeze at the state it had when the crew
      // arrived and only catch up on the last day of the job.
      (subject.workInProgress ?? []).join(','),
      // Rounded, so the scaffolding steps down rather than redrawing daily.
      Math.round((subject.renovationProgress ?? 0) * 10),
      // Season, not the day itself -- no need to redraw every tick.
      Math.floor(((day + 59) % 365) / 60),
    ],
  );

  const p = art.palette;
  // Thresholds mirror conditionLabel() so the picture and the pill agree.
  const label =
    title ??
    `${property.address}: ${
      property.condition >= 0.85
        ? 'turnkey'
        : property.condition >= 0.65
          ? 'well kept'
          : property.condition >= 0.45
            ? 'dated but sound'
            : property.condition >= 0.3
              ? 'visibly rough'
              : 'derelict'
    }`;

  return (
    <svg
      viewBox={HOUSE_VIEWBOX}
      className={className}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMax meet"
    >
      <title>{label}</title>

      <rect x="0" y="0" width={HOUSE_W} height={HOUSE_GROUND_Y} fill={p.sky} />
      <rect x="0" y={HOUSE_GROUND_Y} width={HOUSE_W} height={140 - HOUSE_GROUND_Y} fill={p.ground} />

      {/* One soft contact shadow, per the style bible. Cheap, and it stops the
          house floating on the ground plane. */}
      <ellipse
        cx={HOUSE_W / 2}
        cy={HOUSE_GROUND_Y + 2}
        rx={art.body.w * 0.72}
        ry="5"
        fill="#000"
        opacity="0.28"
      />

      {/* Porch roof sits behind the body so the posts read in front. */}
      {art.porch && (
        <g transform={`rotate(${art.porch.lean} ${art.porch.x} ${art.porch.y + art.porch.h})`}>
          <rect
            x={art.porch.x}
            y={art.porch.y}
            width={art.porch.w}
            height="3"
            fill={p.trim}
            opacity="0.85"
          />
          <rect x={art.porch.x + 2} y={art.porch.y} width="2.5" height={art.porch.h} fill={p.trim} />
          <rect
            x={art.porch.x + art.porch.w - 4.5}
            y={art.porch.y}
            width="2.5"
            height={art.porch.h}
            fill={p.trim}
          />
        </g>
      )}

      {/* Body. A hairline outline slightly darker than the fill gives the
          storybook edge the style bible calls for and keeps shapes legible at
          thumbnail size. */}
      <rect
        x={art.body.x}
        y={art.body.y}
        width={art.body.w}
        height={art.body.h}
        fill={p.wall}
        stroke="#000"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <rect
        x={art.body.x}
        y={art.body.y}
        width={art.body.w * 0.18}
        height={art.body.h}
        fill={p.wallShade}
        opacity="0.5"
      />

      {/* Weather staining */}
      {art.stains.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill="#000" opacity={s.o} />
      ))}

      {/* Chimney behind the roof plane */}
      {art.chimney && (
        <rect
          x={art.chimney.x}
          y={art.chimney.y}
          width={art.chimney.w}
          height={art.chimney.h}
          fill={p.wallShade}
        />
      )}

      {/* Roof */}
      <polygon points={art.roof.points} fill={p.roof} stroke="#000" strokeOpacity="0.4" strokeWidth="1" />
      {/* Snow settles on the roof in winter. Seasonality is worth ~3% on value
          and was previously invisible. */}
      {art.season === 'winter' && (
        <polygon points={art.roof.points} fill="#dfe7f0" opacity="0.55" />
      )}
      {art.roof.gaps.map((g, i) => (
        <rect key={i} x={g.x} y={g.y} width={g.w} height={g.h} fill="#12100e" opacity="0.75" />
      ))}

      {art.dormers.map((d, i) => (
        <g key={i}>
          <rect x={d.x} y={d.y} width={d.w} height={d.h} fill={p.wall} />
          <rect x={d.x + 3} y={d.y + 3} width={d.w - 6} height={d.h - 5} fill={p.glass} />
        </g>
      ))}

      {/* Windows */}
      {art.windows.map((w, i) => (
        <g key={i}>
          <rect x={w.x} y={w.y} width={w.w} height={w.h} fill={p.trim} opacity="0.9" />
          <rect
            x={w.x + 1.5}
            y={w.y + 1.5}
            width={w.w - 3}
            height={w.h - 3}
            fill={w.lit ? '#f3d79a' : p.glass}
          />
          {w.panes && !w.boarded && (
            <>
              <rect x={w.x + w.w / 2 - 0.5} y={w.y + 1.5} width="1" height={w.h - 3} fill={p.trim} />
              <rect x={w.x + 1.5} y={w.y + w.h / 2 - 0.5} width={w.w - 3} height="1" fill={p.trim} />
            </>
          )}
          {w.boarded && (
            <>
              <rect
                x={w.x - 1}
                y={w.y + 3}
                width={w.w + 2}
                height="3.5"
                fill="#6b5946"
                transform={`rotate(-8 ${w.x + w.w / 2} ${w.y + w.h / 2})`}
              />
              <rect
                x={w.x - 1}
                y={w.y + 9}
                width={w.w + 2}
                height="3.5"
                fill="#5c4c3c"
                transform={`rotate(6 ${w.x + w.w / 2} ${w.y + w.h / 2})`}
              />
            </>
          )}
        </g>
      ))}

      {/* Door */}
      <rect x={art.door.x} y={art.door.y} width={art.door.w} height={art.door.h} fill={p.door} />
      <circle cx={art.door.x + art.door.w - 3.5} cy={art.door.y + art.door.h / 2} r="1" fill={p.trim} />

      {/* Yard */}
      {art.shrubs.map((s, i) =>
        s.wild ? (
          <path
            key={i}
            d={`M${s.x - s.r} ${HOUSE_GROUND_Y} q${s.r * 0.4} ${-s.r * 1.9} ${s.r} ${-s.r * 0.5} q${s.r * 0.6} ${-s.r} ${s.r} ${s.r * 0.5} z`}
            fill="#3c4a2a"
          />
        ) : (
          <circle key={i} cx={s.x} cy={HOUSE_GROUND_Y - s.r * 0.55} r={s.r} fill="#2f6b3d" />
        ),
      )}
      {art.weeds.map((w, i) => (
        <rect key={i} x={w.x} y={HOUSE_GROUND_Y - w.h} width="1.2" height={w.h} fill="#556133" />
      ))}

      {/* Scaffolding along the elevation while the crew is on site. A skip
          alone did not read as "work is happening here". */}
      {art.works && (
        <g stroke="#8a8479" strokeWidth="1.4" opacity="0.85">
          {art.works.scaffoldX.map((x, i) => (
            <line key={i} x1={x} y1={art.body.y - 4} x2={x} y2={HOUSE_GROUND_Y} />
          ))}
          <line
            x1={art.works.scaffoldX[0]}
            y1={art.body.y + art.body.h * 0.35}
            x2={art.works.scaffoldX[art.works.scaffoldX.length - 1]}
            y2={art.body.y + art.body.h * 0.35}
          />
          <line
            x1={art.works.scaffoldX[0]}
            y1={art.body.y + art.body.h * 0.75}
            x2={art.works.scaffoldX[art.works.scaffoldX.length - 1]}
            y2={art.body.y + art.body.h * 0.75}
          />
        </g>
      )}
      {art.works?.tarp && (
        <polygon points={art.roof.points} fill="#2f6fa8" opacity="0.5" />
      )}

      {/* A skip in the drive while the crew is in. */}
      {art.skip && (
        <g>
          <polygon
            points={`8,${HOUSE_GROUND_Y - 13} 38,${HOUSE_GROUND_Y - 13} 35,${HOUSE_GROUND_Y} 11,${HOUSE_GROUND_Y}`}
            fill="#c2712c"
          />
          <rect x="12" y={HOUSE_GROUND_Y - 16} width="7" height="4" fill="#7a5a3a" />
          <rect x="22" y={HOUSE_GROUND_Y - 17} width="9" height="5" fill="#6d5230" />
        </g>
      )}

      {/* Known problems, pinned where they actually are. Drawn last so they sit
          above everything, and only at hero size -- at thumbnail scale the pins
          would be bigger than the house. */}
      {showDefects &&
        art.markers.map((m) => {
          const tone =
            m.severity === 'major' ? '#ff6b6b' : m.severity === 'moderate' ? '#f0a848' : '#8fa3b8';
          const def = DEFECTS_BY_ID[m.defId];
          return (
            <g key={m.defId}>
              <title>
                {def?.name ?? m.defId} &mdash; {m.severity}
              </title>
              <circle cx={m.x} cy={m.y} r="7" fill="#0b0e13" opacity="0.55" />
              <circle
                cx={m.x}
                cy={m.y}
                r="5.5"
                fill="none"
                stroke={tone}
                strokeWidth="1.6"
              />
              <rect x={m.x - 0.7} y={m.y - 3} width="1.4" height="4" fill={tone} />
              <rect x={m.x - 0.7} y={m.y + 1.8} width="1.4" height="1.4" fill={tone} />
            </g>
          );
        })}

      {/* For-sale board */}
      {art.sign !== 'none' && (
        <g>
          <rect x={HOUSE_W - 40} y={HOUSE_GROUND_Y - 26} width="2" height="26" fill="#8a8479" />
          <rect x={HOUSE_W - 54} y={HOUSE_GROUND_Y - 34} width="30" height="14" rx="1.5" fill="#e8e4dc" />
          <rect x={HOUSE_W - 51} y={HOUSE_GROUND_Y - 31} width="24" height="2.5" fill="#4d9fff" />
          <rect x={HOUSE_W - 51} y={HOUSE_GROUND_Y - 27} width="16" height="2" fill="#9aa3ad" />
        </g>
      )}
    </svg>
  );
}
