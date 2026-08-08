import { useMemo, useState } from 'react';
import {
  ARCHETYPES,
  DEFECTS,
  NEIGHBORHOODS,
  SELLER_TYPES,
  encodeScenario,
  type ScenarioDef,
} from '../../engine';
import Modal from '../components/Modal';
import { money } from '../format';

/**
 * Author a deal and hand it to someone else.
 *
 * Built for the case the research turned up: everyone teaching underwriting
 * does it through spreadsheets. Setting a specific house, a specific set of
 * hidden defects, and a specific market — then sharing it as a code — is the
 * thing a spreadsheet cannot do.
 */
export default function ScenarioEditor({
  initial,
  onClose,
  onPlay,
}: {
  initial: ScenarioDef;
  onClose: () => void;
  onPlay: (def: ScenarioDef) => void;
}) {
  const [def, setDef] = useState<ScenarioDef>(initial);
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => encodeScenario(def), [def]);

  const set = <K extends keyof ScenarioDef>(k: K, v: ScenarioDef[K]) =>
    setDef((d) => ({ ...d, [k]: v }));
  const setProp = <K extends keyof ScenarioDef['property']>(
    k: K,
    v: ScenarioDef['property'][K],
  ) => setDef((d) => ({ ...d, property: { ...d.property, [k]: v } }));

  const toggleDefect = (id: string) =>
    setDef((d) => {
      const has = d.property.defectIds.includes(id);
      const defectIds = has
        ? d.property.defectIds.filter((x) => x !== id)
        : [...d.property.defectIds, id];
      // Removing a defect must also remove its disclosure.
      const disclosedIds = d.property.disclosedIds.filter((x) => defectIds.includes(x));
      return { ...d, property: { ...d.property, defectIds, disclosedIds } };
    });

  const toggleDisclosed = (id: string) =>
    setDef((d) => {
      const has = d.property.disclosedIds.includes(id);
      return {
        ...d,
        property: {
          ...d.property,
          disclosedIds: has
            ? d.property.disclosedIds.filter((x) => x !== id)
            : [...d.property.disclosedIds, id],
        },
      };
    });

  return (
    <Modal
      title="Author a deal"
      subtitle="Set the house, the problems, and the market — then share the code"
      onClose={onClose}
      width={900}
    >
      <div className="grid-2">
        <div>
          <div className="panel">
            <div className="panel-head">
              <h2>The brief</h2>
            </div>
            <div className="panel-body">
              <label className="field">
                <span className="label">Name</span>
                <input type="text" value={def.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Shown before play</span>
                <input type="text" value={def.brief} onChange={(e) => set('brief', e.target.value)} />
              </label>
              <label className="field">
                <span className="label">Shown after (the lesson)</span>
                <input
                  type="text"
                  value={def.lesson}
                  onChange={(e) => set('lesson', e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Conditions</h2>
            </div>
            <div className="panel-body">
              <NumberField
                label="Starting cash"
                value={def.startingCash}
                step={5000}
                onChange={(v) => set('startingCash', v)}
              />
              <NumberField
                label="Target profit to pass"
                value={def.targetProfit}
                step={1000}
                onChange={(v) => set('targetProfit', v)}
              />
              <NumberField
                label="Days allowed"
                value={def.dayLimit}
                step={30}
                onChange={(v) => set('dayLimit', v)}
              />
              <NumberField
                label="Other listings shown"
                value={def.distractors}
                step={1}
                onChange={(v) => set('distractors', v)}
              />
              <label className="field">
                <span className="label">Market index — {def.marketIndex.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.01}
                  value={def.marketIndex}
                  onChange={(e) => set('marketIndex', Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span className="label">
                  Interest rate — {(def.interestRate * 100).toFixed(2)}%
                </span>
                <input
                  type="range"
                  min={0.02}
                  max={0.14}
                  step={0.0025}
                  value={def.interestRate}
                  onChange={(e) => set('interestRate', Number(e.target.value))}
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-head">
              <h2>The house</h2>
            </div>
            <div className="panel-body">
              <label className="field">
                <span className="label">Type</span>
                <select
                  className="btn"
                  style={{ width: '100%' }}
                  value={def.property.archetypeId}
                  onChange={(e) => setProp('archetypeId', e.target.value)}
                >
                  {ARCHETYPES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.beds}bd/{a.baths}ba
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Neighborhood</span>
                <select
                  className="btn"
                  style={{ width: '100%' }}
                  value={def.property.neighborhoodId}
                  onChange={(e) => setProp('neighborhoodId', e.target.value)}
                >
                  {NEIGHBORHOODS.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} — ${n.pricePerSqft}/sqft
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Seller</span>
                <select
                  className="btn"
                  style={{ width: '100%' }}
                  value={def.property.sellerType}
                  onChange={(e) => setProp('sellerType', e.target.value as never)}
                >
                  {SELLER_TYPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="Square feet"
                value={def.property.sqft}
                step={50}
                onChange={(v) => setProp('sqft', v)}
              />
              <NumberField
                label="Year built"
                value={def.property.yearBuilt}
                step={1}
                onChange={(v) => setProp('yearBuilt', v)}
              />
              <NumberField
                label="Asking price"
                value={def.property.askPrice}
                step={1000}
                onChange={(v) => setProp('askPrice', v)}
              />
              <label className="field">
                <span className="label">
                  Condition — {(def.property.condition * 100).toFixed(0)}%
                </span>
                <input
                  type="range"
                  min={0.05}
                  max={0.97}
                  step={0.01}
                  value={def.property.condition}
                  onChange={(e) => setProp('condition', Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Problems</h2>
              <span className="faint" style={{ fontSize: 12 }}>
                tick to include, then tick again to disclose
              </span>
            </div>
            <div className="panel-body">
              {DEFECTS.map((d) => {
                const included = def.property.defectIds.includes(d.id);
                const disclosed = def.property.disclosedIds.includes(d.id);
                return (
                  <div key={d.id} className={`scope-item ${included ? 'on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleDefect(d.id)}
                      aria-label={`Include ${d.name}`}
                    />
                    <span style={{ flex: 1 }}>
                      <span className="name">
                        {d.name}{' '}
                        <span className={`pill ${d.severity === 'major' ? 'bad' : 'warn'}`}>
                          {d.severity}
                        </span>
                      </span>
                      {included && (
                        <label
                          className="blurb"
                          style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}
                        >
                          <input
                            type="checkbox"
                            checked={disclosed}
                            onChange={() => toggleDisclosed(d.id)}
                            style={{ width: 'auto', accentColor: 'var(--accent)' }}
                          />
                          {disclosed ? 'Disclosed up front' : 'Hidden until inspected'}
                        </label>
                      )}
                    </span>
                    <span className="meta">{money(d.repairCost)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Share it</h2>
        </div>
        <div className="panel-body">
          <label className="field">
            <span className="label">Scenario code — {code.length} characters</span>
            <input type="text" readOnly value={code} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="btn-row">
            <button className="btn primary" onClick={() => onPlay(def)}>
              Play it now
            </button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
            <button className="btn" onClick={onClose}>
              Back
            </button>
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            Anyone can paste this into Learn &rarr; Play a shared deal. The code carries the whole
            scenario, so nothing has to be hosted.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
