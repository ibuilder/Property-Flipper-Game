import {
  HOUSE_COLOR_BARE,
  HOUSE_PLINTH,
  ICONS,
  ICON_BOX,
  NPC,
  PRESS,
  SCOUT,
  SCOUT_BOX,
} from '../art.generated';

/**
 * The delivered art, as components.
 *
 * Everything here reads from `art.generated.ts`, which `npm run art` compiles
 * out of `art/`. Nothing is fetched at runtime: the app ships as one file under
 * a strict content-security policy, so an asset that is not inlined is an asset
 * that silently does not appear.
 *
 * Two conventions are worth stating because they decide how each piece is
 * handled. Line art -- the icons, the board houses, the mastheads -- is drawn
 * in `currentColor` and takes the theme. Finished pictures -- Scout, the
 * coloured houses -- keep their own palette, because a character who changes
 * colour with the interface stops reading as a character.
 *
 * The markup goes in through `dangerouslySetInnerHTML`, which is safe here in
 * the way the name is asking about: this is build-time output from files in the
 * repository, never anything a player or a save file can reach.
 */

/**
 * One icon, on a 24px grid.
 *
 * Inherits colour and can be sized by `font-size` at the call site, so an icon
 * next to a label lines up with it without either being measured.
 */
export function Icon({
  name,
  size = '1em',
  title,
}: {
  name: string;
  size?: string | number;
  title?: string;
}) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      viewBox={`0 0 ${ICON_BOX} ${ICON_BOX}`}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ flex: 'none', verticalAlign: '-0.125em' }}
    >
      {title && <title>{title}</title>}
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** Whether there is a drawing for an icon name, for call sites that fall back. */
export function hasIcon(name: string): boolean {
  return Boolean(ICONS[name]);
}

/**
 * Scout, at whichever mood the rule that fired asked for.
 *
 * Falls through to `briefing` rather than rendering nothing: a missing portrait
 * would collapse the card's head row and shift every line in it.
 */
export function ScoutPortrait({
  mood,
  size = 34,
}: {
  mood: string;
  size?: number;
}) {
  const body = SCOUT[mood] ?? SCOUT.briefing;
  if (!body) return null;
  return (
    <svg
      viewBox={`0 0 ${SCOUT_BOX} ${SCOUT_BOX}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

/** One of the four faces Scout is not: appraiser, lender, rival, inspector. */
export function Face({ who, size = 34 }: { who: string; size?: number }) {
  const body = NPC[who];
  if (!body) return null;
  return (
    <svg
      viewBox={`0 0 ${SCOUT_BOX} ${SCOUT_BOX}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

/**
 * A masthead or headline plate, inked in the current text colour.
 *
 * Scales to the width it is given and keeps its own aspect, so the wood-type
 * never stretches.
 */
export function Press({ name, title }: { name: string; title?: string }) {
  const plate = PRESS[name];
  if (!plate) return null;
  return (
    <svg
      viewBox={`0 0 ${plate.w} ${plate.h}`}
      width="100%"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ display: 'block', color: 'inherit' }}
      dangerouslySetInnerHTML={{ __html: plate.body }}
    />
  );
}

/** Whether a headline plate exists for an event. */
export function hasPress(name: string): boolean {
  return Boolean(PRESS[name]);
}

/**
 * A coloured house, for anywhere one house is the subject.
 *
 * Deliberately not on the board. Each of these paints its own kerbed plinth and
 * lawn before it draws the building, which would cover the lot colour that the
 * four data views exist to show -- the board would go from four questions to
 * one picture. Here, where there is no ramp underneath, the plinth is the point.
 *
 * The overlay is drawn over the base in the same artboard, exactly as on the
 * board, so a house does not move when its state changes.
 */
export function ColorHouse({
  archetypeId,
  state,
  size = 168,
  className,
}: {
  archetypeId: string;
  state?: string | null;
  size?: number;
  className?: string;
}) {
  const art = HOUSE_COLOR_BARE[archetypeId];
  if (!art) return null;
  // The plinth is stored once rather than baked into a second copy of every
  // house; here, where a house is the subject, it is what it stands on.
  const body = (HOUSE_PLINTH[archetypeId] ?? '') + art.base + (state && art[state] ? art[state] : '');
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

/** Whether there is a coloured drawing for an archetype. */
export function hasColorHouse(archetypeId: string): boolean {
  return Boolean(HOUSE_COLOR_BARE[archetypeId]);
}
