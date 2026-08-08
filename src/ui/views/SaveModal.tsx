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

/** Save slot management: save, load, delete, and export/import to a file. */
export default function SaveModal({ onClose }: { onClose: () => void }) {
  const state = useGame();
  const [saves, setSaves] = useState<{ slot: string; modified: string }[]>([]);
  const [slotName, setSlotName] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

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
