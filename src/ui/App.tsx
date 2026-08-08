import { useEffect } from 'react';
import GameShell from './GameShell';
import MainMenu from './MainMenu';
import { dismissToast, useStore } from './store';

export default function App() {
  const { state, toast } = useStore();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, toast.tone === 'error' ? 4200 : 2600);
    return () => clearTimeout(t);
  }, [toast?.id]);

  return (
    <div className="app">
      {state ? <GameShell /> : <MainMenu />}
      {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
    </div>
  );
}
