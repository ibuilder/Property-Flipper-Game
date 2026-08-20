import { useEffect, useRef, useState } from 'react';
import {
  DIFFICULTY_META,
  ECON,
  LEVELS_BY_ID,
  advanceDay,
  campaignDayLimit,
  describeActiveEvents,
  isTutorial,
  isUnlocked,
  lockReason,
  netWorth,
  totalDebt,
  tutorialComplete,
  type ClosedDeal,
  type ScenarioDef,
} from '../engine';
import { gameDate, money, moneyShort, percent } from './format';
import { advanceDays, quitToMenu, saveGame, useAction, useDigest, useGame } from './store';
import DealCardModal from './components/DealCardModal';
import Ticker from './components/Ticker';
import TimeDigestBar from './components/TimeDigestBar';
import { play, setSoundEnabled, soundEnabled } from './sound';
import { theme, toggleTheme } from './theme';
import Coach from './coach/Coach';
import LogPanel from './LogPanel';
import NewsRail from './components/NewsRail';
import TourCard from './components/TourCard';
import MarketView from './views/MarketView';
import PortfolioView from './views/PortfolioView';
import FinanceView from './views/FinanceView';
import SkillsView from './views/SkillsView';
import DealsView from './views/DealsView';
import OutcomeModal from './views/OutcomeModal';
import SaveModal from './views/SaveModal';
import HelpModal from './views/HelpModal';
import AuctionView from './views/AuctionView';
import { Icon } from './components/Art';

type Tab = 'market' | 'auction' | 'portfolio' | 'finance' | 'skills' | 'deals';

