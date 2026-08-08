import { useState } from 'react';
import type { ExplainLine } from '../../engine';

/**
 * Renders an explanation as label / formula / your numbers / result.
 *
 * Collapsed by default: the analyzer's job is to give an answer fast, and the
 * working is there for the moment the player wants to know why. Expanding it
 * is how a rule of thumb turns into something they can reproduce on paper.
 */
export default function ExplainTable({
  title,
  lines,
  defaultOpen = false,
}: {
  title: string;
  lines: ExplainLine[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (lines.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <button
        className="btn small"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ width: '100%', textAlign: 'left' }}
      >
        {open ? '▾' : '▸'} {title}
      </button>

      {open && (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>Formula</th>
                <th>Your numbers</th>
                <th className="right">Result</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} style={l.emphasis ? { background: 'var(--accent-dim)' } : undefined}>
                  <td style={{ fontWeight: l.emphasis ? 600 : 400 }}>{l.label}</td>
                  <td className="num dim" style={{ fontSize: 11.5, whiteSpace: 'normal' }}>
                    {l.formula}
                  </td>
                  <td className="faint" style={{ fontSize: 11.5, whiteSpace: 'normal' }}>
                    {l.plugged}
                  </td>
                  <td className="right num" style={{ fontWeight: l.emphasis ? 600 : 400 }}>
                    {l.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
