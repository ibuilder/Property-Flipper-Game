import { useCallback, useEffect, useState } from 'react';
import Modal from '../components/Modal';
import {
  deleteSave,
  exportSave,
  hasNativeBridge,
  importSave,
  listSaves,
  loadGame,
  saveGame,
  useGame,
} from '../store';
import { sessionReport } from '../sessionReport';

/** Save slot management: save, load, delete, and export/import to a file. */
export default function SaveModal({ onClose }: { onClose: () => void }) {
  const state = useGame();
  const [saves, setSaves] = useState<{ slot: string; modified: string }[]>([]);
  const [slotName, setSlotName] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSaves(await listSaves());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    const res = await fn();
    setMessage({ text: res.message, ok: res.ok });
    await refresh();
    return res;
  };

  const nativeOnly = !hasNativeBridge();

  return (
    <Modal title="Saved games" onClose={onClose} width={720}>
      <div className="panel">
        <div className="panel-head">
          <h2>Save current game</h2>
        </div>
        <div className="panel-body">
          <label className="field">
            <span className="label">Slot name</span>
            <input
              type="text"
              value={slotName}
              placeholder={`day-${state?.day ?? 1}`}
              onChange={(e) => setSlotName(e.target.value)}
            />
          </label>
          <div className="btn-row">
            <button
              className="btn primary"
              disabled={!state}
              onClick={() => void run(() => saveGame(slotName.trim() || `day-${state?.day ?? 1}`))}
            >
              Save
            </button>
            <button
              className="btn"
              disabled={!state || nativeOnly}
              title={nativeOnly ? 'Only available in the desktop app' : undefined}
              onClick={() => void run(exportSave)}
            >
              Export to file
            </button>
            <button
              className="btn"
              disabled={nativeOnly}
              title={nativeOnly ? 'Only available in the desktop app' : undefined}
              onClick={async () => {
                const res = await run(importSave);
                if (res.ok) onClose();
              }}
            >
              Import from file
            </button>
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            Saves capture the random stream exactly, so a reloaded game plays on identically rather
            than re-rolling the market.
            {nativeOnly && ' In a browser they are kept in local storage.'}
          </p>
        </div>
      </div>

      {/* Playtesting needs a way for a tester to send back what happened that
          does not require them to attach a save file — especially in the
          browser build, where there are no files. This is plain text, so it
          pastes into a message. */}
      <div className="panel">
        <div className="panel-head">
          <h2>Send feedback</h2>
        </div>
        <div className="panel-body">
          <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
            Copies a plain-text account of this session &mdash; the seed, what you built, which
            parts of the game you used, every deal, and the last stretch of the log. Paste it into
            a message. The seed alone lets anyone reproduce the run exactly.
          </p>
          <div className="btn-row">
            <button
              className="btn"
              disabled={!state}
              onClick={async () => {
                if (!state) return;
                const text = sessionReport(state);
                try {
                  await navigator.clipboard.writeText(text);
                  setMessage({ text: 'Session report copied to the clipboard.', ok: true });
                } catch {
                  // Clipboard access is refused in some embeds -- itch.io runs
                  // the game in a sandboxed iframe. Falling back to showing the
                  // text means the feature still works there.
                  setReport(text);
                  setMessage({ text: 'Clipboard unavailable — select and copy below.', ok: false });
                }
              }}
            >
              Copy session report
            </button>
            {report && (
              <button className="btn" onClick={() => setReport(null)}>
                Hide
              </button>
            )}
          </div>
          {report && (
            <textarea
              readOnly
              value={report}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: '100%',
                height: 220,
                marginTop: 10,
                fontFamily: 'var(--mono)',
                fontSize: 11.5,
                background: 'var(--bg-inset)',
                color: 'var(--text)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius)',
                padding: 10,
              }}
            />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Existing saves</h2>
          <span className="faint" style={{ fontSize: 12 }}>
            {saves.length}
          </span>
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
                      <td style={{ width: '100%', fontWeight: 500 }}>{s.slot}</td>
                      <td className="dim num" style={{ fontSize: 12 }}>
                        {s.modified ? new Date(s.modified).toLocaleString() : ''}
                      </td>
                      <td className="right">
                        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn small"
                            onClick={async () => {
                              const res = await run(() => loadGame(s.slot));
                              if (res.ok) onClose();
                            }}
                          >
                            Load
                          </button>
                          {confirmingDelete === s.slot ? (
                            <>
                              <button
                                className="btn small danger"
                                onClick={async () => {
                                  await deleteSave(s.slot);
                                  setConfirmingDelete(null);
                                  setMessage({ text: `Deleted "${s.slot}".`, ok: true });
                                  await refresh();
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                className="btn small"
                                onClick={() => setConfirmingDelete(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn small danger"
                              onClick={() => setConfirmingDelete(s.slot)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`verdict ${message.ok ? 'strong' : 'loss'}`}>{message.text}</div>
      )}
    </Modal>
  );
}
