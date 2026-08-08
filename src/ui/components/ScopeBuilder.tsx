import { useMemo } from 'react';
import {
  DEFECTS_BY_ID,
  SCOPE_ITEMS,
  quoteScopeItem,
  scopeIdForDefect,
  type GameState,
  type Property,
  type ScopeCategory,
} from '../../engine';
import { money } from '../format';

const CATEGORY_LABEL: Record<ScopeCategory, string> = {
  cosmetic: 'Cosmetic',
  kitchen: 'Kitchen',
  bath: 'Bathrooms',
  systems: 'Systems',
  exterior: 'Exterior',
  structural: 'Structural',
  addition: 'Additions',
  staging: 'Marketing',
};

const ORDER: ScopeCategory[] = [
  'cosmetic',
  'kitchen',
  'bath',
  'systems',
  'exterior',
  'structural',
  'addition',
  'staging',
];

/**
 * Line-item scope selection.
 *
 * Known defects are listed first and separately, because they are not
 * discretionary in the way an upgrade is: skipping one does not save the money,
 * it defers it into a buyer concession at 1.15x. The UI says so explicitly.
 */
export default function ScopeBuilder({
  property,
  state,
  scope,
  onToggle,
}: {
  property: Property;
  state: GameState;
  scope: string[];
  onToggle: (id: string) => void;
}) {
  const knownDefects = property.defects.filter((d) => d.revealed && !d.repaired);

  const grouped = useMemo(() => {
    const out = new Map<ScopeCategory, typeof SCOPE_ITEMS>();
    for (const item of SCOPE_ITEMS) {
      if (property.completedWork.includes(item.id)) continue;
      const list = out.get(item.category) ?? [];
      list.push(item);
      out.set(item.category, list);
    }
    return out;
  }, [property.completedWork]);

  return (
    <div>
      {knownDefects.length > 0 && (
        <>
          <div className="scope-group-label bad">
            Known defects &mdash; skipping these costs more later
          </div>
          {knownDefects.map((d) => {
            const def = DEFECTS_BY_ID[d.defId];
            const id = scopeIdForDefect(d.defId);
            const quote = quoteScopeItem(id, property, state.world, state.skills);
            if (!def || !quote) return null;
            return (
              <label key={id} className={`scope-item ${scope.includes(id) ? 'on' : ''}`}>
                <input
                  type="checkbox"
                  checked={scope.includes(id)}
                  onChange={() => onToggle(id)}
                />
                <span style={{ flex: 1 }}>
                  <span className="name">
                    {def.name}{' '}
                    <span className={`pill ${def.severity === 'major' ? 'bad' : 'warn'}`}>
                      {def.severity}
                    </span>
                  </span>
                  <span className="blurb" style={{ display: 'block' }}>
                    {def.blurb}
                    {def.mustFix && (
                      <>
                        {' '}
                        <span className="bad">
                          A buyer&rsquo;s inspector will find this and ask for{' '}
                          {money(quote.cost * 1.15)} off.
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <span className="meta" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {money(quote.cost)}
                  <br />
                  {quote.days}d
                </span>
              </label>
            );
          })}
        </>
      )}

      {ORDER.filter((c) => grouped.has(c)).map((cat) => (
        <div key={cat}>
          <div className="scope-group-label">{CATEGORY_LABEL[cat]}</div>
          {grouped.get(cat)!.map((item) => {
            const quote = quoteScopeItem(item.id, property, state.world, state.skills);
            if (!quote) return null;
            const on = scope.includes(item.id);
            return (
              <label key={item.id} className={`scope-item ${on ? 'on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => onToggle(item.id)} />
                <span style={{ flex: 1 }}>
                  <span className="name">{item.name}</span>
                  <span className="blurb" style={{ display: 'block' }}>
                    {item.blurb}
                  </span>
                </span>
                <span className="meta" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {money(quote.cost)}
                  <br />
                  {quote.days}d
                </span>
              </label>
            );
          })}
        </div>
      ))}

      {property.completedWork.length > 0 && (
        <>
          <div className="scope-group-label good">Already done</div>
          <div style={{ padding: '4px 10px', fontSize: 12.5 }} className="dim">
            {property.completedWork
              .map((id) => SCOPE_ITEMS.find((i) => i.id === id)?.name ?? id)
              .join(', ')}
          </div>
        </>
      )}
    </div>
  );
}