export default function GameShell() {
  const state = useGame();
  const act = useAction();
  const [tab, setTab] = useState<Tab>('market');
  const [saveOpen, setSaveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sound, setSound] = useState(soundEnabled);
  const [mode, setMode] = useState(theme);
  const digest = useDigest();

  /*
   * The card, at the moment the flip closes.
   *
   * Selling is the point of the entire game and it used to produce a toast and
   * a row in a ledger. Meanwhile `dealCard.ts` renders a complete 1200x630
   * picture of the deal that nobody saw unless they went looking for it on the
   * Track record tab, three clicks away and long after the moment had passed.
   *
   * Watched here rather than raised by the action that sells, because a flip
   * can close by accepting an offer *or* by an auction settling, and both go
   * through the engine rather than through one button. The length of
   * `closedDeals` is the one thing true of every path.
   *
   * The ref starts at whatever the count already is, so loading a save with
   * forty flips in it does not celebrate the fortieth.
   */
  const [justClosed, setJustClosed] = useState<ClosedDeal | null>(null);
  const closedCount = state?.closedDeals.length ?? 0;
  const seenClosed = useRef<number | null>(null);
  useEffect(() => {
    if (seenClosed.current === null) {
      seenClosed.current = closedCount;
      return;
    }
    if (closedCount > seenClosed.current && state) {
      setJustClosed(state.closedDeals[state.closedDeals.length - 1]);
    }
    seenClosed.current = closedCount;
  }, [closedCount]);

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
          setTab('auction');
          break;
        case '3':
          setTab('portfolio');
          break;
        case '4':
          setTab('finance');
          break;
        case '5':
          setTab('skills');
          break;
        case '6':
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
  // Difficulty stretches or shortens the campaign clock, so read it from the
  // engine rather than from the level, or the header disagrees with the loss
  // condition it is counting down to.
  const dayLimit = scenario?.dayLimit ?? campaignDayLimit(state);
  const worth = netWorth(state);
  const debt = totalDebt(state);
  const events = describeActiveEvents(state.world);
  const pendingOffers = state.portfolio.reduce(
    (n, p) => n + (p.ownership?.saleListing?.offers.length ?? 0),
    0,
  );
  const goalPct =
    level.goalNetWorth === Number.MAX_SAFE_INTEGER ? 0 : worth / level.goalNetWorth;

  /*
   * Fall back rather than trust the tab state.
   *
   * The keyboard shortcuts set the tab directly and their effect closes over a
   * stale `state`, so guarding them individually would be both fiddly and easy
   * to get wrong later. Resolving the active tab at render covers every route
   * in -- keyboard, click, or a save loaded straight into a locked screen.
   */
  const activeTab: Tab = isUnlocked(state, tab) ? tab : 'market';

  return (
    <>
      <header className="topbar">
        <div className="brand">
          Property Flipper
          <span className="sub">
            {title}
            {state.difficulty !== 'standard' && ` · ${DIFFICULTY_META[state.difficulty].name}`}
          </span>
        </div>

        <div className="stat">
          <span className="label">Day</span>
          <span className="value">
            <Ticker value={state.day} format={(n) => String(Math.round(n))} tint={false} />
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
          <Ticker className={`value ${state.cash < 0 ? 'bad' : ''}`} value={state.cash} format={money} />
        </div>

        <div className="stat">
          <span className="label">Net worth</span>
          <Ticker className="value" value={worth} format={money} />
        </div>

        {debt > 0 && (
          <div className="stat">
            <span className="label">Debt</span>
            {/* Debt going up is bad and going down is good, which is the
                opposite of every other figure here, so it says nothing. */}
            <Ticker className="value bad" value={debt} format={money} tint={false} />
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
          <button
            className="btn"
            aria-pressed={sound}
            onClick={() => {
              const next = !sound;
              setSoundEnabled(next);
              setSound(next);
              if (next) play('good');
            }}
            title={sound ? 'Sound on — click to mute' : 'Sound off — click to enable'}
          >
            {sound ? '♪' : '♪̸'}
          </button>
          <button
            className="btn"
            aria-pressed={mode === 'light'}
            onClick={() => {
              toggleTheme();
              setMode(theme());
            }}
            title={
              mode === 'dark'
                ? 'Dark ground — click for the light drawing'
                : 'Light ground — click for the dark drawing'
            }
          >
            {mode === 'dark' ? '◐' : '◑'}
          </button>
          <button className="btn" onClick={quitToMenu}>
            Menu
          </button>
        </div>
      </header>

      {/* Scout lives at the shell so he survives a tab change, and reads
          whatever screen is open through the context passed to him. */}
      <Coach context={{ state }} />

      {digest && <TimeDigestBar digest={digest} />}
      {/* The payoff. See `justClosed` above for why it lives here. */}
      {justClosed && (
        <DealCardModal fresh deal={justClosed} onClose={() => setJustClosed(null)} />
      )}

      {events.length > 0 && (
        <div
          style={{
            padding: '7px 20px',
            background: 'var(--warn-dim)',
            borderBottom: '1px solid var(--warn)',
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
            borderBottom: '1px solid var(--bad)',
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
        <TabButton id="market" tab={activeTab} setTab={setTab} label="Market" count={state.market.length} />
        <TabButton
          id="auction"
          tab={activeTab}
          setTab={setTab}
          label="Auction"
          count={state.auction.lots.length}
          alert={state.auction.lots.filter((l) => l.myMaxBid !== null).length}
          alertNoun="bid"
          locked={!isUnlocked(state, 'auction')}
          lockTitle={lockReason('auction')}
        />
        <TabButton
          id="portfolio"
          tab={activeTab}
          setTab={setTab}
          label="Portfolio"
          count={state.portfolio.length}
          alert={pendingOffers}
        />
        <TabButton
          id="finance"
          tab={activeTab}
          setTab={setTab}
          label="Finance"
          locked={!isUnlocked(state, 'finance')}
          lockTitle={lockReason('finance')}
        />
        <TabButton
          id="skills"
          tab={activeTab}
          setTab={setTab}
          label="Skills"
          alert={state.experience.unspentPoints}
          alertNoun="point"
          locked={!isUnlocked(state, 'skills')}
          lockTitle={lockReason('skills')}
        />
        <TabButton
          id="deals"
          tab={activeTab}
          setTab={setTab}
          label="Track record"
          count={state.closedDeals.length}
          locked={!isUnlocked(state, 'deals')}
          lockTitle={lockReason('deals')}
        />
      </nav>

      <div className="main">
        <div className="content">
          {isTutorial(state) && !tutorialComplete(state) && <TourCard tab={activeTab} />}
          {activeTab === 'market' && <MarketView />}
          {activeTab === 'auction' && <AuctionView />}
          {activeTab === 'portfolio' && <PortfolioView />}
          {activeTab === 'finance' && <FinanceView />}
          {tab === 'skills' && <SkillsView />}
          {tab === 'deals' && <DealsView />}
        </div>
        <aside className="sidebar">
          {/* News above the log deliberately. The log is what happened to you;
              this is what is happening to the market, and it is the one that
              should change what you do next. */}
          <NewsRail state={state} />
          <LogPanel />
        </aside>
      </div>

      {saveOpen && <SaveModal onClose={() => setSaveOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {state.phase !== 'playing' && <OutcomeModal />}
    </>
  );
}

/**
 * One icon per tab, from the delivered set.
 *
 * Named for what the tab is rather than what it does, because these sit beside
 * the word rather than replacing it -- the icon is there to make the row
 * scannable once you know it, not to be guessed cold.
 */
const TAB_ICON: Record<Tab, string> = {
  market: 'search',
  auction: 'gavel',
  portfolio: 'home',
  finance: 'banknote',
  skills: 'badge-check',
  deals: 'file-text',
};

function TabButton({
  id,
  tab,
  setTab,
  label,
  count,
  alert,
  alertNoun = 'offer',
  locked,
  lockTitle,
}: {
  id: Tab;
  tab: Tab;
  setTab: (t: Tab) => void;
  label: string;
  count?: number;
  alert?: number;
  /** What the alert badge is counting. Portfolio has offers; the auction has bids. */
  alertNoun?: string;
  /** Held back until the first flip is closed. */
  locked?: boolean;
  lockTitle?: string;
}) {
  if (locked) {
    /*
     * Shown, not hidden.
     *
     * A tab that appears later feels like the game changed; a tab that is
     * visibly shut and says why feels like a door. The second one also tells a
     * new player what the game contains, which is most of what a menu is for.
     */
    return (
      <button className="tab locked" disabled title={lockTitle} aria-disabled="true">
        <Icon name={TAB_ICON[id]} />
        {label}
        <span className="badge">locked</span>
      </button>
    );
  }
  return (
    <button className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
      <Icon name={TAB_ICON[id]} />
      {label}
      {alert ? (
        <span className="badge alert">
          {alert} {alertNoun}
          {alert === 1 ? '' : 's'}
        </span>
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

