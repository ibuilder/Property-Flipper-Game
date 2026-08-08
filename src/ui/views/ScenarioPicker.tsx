import { useState } from 'react';
import {
  SCENARIOS,
  ScenarioError,
  blankScenario,
  decodeScenario,
  type ScenarioDef,
} from '../../engine';
import Modal from '../components/Modal';
import { money } from '../format';
import { startScenario } from '../store';
import ScenarioEditor from './ScenarioEditor';

/**
 * The curriculum, plus the doors into shared and authored deals.
 *
 * Lessons are ordered because each assumes the previous one. Completion is
 * remembered locally so returning players can see how far they got without a
 * save slot being involved.
 */

const DONE_KEY = 'flipper:lessons-done';

function loadDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function markLessonDone(id: string): void {
  try {
    const done = loadDone();
    done.add(id);
    localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    // Storage unavailable; progress simply is not remembered.
  }
}

export default function ScenarioPicker({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ScenarioDef | null>(null);
  const done = loadDone();

  const openShared = () => {
    setError('');
    try {
      const def = decodeScenario(code);
      startScenario(def);
      onClose();
    } catch (e) {
      setError(e instanceof ScenarioError ? e.message : 'That code could not be read.');
    }
  };

  if (editing) {
    return (
      <ScenarioEditor
        initial={editing}
        onClose={() => setEditing(null)}
        onPlay={(def) => {
          startScenario(def);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal
      title="Learn"
      subtitle="Single deals, each isolating one way a flip goes wrong"
      onClose={onClose}
      width={820}
    >
      <div className="panel">
        <div className="panel-head">
          <h2>Lessons</h2>
          <span className="faint" style={{ fontSize: 12 }}>
            {[...done].filter((d) => SCENARIOS.some((s) => s.id === d)).length} / {SCENARIOS.length}{' '}
            complete
          </span>
        </div>
        <div className="panel-body">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className="level-card"
              onClick={() => {
                startScenario(s);
                onClose();
              }}
            >
              <h3>
                {s.name}
                {done.has(s.id) && (
                  <span className="pill good" style={{ marginLeft: 8 }}>
                    passed
                  </span>
                )}
              </h3>
              <p>{s.brief}</p>
              <div className="level-meta">
                <span>Start {money(s.startingCash)}</span>
                <span>Target {money(s.targetProfit)} profit</span>
                <span>{s.dayLimit} days</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Play a shared deal</h2>
          <button className="btn small" onClick={() => setEditing(blankScenario())}>
            Author one
          </button>
        </div>
        <div className="panel-body">
          <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
            Paste a scenario code to play someone else&rsquo;s deal &mdash; an instructor can set the
            house, the defects, the seller and the market, then hand the code out.
          </p>
          <label className="field">
            <span className="label">Scenario code</span>
            <input
              type="text"
              value={code}
              placeholder="eyJuIjoi…"
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <div className="btn-row">
            <button className="btn primary" disabled={!code.trim()} onClick={openShared}>
              Open deal
            </button>
          </div>
          {error && (
            <div className="verdict loss" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
