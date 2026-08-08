import { useEffect, useState } from 'react';
import { LEVELS } from '../engine';
import { money } from './format';
import { importSave, listSaves, loadGame, startGame } from './store';

export default function MainMenu() {
  const [saves, setSaves] = useState<{ slot: string; modified: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listSaves().then(setSaves);
  }, []);

  const handleLoad = async (slot: string) => {
    const res = await loadGame(slot);
    if (!res.ok) setError(res.message);
  };

  return (
    <div className="menu">
      <div className="menu-inner">
        <h1>Property Flipper</h1>
        <p className="tagline">
          Buy distressed, underwrite honestly, and get out before the carry eats the margin.
        </p>

        <div className="panel">
          <div className="panel-head">
            <h2>Choose a campaign</h2>
          </div>
          <div className="panel-body">
            {LEVELS.map((level) => (
              <button
                key={level.id}
                className="level-card"
                onClick={() => startGame(level.id)}
              >
                <h3>{level.name}</h3>
                <p>{level.blurb}</p>
                <div className="level-meta">
                  <span>Start {money(level.startingCash)}</span>
                  <span>
                    Target{' '}
                    {level.goalNetWorth === Number.MAX_SAFE_INTEGER
                      ? 'none'
                      : money(level.goalNetWorth)}
                  </span>
                  <span>{level.dayLimit ? `${level.dayLimit} days` : 'No time limit'}</span>
                  <span>{level.neighborhoods.length} areas</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Saved games</h2>
            <button
              className="btn small"
              onClick={async () => {
                const res = await importSave();
                if (!res.ok) setError(res.message);
              }}
            >
              Import from file
            </button>
          </div>
          <div className="panel-body flush">
            {saves.length === 0 ? (
              <div className="empty">No saved games yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {saves.map((s) => (
                      <tr key={s.slot}>
                        <td style={{ width: '100%' }}>{s.slot}</td>
                        <td className="dim num">
                          {s.modified ? new Date(s.modified).toLocaleString() : ''}
                        </td>
                        <td className="right">
                          <button className="btn small" onClick={() => handleLoad(s.slot)}>
                            Load
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {error && <div className="verdict loss">{error}</div>}

        <p className="faint" style={{ fontSize: 12, marginTop: 20 }}>
          Every campaign runs on a seeded simulation, so a given starting seed always plays out
          the same way. Saves capture the random stream exactly.
        </p>
      </div>
    </div>
  );
}
