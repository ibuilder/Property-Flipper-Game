import { ECON, skillCost, trainSkill, type SkillId } from '../../engine';
import { money } from '../format';
import { useAction, useGame } from '../store';

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

  return (
    <>
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
