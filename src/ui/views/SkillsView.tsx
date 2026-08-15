import {
  ECON,
  REPUTATION_META,
  crewFactors,
  crewUtilisation,
  crewWeeklyCost,
  disbandCrew,
  hireCrew,
  hireCrewCost,
  levelProgress,
  reputationLabel,
  resizeCrew,
  skillCost,
  spendExperience,
  trainSkill,
  xpToNextLevel,
  type ReputationId,
  type SkillId,
} from '../../engine';
import { money, percent } from '../format';
import { useAction, useGame } from '../store';
import MasteryPanel from '../components/MasteryPanel';
import { Icon } from '../components/Art';

const SKILLS: { id: SkillId; name: string; blurb: string; effect: (lvl: number) => string }[] = [
  {
    id: 'negotiation',
    name: 'Negotiation',
    blurb:
      'Makes the same offer more persuasive to a seller. Does not change the number you type -- changes whether it gets taken.',
    effect: (l) => `Offers land as if ${(l * 1.8).toFixed(1)}% higher`,
  },
  {
    id: 'analysis',
    name: 'Analysis',
    blurb:
      'Tighter comps and sharper inspections. The single highest-leverage skill, because every other decision is downstream of your ARV estimate.',
    effect: (l) => `${(l * 9).toFixed(0)}% less valuation error, +${l * 3}% inspection reveal`,
  },
  {
    id: 'management',
    name: 'Project management',
    blurb:
      'Cheaper materials, faster crews, and fewer nasty surprises once the walls are open.',
    effect: (l) => `${(l * 3.5).toFixed(1)}% cheaper, ${l * 5}% faster, fewer change orders`,
  },
  {
    id: 'marketing',
    name: 'Marketing',
    blurb: 'More buyer traffic at any given price, which shortens days on market and your carry.',
    effect: (l) => `${l * 7}% more buyer interest`,
  },
];

