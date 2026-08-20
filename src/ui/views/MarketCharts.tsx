import { ARCS, NEIGHBORHOODS_BY_ID, arcIsVisible, type GameState } from '../../engine';
import { money, moneyShort, percent } from '../format';
import { ChartData, LineChart, SERIES, Sparkline } from '../graphics/Charts';
import { Icon } from '../components/Art';
import EmptyState from '../components/EmptyState';

/**
 * The time-series panels.
 *
 * Market index and interest rate are separate charts on purpose. They are
 * different measures on different scales, and putting them on one plot with
 * two y-axes is the single most misleading thing a chart can do.
 */
export default function MarketCharts({ state }: { state: GameState }) {
  const h = state.history;

  if (h.length < 2) {
    return (
      <div className="panel">
        <div className="panel-head">
          <Icon name="trending-up" />
            <h2>Trends</h2>
        </div>
        <EmptyState
          title="No history to plot yet"
          preview={['Price per sqft', 'Market index', 'Interest rate', 'Days on market']}
          hint="Advance the clock. The first points appear within a few days."
        >
          The market moves under you whether you are watching or not, and these lines are how you
          see it coming: what the street is paying, how long houses are sitting, and what money
          costs. Sampled every few days, so a campaign has a shape rather than a snapshot.
        </EmptyState>
      </div>
    );
  }

  const last = h[h.length - 1];
  const first = h[0];
  const hoods = Object.keys(last.neighborhoods);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Your position</h2>
        </div>
        <div className="panel-body">
          <div className="chart-block">
            <div className="chart-title">
              <h3>Net worth</h3>
              <span
                className={`now ${last.netWorth >= first.netWorth ? 'good' : 'bad'}`}
              >
                {money(last.netWorth)}{' '}
                <span className="faint">
                  ({last.netWorth >= first.netWorth ? '+' : ''}
                  {moneyShort(last.netWorth - first.netWorth)} since day {first.day})
                </span>
              </span>
            </div>
            <LineChart
              data={h.map((p) => ({ x: p.day, y: p.netWorth }))}
              format={(v) => moneyShort(v)}
              baseline={first.netWorth}
            />
            <ChartData
              data={h.map((p) => ({ x: p.day, y: p.netWorth }))}
              format={(v) => money(v)}
              label="Net worth"
            />
          </div>

          <div className="chart-block">
            <div className="chart-title">
              <h3>Cash</h3>
              <span className={`now ${last.cash < 0 ? 'bad' : ''}`}>{money(last.cash)}</span>
            </div>
            <LineChart
              data={h.map((p) => ({ x: p.day, y: p.cash }))}
              format={(v) => moneyShort(v)}
              baseline={0}
              height={120}
            />
            <ChartData
              data={h.map((p) => ({ x: p.day, y: p.cash }))}
              format={(v) => money(v)}
              label="Cash"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>The market</h2>
        </div>
        <div className="panel-body">
          <div className="chart-block">
            <div className="chart-title">
              <h3>Market index</h3>
              <span className={`now ${last.marketIndex >= 1 ? 'good' : 'bad'}`}>
                {last.marketIndex.toFixed(3)}
              </span>
            </div>
            <LineChart
              data={h.map((p) => ({ x: p.day, y: p.marketIndex }))}
              format={(v) => v.toFixed(2)}
              baseline={1}
            />
            <ChartData
              data={h.map((p) => ({ x: p.day, y: p.marketIndex }))}
              format={(v) => v.toFixed(3)}
              label="Market index"
            />
          </div>

          <div className="chart-block">
            <div className="chart-title">
              <h3>Interest rate</h3>
              <span className="now">{percent(last.interestRate, 2)}</span>
            </div>
            <LineChart
              data={h.map((p) => ({ x: p.day, y: p.interestRate }))}
              format={(v) => `${(v * 100).toFixed(1)}%`}
              color={SERIES.primary}
              height={120}
            />
            <ChartData
              data={h.map((p) => ({ x: p.day, y: p.interestRate }))}
              format={(v) => percent(v, 2)}
              label="Interest rate"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Neighborhoods</h2>
          <span className="faint" style={{ fontSize: 12 }}>
            index since day {first.day}
          </span>
        </div>
        <div className="panel-body">
          {/* Small multiples rather than six series on one plot: one hue each,
              no legend needed, and no colour-vision problem to solve. */}
          <div className="spark-grid">
            {hoods.map((id) => {
              const hood = NEIGHBORHOODS_BY_ID[id];
              const series = h.map((p) => ({ x: p.day, y: p.neighborhoods[id] ?? 1 }));
              const now = series[series.length - 1].y;
              const start = series[0].y;
              const delta = now - start;
              const arc = state.world.arcs.find(
                (a) => a.neighborhoodId === id && arcIsVisible(a, state.day),
              );
              return (
                <div className="spark-cell" key={id}>
                  <div className="name">
                    {hood?.name ?? id}
                    {arc && (
                      <span
                        className={`pill ${arc.kind === 'gentrifying' ? 'good' : 'bad'}`}
                        style={{ marginLeft: 6 }}
                        title={ARCS[arc.kind].blurb}
                      >
                        {arc.kind}
                      </span>
                    )}
                  </div>
                  <div className={`val ${delta >= 0 ? 'good' : 'bad'}`}>
                    {now.toFixed(3)} <span className="faint">({delta >= 0 ? '+' : ''}
                    {(delta * 100).toFixed(1)}%)</span>
                  </div>
                  <Sparkline data={series} color={SERIES.primary} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
