import { ECON } from '../../engine';
import Modal from '../components/Modal';
import { money, percent } from '../format';

/**
 * How to play, and the vocabulary behind it.
 *
 * The game is about a real skill, so the help screen teaches the actual
 * concepts rather than describing buttons. Everything here matches the numbers
 * the simulation runs on -- the constants are read from ECON so the two cannot
 * drift apart.
 */
export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="How to flip a house"
      subtitle="The loop, the vocabulary, and the arithmetic that decides it"
      onClose={onClose}
      width={860}
    >
      <div className="panel">
        <div className="panel-head">
          <h2>The loop</h2>
        </div>
        <div className="panel-body">
          <Step
            n={1}
            title="Screen the market"
            body="Every listing shows an asking price and your estimate of as-is value. Those are different numbers, and the gap between them is not the deal — it is only where the conversation starts. Distressed properties are where the margin lives, because their as-is value is far below what they are worth repaired."
          />
          <Step
            n={2}
            title="Choose your comps"
            body="Your estimate is a median price per square foot across the comparable sales you select, and nothing adjusts for a mismatch on your behalf. A good comp is the same size, in the same area, sold recently, in a similar state. Smaller homes carry a higher price per foot, so leaning on one that is much smaller — or on a pricier street — pushes your estimate up and your maximum offer with it. Watch the confidence range: when it widens, your evidence is disagreeing with itself."
          />
          <Step
            n={3}
            title="Read the seller"
            body="An estate sale and a developer are not the same conversation. Estates and tired landlords discount to be finished and concede most of what an inspection finds. A developer runs the same numbers you do, holds price, and concedes far less. Retail sellers are slow to move and slow to drop."
          />
          <Step
            n={4}
            title="Inspect before you offer"
            body={`A standard inspection costs ${money(ECON.INSPECTION.standard.cost)} and finds about ${percent(ECON.INSPECTION.standard.revealRate, 0)} of what is wrong; a thorough one costs ${money(ECON.INSPECTION.thorough.cost)} and finds about ${percent(ECON.INSPECTION.thorough.revealRate, 0)}. Findings are disclosed to the seller, who has to concede or lose the deal. That renegotiation is the entire economic point of due diligence — and if the numbers stop working, you have not bought anything yet.`}
          />
          <Step
            n={5}
            title="Scope the work"
            body="Pick line items. Cosmetic work on a house that needs a gut leaves the condition — and therefore the ARV — far short of what your numbers assumed. Match the scope to the house."
          />
          <Step
            n={6}
            title="Run the numbers"
            body="The Deal Analyzer shows two max-offer figures side by side. When they disagree, the itemised one is right."
          />
          <Step
            n={7}
            title="Offer"
            body="The seller has a reserve you cannot see. Rejected offers cost nothing but a day, and listings that sit get cheaper as the seller's patience erodes."
          />
          <Step
            n={8}
            title="Renovate"
            body="Hidden defects surface mid-job as change orders. They draw from your contingency first; once that is gone they come straight out of cash. Meanwhile the carry runs every single day."
          />
          <Step
            n={9}
            title="Sell, then read the post-mortem"
            body="List price drives buyer traffic steeply — overpricing costs months of carry, not a little time. Anything you left unrepaired comes back as a buyer's concession at 1.15× what the fix would have cost. Afterwards, the Track record tab compares what you underwrote against what happened and names which assumption was wrong."
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>The 70% rule</h2>
        </div>
        <div className="panel-body">
          <p style={{ marginTop: 0 }}>
            The industry's back-of-envelope screen for a maximum allowable offer:
          </p>
          <div
            className="num"
            style={{
              background: 'var(--bg-inset)',
              padding: '12px 14px',
              borderRadius: 'var(--radius)',
              fontSize: 15,
              margin: '0 0 12px',
            }}
          >
            MAO = (ARV &times; {ECON.RULE_OF_THUMB}) &minus; repair costs
          </div>
          <p style={{ marginTop: 0 }}>
            The 30% you take off the top is <strong>not profit</strong>. It has to cover closing
            costs, financing points and interest, months of carrying costs, and the agent
            commission, with profit as whatever survives. That is why the rule works on a typical
            deal and breaks on an atypical one &mdash; an expensive neighborhood, a long schedule,
            or high rates will eat the whole allowance.
          </p>
          <p style={{ marginBottom: 0 }}>
            The analyzer always shows the itemised calculation next to it, and explains the gap
            whenever the two disagree materially. Trust the itemised number.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Every cost, and what it runs</h2>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cost</th>
                  <th className="right">Rate</th>
                  <th>When it bites</th>
                </tr>
              </thead>
              <tbody>
                <Cost
                  name="Buy-side closing"
                  rate={percent(ECON.BUY_CLOSING_RATE, 0)}
                  when="At purchase, on top of the price"
                />
                <Cost
                  name="Hard money points"
                  rate={percent(ECON.LOAN_POINTS, 0)}
                  when="Deducted from the funding wire — you never see it"
                />
                <Cost
                  name="Hard money interest"
                  rate={`rate + ${percent(ECON.LOAN_SPREAD, 1)}`}
                  when={`Daily, interest-only, balloon due in ${ECON.LOAN_TERM_DAYS} days`}
                />
                <Cost name="Property tax" rate="0.9%–1.7%/yr" when="Daily, by neighborhood" />
                <Cost
                  name="Vacant insurance"
                  rate={percent(ECON.INSURANCE_RATE, 1) + '/yr'}
                  when="Daily, while you hold it"
                />
                <Cost
                  name="Utilities & HOA"
                  rate={`${money(ECON.UTILITIES_MONTHLY)}/mo +HOA`}
                  when="Daily, whether or not work is happening"
                />
                <Cost
                  name="Agent commission"
                  rate={percent(ECON.COMMISSION_RATE, 0)}
                  when="On sale, off the top"
                />
                <Cost
                  name="Seller closing"
                  rate={percent(ECON.SELL_CLOSING_RATE, 0)}
                  when="On sale"
                />
                <Cost
                  name="Buyer concession"
                  rate="1.15× repair"
                  when="At closing, for every defect you left unrepaired"
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Glossary</h2>
        </div>
        <div className="panel-body">
          <Term
            term="ARV"
            def="After Repair Value — what the house is worth once your scope is complete. Every other number depends on it, so an ARV that is 10% optimistic quietly destroys a 15% margin."
          />
          <Term
            term="MAO"
            def="Maximum Allowable Offer — the most you can pay and still clear your target profit."
          />
          <Term
            term="Comp"
            def="A comparable sale. Comps are similar, never identical, which is why your estimate carries a range rather than a number — and why which ones you choose is a decision, not a formality."
          />
          <Term
            term="Carry"
            def="The daily cost of simply owning the property: taxes, insurance, utilities, HOA, and loan interest. It is what punishes a slow sale."
          />
          <Term
            term="Change order"
            def="Work discovered after the job started, usually a defect nobody could see until a wall came open. Unavoidable and unbudgeted."
          />
          <Term
            term="Contingency"
            def={`A reserve held in escrow against change orders, released back to you if unused. ${percent(0.15, 0)} of scope is a common starting point.`}
          />
          <Term
            term="Days on market (DOM)"
            def="How long a listing has sat. A stale listing means a more flexible seller — and when you are the seller, it means carry you are not getting back."
          />
          <Term
            term="Hard money"
            def={`Short-term asset-backed lending at ${percent(ECON.MAX_LTV, 0)} of the purchase price. It frees cash for the rehab, but if you have not sold by maturity the lender takes the house.`}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Ways people lose money here</h2>
        </div>
        <div className="panel-body">
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              Building an ARV on convenient comps. A bigger house or a better street is not your
              house, and the error carries into every number downstream.
            </li>
            <li>Paying near ARV because the house is nice. The house being nice is priced in.</li>
            <li>
              Skipping the inspection to save {money(ECON.INSPECTION.standard.cost)}, then meeting
              the same defects as change orders at full price with no seller concession.
            </li>
            <li>
              Budgeting no contingency, so the first surprise comes out of the cash you needed for
              the rest of the job.
            </li>
            <li>
              Listing above value and waiting. Buyer traffic falls off a cliff above true value, and
              the carry never stops.
            </li>
            <li>
              Leaving a known defect unrepaired. The buyer's inspector finds it and asks for more
              than the repair would have cost.
            </li>
            <li>
              Using leverage on a long schedule. Points are charged up front and the balloon does
              not care whether the house sold.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div
        className="num"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: 12,
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div className="dim" style={{ fontSize: 13, lineHeight: 1.55 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function Cost({ name, rate, when }: { name: string; rate: string; when: string }) {
  return (
    <tr>
      <td style={{ fontWeight: 500 }}>{name}</td>
      <td className="right num">{rate}</td>
      <td className="dim" style={{ whiteSpace: 'normal' }}>
        {when}
      </td>
    </tr>
  );
}

function Term({ term, def }: { term: string; def: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontWeight: 600 }}>{term}</span>
      <span className="dim" style={{ fontSize: 13, lineHeight: 1.55 }}>
        {' '}
        &mdash; {def}
      </span>
    </div>
  );
}
