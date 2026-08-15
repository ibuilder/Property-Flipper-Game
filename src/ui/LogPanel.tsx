import { useGame } from './store';
import { Icon } from './components/Art';

const TONE_CLASS: Record<string, string> = {
  good: 'good',
  bad: 'bad',
  warn: 'warn',
  info: '',
};

export default function LogPanel() {
  const state = useGame();
  if (!state) return null;

  const entries = state.log.slice(-140);

  return (
    <>
      <div className="panel-head" style={{ borderBottom: '1px solid var(--border)' }}>
        <Icon name="clock" />
            <h2>Activity</h2>
        <span className="faint" style={{ fontSize: 11 }}>
          newest first
        </span>
      </div>
      <div className="log">
        {entries.length === 0 ? (
          <div className="empty">Nothing has happened yet.</div>
        ) : (
          entries.map((e, i) => (
            <div className="log-entry" key={`${e.day}-${i}`}>
              <span className="day">d{e.day}</span>
              <span className={TONE_CLASS[e.tone]}>{e.message}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
