import { useEffect } from 'react';
import { LEVELS_BY_ID, netWorth, type ScenarioDef } from '../../engine';
import { money, percent } from '../format';
import { quitToMenu, startGame, startScenario, useGame } from '../store';
import Modal from '../components/Modal';
import { markLessonDone } from './ScenarioPicker';

export default function OutcomeModal() {
  const state = useGame();
  const scenarioId = (state?.scenario as ScenarioDef | null)?.id;
  const passed = state?.phase === 'won';
  const builtIn = (state?.scenario as ScenarioDef | null)?.builtIn;

  // Recording progress is a side effect, so it belongs in an effect rather
  // than the render body, where StrictMode would run it twice.
  useEffect(() => {
    if (passed && builtIn && scenarioId) markLessonDone(scenarioId);
  }, [passed, builtIn, scenarioId]);

  if (!state || state.phase === 'playing') return null;

  const level = LEVELS_BY_ID[state.levelId];
  const won = state.phase === 'won';
  const scenario = state.scenario as ScenarioDef | null;

  if (scenario) {
    const best = state.closedDeals.reduce((m, d) => Math.max(m, d.netProfit), 0);
    return (
      <Modal
        title={won ? 'Lesson passed' : 'Lesson failed'}
        subtitle={scenario.name}
        width={680}
        dismissable={false}
      >
        <div className={`verdict ${won ? 'strong' : 'loss'}`} style={{ marginBottom: 18 }}>
          {state.outcomeMessage}
        </div>

        <div className="kv">
          <span className="k">Target profit</span>
          <span className="v">{money(scenario.targetProfit)}</span>
        </div>
        <div className="kv">
          <span className="k">Best deal</span>
          <span className={`v ${best >= scenario.targetProfit ? 'good' : 'bad'}`}>
            {state.closedDeals.length > 0 ? money(best) : 'no completed flip'}
          </span>
        </div>
        <div className="kv">
          <span className="k">Days used</span>
          <span className="v">
            {state.day} / {scenario.dayLimit}
          </span>
        </div>

        {/* The lesson is the whole point, so it is shown either way -- failing
            is when you most need to read it. */}
        <div className="scope-group-label" style={{ marginTop: 18 }}>
          What this was teaching
        </div>
        <p style={{ marginTop: 0, lineHeight: 1.6 }}>{scenario.lesson}</p>

        {state.closedDeals.at(-1)?.postMortem && (
          <p className="dim" style={{ fontSize: 12.5 }}>
            The Track record tab has the full post-mortem for your deal, with the miss attributed.
          </p>
        )}

        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn primary" onClick={() => startScenario(scenario)}>
            {won ? 'Play again' : 'Try again'}
          </button>
          <button className="btn" onClick={quitToMenu}>
            Back to menu
          </button>
        </div>
      </Modal>
    );
  }
  const deals = state.closedDeals;
  const profit = deals.reduce((s, d) => s + d.netProfit, 0);
  const wins = deals.filter((d) => d.netProfit > 0).length;

  const conceded = deals.reduce((s, d) => s + d.concession, 0);
  const carried = deals.reduce((s, d) => s + d.holdingCosts, 0);
  const commissions = deals.reduce((s, d) => s + d.commission, 0);

  return (
    <Modal
      title={won ? 'Target reached' : 'Campaign over'}
      subtitle={level.name}
      width={640}
      dismissable={false}
    >
          <div className={`verdict ${won ? 'strong' : 'loss'}`} style={{ marginBottom: 18 }}>
            {state.outcomeMessage}
          </div>

          <div className="kv">
            <span className="k">Final net worth</span>
            <span className="v">{money(netWorth(state))}</span>
          </div>
          <div className="kv">
            <span className="k">Days played</span>
            <span className="v">{state.day}</span>
          </div>
          <div className="kv">
            <span className="k">Flips completed</span>
            <span className="v">
              {deals.length} ({wins} profitable
              {deals.length > 0 && <span className="faint">, {percent(wins / deals.length, 0)}</span>})
            </span>
          </div>
          <div className="kv total">
            <span className="k">Profit from flipping</span>
            <span className={`v ${profit >= 0 ? 'good' : 'bad'}`}>{money(profit)}</span>
          </div>

          <div className="scope-group-label" style={{ marginTop: 18 }}>
            What the business cost you
          </div>
          <div className="kv">
            <span className="k">Agent commissions</span>
            <span className="v bad">{money(commissions)}</span>
          </div>
          <div className="kv">
            <span className="k">Carrying costs</span>
            <span className="v bad">{money(carried)}</span>
          </div>
          <div className="kv">
            <span className="k">Concessions for unrepaired defects</span>
            <span className="v bad">{money(conceded)}</span>
          </div>

          {conceded > commissions * 0.5 && conceded > 0 && (
            <p className="warn" style={{ fontSize: 13, marginTop: 14 }}>
              Concessions ran high. Buyers charge about 15% more than the repair would have cost, so
              curing known defects during the rehab is nearly always cheaper than carrying them to
              closing.
            </p>
          )}

          <div className="btn-row" style={{ marginTop: 22 }}>
            <button className="btn primary" onClick={() => startGame(state.levelId)}>
              Play {level.name} again
            </button>
            <button className="btn" onClick={quitToMenu}>
              Back to menu
            </button>
          </div>
    </Modal>
  );
}
