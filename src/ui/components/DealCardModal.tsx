import { useMemo, useState } from 'react';
import type { ClosedDeal } from '../../engine';
import { CARD_H, CARD_W, dealCard } from '../dealCard';
import Modal from './Modal';

/**
 * The deal card, on screen and on its way out.
 *
 * Two ways off the machine, because the two builds can do different things.
 * The clipboard works everywhere Chromium does, which covers the desktop app
 * and the browser build alike, and is the one people will actually use -- most
 * sharing is a paste. Saving a file is offered alongside it as a `data:` URL on
 * an anchor, which needs no bridge and no new IPC surface.
 *
 * The PNG is drawn through a canvas rather than handed over as SVG, because
 * every place a card is likely to end up -- a chat window, a forum, a slide --
 * takes a bitmap and roughly half of them will not render an SVG at all.
 */
export default function DealCardModal({
  deal,
  onClose,
}: {
  deal: ClosedDeal;
  onClose: () => void;
}) {
  const [handle, setHandle] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const svg = useMemo(() => dealCard(deal, handle), [deal, handle]);
  const src = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg],
  );

  /** Rasterise at 2x, so the card survives being looked at on a good screen. */
  const toPng = async (): Promise<Blob | null> => {
    const img = new Image();
    img.src = src;
    try {
      await img.decode();
    } catch {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W * 2;
    canvas.height = CARD_H * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  const copy = async () => {
    const blob = await toPng();
    if (!blob) {
      setNote('Could not draw the card.');
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setNote('Card copied. Paste it anywhere that takes an image.');
    } catch {
      setNote('This build will not let a page write images to the clipboard. Save it instead.');
    }
  };

  const save = async () => {
    const blob = await toPng();
    if (!blob) {
      setNote('Could not draw the card.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const a = document.createElement('a');
      a.href = String(reader.result);
      a.download = `${deal.address.replace(/[^\w-]+/g, '-').toLowerCase()}.png`;
      a.click();
      setNote('Saved.');
    };
    reader.readAsDataURL(blob);
  };

  return (
    <Modal onClose={onClose} title={`${deal.address} — deal card`} width={760}>
      <div className="panel-body">
        <img
          src={src}
          alt={`Deal card for ${deal.address}: ${
            deal.netProfit >= 0 ? 'profit' : 'loss'
          } of ${Math.abs(deal.netProfit).toLocaleString('en-US')} dollars over ${deal.daysHeld} days.`}
          style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid var(--color-divider)' }}
        />

        <label className="field" style={{ marginTop: 14, display: 'block' }}>
          <span className="k">Sign it (optional)</span>
          <input
            type="text"
            value={handle}
            maxLength={28}
            placeholder="your name or handle"
            onChange={(e) => setHandle(e.target.value)}
          />
        </label>

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => void copy()}>
            Copy image
          </button>
          <button className="btn" onClick={() => void save()}>
            Save PNG
          </button>
        </div>
        {note && (
          <p className="dim" style={{ marginTop: 10, fontSize: 12 }}>
            {note}
          </p>
        )}
      </div>
    </Modal>
  );
}
