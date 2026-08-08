import { useEffect, useState } from 'react';
import {
  ECON,
  LEVELS_BY_ID,
  advanceDay,
  describeActiveEvents,
  netWorth,
  totalDebt,
  type ScenarioDef,
} from '../engine';
import { gameDate, money, moneyShort, percent } from './format';
import { advanceDays, quitToMenu, saveGame, useAction, useGame } from './store';
import LogPanel from './LogPanel';
import MarketView from './views/MarketView';
import PortfolioView from './views/PortfolioView';
import FinanceView from './views/FinanceView';
import SkillsView from './views/SkillsView';
import DealsView from './views/DealsView';
import OutcomeModal from './views/OutcomeModal';
import SaveModal from './views/SaveModal';
import HelpModal from './views/HelpModal';

type Tab = 'market' | 'portfolio' | 'finance' | 'skills' | 'deals';

export default function GameShell() {
  const state = useGame();
  const act = useAction();
  const [tab, setTab] = useState<Tab>('market');
  const [saveOpen, setSaveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Autosave every few days so a crash never costs much progress.
  useEffect(() => {
    if (state && state.day % 5 === 0) void saveGame('autosave');
  }, [state?.day]);

  // Keyboard shortcuts. Suppressed while a dialog is open or the user is
  // typing, so an offer price never gets eaten by the day-advance key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (document.querySelector('.modal-backdrop')) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          act((s) => advanceDay(s));
          break;
        case 'w':
          advanceDays(7);
          break;
        case 'm':
          advanceDays(30);
          break;
        case 's':
          setSaveOpen(true);
          break;
        case '?':
        case 'h':
          setHelpOpen(true);
          break;
        case '1':
          setTab('market');
          break;
        case '2':
          setTab('portfolio');
          break;
        case '3':
          setTab('finance');
          break;
        case '4':
          setTab('skills');
          break;
        case '5':
          setTab('deals');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  if (!state) return null;

  const scenario = state.scenario as ScenarioDef | null;
  const level = LEVELS_BY_ID[state.levelId];
  // A scenario runs on the sandbox rules but is not the sandbox, so it names
  // itself and shows its own clock and pass mark.
  const title = scenario?.name ?? level.name;
  const dayLimit = scenario?.dayLimit ?? level.dayLimit;
  const worth = netWorth(state);
  const debt = totalDebt(state);
  const events = describeActiveEvents(state.world);
  const pendingOffers = state.portfolio.reduce(
    (n, p) => n + (p.ownership?.saleListing?.offers.length ?? 0),
    0,
  );
  const goalPct =
    level.goalNetWorth === Number.MAX_SAFE_INTEGER ? 0 : worth / level.goalNetWorth;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          Property Flipper
          <span className="sub">{title}</span>
        </div>

        <div className="stat">
          <span className="label">Day</span>
          <span className="value">
            {state.day}
            {dayLimit && <span className="faint"> / {dayLimit}</span>}
          </span>
        </div>

        <div className="stat secondary">
          <span className="label">{gameDate(state.day)}</span>
          <span className="value" style={{ fontSize: 13 }}>
            {seasonLabel(state.day)}
          </span>
        </div>

        <div className="stat">
          <span className="label">Cash</span>
          <span className={`value ${state.cash < 0 ? 'bad' : ''}`}>{money(state.cash)}</span>
        </div>

        <div className="stat">
          <span className="label">Net worth</span>
          <span className="value">{money(worth)}</span>
        </div>

        {debt > 0 && (
          <div className="stat">
            <span className="label">Debt</span>
            <span className="value bad">{money(debt)}</span>
          </div>
        )}

        <div className="stat">
          <span className="label">Market</span>
          <span
            className={`value ${
              state.world.marketIndex >= 1.02 ? 'good' : state.world.marketIndex <= 0.98 ? 'bad' : ''
            }`}
          >
            {state.world.marketIndex.toFixed(3)}
          </span>
        </div>

        <div className="stat">
          <span className="label">Rate</span>
          <span className="value">{percent(state.world.interestRate, 2)}</span>
        </div>

        {level.goalNetWorth !== Number.MAX_SAFE_INTEGER && (
          <div className="stat" style={{ minWidth: 110 }}>
            <span className="label">Target {moneyShort(level.goalNetWorth)}</span>
            <div className="bar" style={{ marginTop: 5 }}>
              <span style={{ width: `${Math.min(100, Math.max(0, goalPct * 100))}%` }} />
            </div>
          </div>
        )}

        <div className="spacer" />

        <div className="btn-row">
          <button
            className="btn"
            onClick={() => act((s) => advanceDay(s))}
            title="Advance one day (N)"
          >
            Next day
          </button>
          <button className="btn" onClick={() => advanceDays(7)} title="Advance a week (W)">
            +7d
          </button>
          <button className="btn" onClick={() => advanceDays(30)} title="Advance a month (M)">
            +30d
          </button>
          <button className="btn" onClick={() => setSaveOpen(true)} title="Saved games (S)">
            Saves
          </button>
          <button className="btn" onClick={() => setHelpOpen(true)} title="How to play (?)">
            Help
          </button>
          <button className="btn" onClick={quitToMenu}>
            Menu
          </button>
        </div>
      </header>

      {events.length > 0 && (
        <div
          style={{
            padding: '7px 20px',
            background: 'var(--warn-dim)',
            borderBottom: '1px solid #5c4a17',
            fontSize: 12.5,
            color: 'var(--warn)',
            flexShrink: 0,
          }}
        >
          <strong>Active: </strong>
          {events.join('  ·  ')}
        </div>
      )}

      {state.distressDays > 0 && (
        <div
          style={{
            padding: '7px 20px',
            background: 'var(--bad-dim)',
            borderBottom: '1px solid #5c2429',
            fontSize: 12.5,
            color: 'var(--bad)',
            flexShrink: 0,
          }}
        >
          <strong>Cash negative for {state.distressDays} days.</strong> Creditors take over at{' '}
          {ECON.DISTRESS_LIMIT_DAYS}. Sell something.
        </div>
      )}

      <nav className="tabs">
        <TabButton id="market" tab={tab} setTab={setTab} label="Market" count={state.market.length} />
        <TabButton
          id="portfolio"
          tab={tab}
          setTab={setTab}
          label="Portfolio"
          count={state.portfolio.length}
          alert={pendingOffers}
        />
        <TabButton id="finance" tab={tab} setTab={setTab} label="Finance" />
        <TabButton id="skills" tab={tab} setTab={setTab} label="Skills" />
        <TabButton id="deals" tab={tab} setTab={setTab} label="Track record" count={state.closedDeals.length} />
      </nav>

      <div className="main">
        <div className="content">
          {tab === 'market' && <MarketView />}
          {tab === 'portfolio' && <PortfolioView />}
          {tab === 'finance' && <FinanceView />}
          {tab === 'skills' && <SkillsView />}
          {tab === 'deals' && <DealsView />}
        </div>
        <aside className="sidebar">
          <LogPanel />
        </aside>
      </div>

      {saveOpen && <SaveModal onClose={() => setSaveOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {state.phase !== 'playing' && <OutcomeModal />}
    </>
  );
}

function TabButton({
  id,
  tab,
  setTab,
  label,
  count,
  alert,
}: {
  id: Tab;
  tab: Tab;
  setTab: (t: Tab) => void;
  label: string;
  count?: number;
  alert?: number;
}) {
  return (
    <button className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
      {label}
      {alert ? (
        <span className="badge alert">{alert} offer{alert === 1 ? '' : 's'}</span>
      ) : count !== undefined ? (
        <span className="badge">{count}</span>
      ) : null}
    </button>
  );
}

function seasonLabel(day: number): string {
  const doy = (day + 59) % 365;
  if (doy < 60) return 'Spring market';
  if (doy < 152) return 'Peak season';
  if (doy < 244) return 'Late summer';
  if (doy < 305) return 'Autumn';
  return 'Winter lull';
}