export default function SkillsView() {
  const state = useGame();
  const act = useAction();
  if (!state) return null;

  const exp = state.experience;
  const crew = state.crew;
  const activeJobs = state.portfolio.filter((p) => p.ownership?.renovation).length;
  const factors = crewFactors(crew, Math.max(1, activeJobs));

  return (
    <>
      {/* What has been proved, above what has been bought. */}
      <MasteryPanel deals={state.closedDeals} />

      <div className="panel">
        <div className="panel-head">
          <h2>Experience</h2>
          <span className="pill info">Level {exp.level}</span>
        </div>
        <div className="panel-body">
          <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
            The third currency, and the only one you cannot buy or hurry. Skills cost money and
            reputation is given to you by other people; experience is what is left over &mdash;
            what you know because you have done it. Every level is a skill point, spent wherever
            you like.
          </p>

          <div className="kv">
            <span className="k">Toward level {exp.level + 1}</span>
            <span className="v">
              {exp.level >= ECON.XP.maxLevel
                ? 'at the cap'
                : `${xpToNextLevel(exp).toLocaleString()} xp to go`}
            </span>
          </div>
          <div className="bar good" style={{ marginBottom: 12 }}>
            <span style={{ width: `${levelProgress(exp) * 100}%` }} />
          </div>

          {exp.unspentPoints > 0 ? (
            <>
              <div className="verdict fair">
                <strong>
                  {exp.unspentPoints} unspent point{exp.unspentPoints === 1 ? '' : 's'}
                </strong>
                Put them where the next deal needs them.
              </div>
              <div className="btn-row" style={{ marginTop: 10 }}>
                {SKILLS.map((s) => (
                  <button
                    key={s.id}
                    className="btn"
                    disabled={state.skills[s.id] >= ECON.MAX_SKILL_LEVEL}
                    onClick={() => act((g) => spendExperience(g, s.id))}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="faint" style={{ fontSize: 12, margin: 0 }}>
              Earned by closing purchases, finishing sales, winning at auction, letting and
              refinancing. A deal that lost money still teaches you something, so it still pays.
            </p>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <Icon name="users" />
            <h2>Your crew</h2>
          {crew && (
            <span className={`pill ${crewUtilisation(crew) > 0.6 ? 'good' : 'warn'}`}>
              {percent(crewUtilisation(crew), 0)} utilised
            </span>
          )}
        </div>
        <div className="panel-body">
          <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
            Subs are expensive per job and cost nothing when there is no work. Your own people are
            cheaper, faster and spot trouble earlier &mdash; and are owed wages on every day where
            every house you own is sitting on the market waiting for a buyer. That is the whole
            decision, and it is the one that decides whether this scales past one house at a time.
          </p>

          {crew ? (
            <>
              <div className="kv">
                <span className="k">On the payroll</span>
                <span className="v">
                  {crew.size} &middot; {money(crewWeeklyCost(crew.size))}/week
                </span>
              </div>
              <div className="kv">
                <span className="k">Days worked / idle</span>
                <span className="v">
                  {crew.workingDays} / <span className="bad">{crew.idleDays}</span>
                </span>
              </div>
              <div className="kv">
                <span className="k">Wages paid</span>
                <span className="v bad">{money(crew.wagesPaid)}</span>
              </div>
              <div className="kv">
                <span className="k">
                  Effect on a job now
                  <br />
                  <span className="faint" style={{ fontSize: 11 }}>
                    {activeJobs} job{activeJobs === 1 ? '' : 's'} running against {crew.size} on the
                    payroll
                  </span>
                </span>
                <span className="v">
                  {percent(1 - factors.cost, 0)} cheaper,{' '}
                  <span className={factors.time <= 1 ? 'good' : 'bad'}>
                    {factors.time <= 1
                      ? `${percent(1 - factors.time, 0)} faster`
                      : `${percent(factors.time - 1, 0)} slower`}
                  </span>
                </span>
              </div>
              {factors.time > 1 && (
                <div className="verdict thin" style={{ marginTop: 10 }}>
                  <strong>Spread too thin</strong>
                  More jobs than people. They can only be in one place at a time, and you have
                  stopped calling subs &mdash; so this is now slower than subcontracting all of it.
                </div>
              )}
              {crew.idleDays > crew.workingDays && crew.idleDays > 20 && (
                <div className="verdict thin" style={{ marginTop: 10 }}>
                  <strong>Idle more than working</strong>
                  {money(crew.wagesPaid)} in wages so far. A crew pays for itself somewhere around
                  two-thirds utilisation; below half it is just a fixed cost.
                </div>
              )}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button
                  className="btn"
                  disabled={crew.size >= ECON.CREW.maxSize}
                  onClick={() => act((g) => resizeCrew(g, crew.size + 1))}
                >
                  Hire one more &mdash; {money(hireCrewCost(1))}
                </button>
                <button
                  className="btn"
                  disabled={crew.size <= 1}
                  onClick={() => act((g) => resizeCrew(g, crew.size - 1))}
                >
                  Let one go
                </button>
                <button className="btn danger" onClick={() => act(disbandCrew)}>
                  Disband
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="kv">
                <span className="k">Cost to sign on</span>
                <span className="v">{money(hireCrewCost(1))} each</span>
              </div>
              <div className="kv">
                <span className="k">Wages</span>
                <span className="v bad">{money(crewWeeklyCost(1))}/week each</span>
              </div>
              <div className="kv">
                <span className="k">What they buy you</span>
                <span className="v">
                  {percent(1 - ECON.CREW.costFactor, 0)} cheaper,{' '}
                  {percent(1 - ECON.CREW.timeFactor, 0)} faster,{' '}
                  {percent(1 - ECON.CREW.changeOrderFactor, 0)} fewer surprises
                </span>
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    className="btn"
                    disabled={state.cash < hireCrewCost(n)}
                    onClick={() => act((g) => hireCrew(g, n))}
                  >
                    Hire {n} &mdash; {money(hireCrewCost(n))}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <Icon name="badge-check" />
            <h2>Reputation</h2>
          <span className="faint" style={{ fontSize: 12 }}>
            earned, not bought
          </span>
        </div>
        <div className="panel-body">
          <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
            Skills are things you pay for. Reputation is what a track record buys you, and it is
            what makes a fifth flip easier than a first. It moves on outcomes: finishing jobs you
            funded properly, closing sales without cutting the price three times, and above all not
            handing a lender back the keys.
          </p>
          <div className="grid-3" style={{ marginTop: 14 }}>
            {(Object.keys(REPUTATION_META) as ReputationId[]).map((id) => {
              const v = state.reputation[id];
              const meta = REPUTATION_META[id];
              const label = reputationLabel(v);
              return (
                <div key={id}>
                  <div className="chart-title">
                    <h3>{meta.name}</h3>
                    <span className={`pill ${label.tone}`}>{label.text}</span>
                  </div>
                  <div className={`bar ${label.tone === 'bad' ? 'bad' : label.tone === 'warn' ? 'warn' : 'good'}`}>
                    <span style={{ width: `${v}%` }} />
                  </div>
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.45 }}>
                    {meta.blurb}
                  </div>
                  <div className="num" style={{ fontSize: 11.5, marginTop: 4 }}>
                    {meta.effect(v)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {SKILLS.map((skill) => {
          const level = state.skills[skill.id];
          const maxed = level >= ECON.MAX_SKILL_LEVEL;
          const cost = maxed ? 0 : skillCost(level);
          return (
            <div className="panel" key={skill.id}>
              <div className="panel-head">
                <h2>{skill.name}</h2>
                <span className="num dim">
                  {level} / {ECON.MAX_SKILL_LEVEL}
                </span>
              </div>
              <div className="panel-body">
                <div className="bar" style={{ marginBottom: 12 }}>
                  <span style={{ width: `${(level / ECON.MAX_SKILL_LEVEL) * 100}%` }} />
                </div>
                <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
                  {skill.blurb}
                </p>
                <div className="kv">
                  <span className="k">Current effect</span>
                  <span className="v">{level === 0 ? 'none' : skill.effect(level)}</span>
                </div>
                {!maxed && (
                  <div className="kv">
                    <span className="k">At level {level + 1}</span>
                    <span className="v good">{skill.effect(level + 1)}</span>
                  </div>
                )}
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button
                    className="btn primary"
                    disabled={maxed || state.cash < cost}
                    onClick={() => act((s) => trainSkill(s, skill.id))}
                  >
                    {maxed ? 'Maxed out' : `Train for ${money(cost)}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="faint" style={{ fontSize: 12 }}>
        Training costs rise {Math.round((ECON.SKILL_COST_FACTOR - 1) * 100)}% per level. Early on,
        that money is almost always better spent as a down payment &mdash; skills compound over a
        long campaign, not a single flip.
      </p>
    </>
  );
}
