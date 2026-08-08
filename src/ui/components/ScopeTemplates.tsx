import { useState } from 'react';

/**
 * Saved scopes of work.
 *
 * Rebuilding "the usual cosmetic refresh" line by line on every deal is busy
 * work, not a decision. Two sensible presets ship, and anything you assemble
 * can be saved alongside them. Stored locally rather than in the save file --
 * a way of working belongs to the player, not to one campaign.
 */

const KEY = 'flipper:scope-templates';

const BUILT_IN: { name: string; ids: string[] }[] = [
  {
    name: 'Cosmetic refresh',
    ids: ['paint_interior', 'flooring_lvp', 'kitchen_refresh', 'landscaping_curb', 'staging'],
  },
  {
    name: 'Full gut',
    ids: [
      'paint_interior',
      'flooring_lvp',
      'kitchen_full',
      'bath_full',
      'roof_replace',
      'hvac_replace',
      'landscaping_curb',
      'staging',
    ],
  },
];

type Template = { name: string; ids: string[] };

function loadCustom(): Template[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((t) => t?.name && Array.isArray(t.ids)) : [];
  } catch {
    return [];
  }
}

function saveCustom(list: Template[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    // Storage unavailable; templates just are not persisted.
  }
}

export default function ScopeTemplates({
  scope,
  onApply,
}: {
  scope: string[];
  onApply: (ids: string[]) => void;
}) {
  const [custom, setCustom] = useState<Template[]>(loadCustom);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || scope.length === 0) return;
    const next = [...custom.filter((t) => t.name !== trimmed), { name: trimmed, ids: [...scope] }];
    setCustom(next);
    saveCustom(next);
    setNaming(false);
    setName('');
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="scope-group-label" style={{ marginTop: 0 }}>
        Templates
      </div>
      <div className="btn-row">
        {[...BUILT_IN, ...custom].map((t) => (
          <button key={t.name} className="btn small" onClick={() => onApply(t.ids)}>
            {t.name}
            <span className="faint"> ({t.ids.length})</span>
          </button>
        ))}
        {!naming ? (
          <button
            className="btn small"
            disabled={scope.length === 0}
            onClick={() => setNaming(true)}
            title={scope.length === 0 ? 'Tick some line items first' : 'Save this scope'}
          >
            Save current
          </button>
        ) : (
          <>
            <input
              type="text"
              value={name}
              placeholder="Template name"
              autoFocus
              style={{ width: 160 }}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') setNaming(false);
              }}
            />
            <button className="btn small primary" onClick={save}>
              Save
            </button>
            <button className="btn small" onClick={() => setNaming(false)}>
              Cancel
            </button>
          </>
        )}
        {custom.length > 0 && (
          <button
            className="btn small danger"
            onClick={() => {
              setCustom([]);
              saveCustom([]);
            }}
          >
            Clear saved
          </button>
        )}
      </div>
    </div>
  );
}
