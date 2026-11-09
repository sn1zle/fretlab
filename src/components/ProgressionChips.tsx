import React, { useEffect, useRef, useState } from 'react';
import { previewOrder } from '../data/reorder';

export interface ProgChip {
  name: string;
  roman: string;
  diatonic: boolean;
}

/** Movement (px) below which a press is a tap; a mouse drag starts beyond it. */
const DRAG_THRESHOLD = 6;
/** Touch: hold this long (without moving) to pick a chip up; a quick swipe still scrolls the page. */
const LONG_PRESS_MS = 250;

type Drag = {
  from: number;
  to: number;
  id: number;
  touch: boolean;
  x0: number;
  y0: number;
  active: boolean;
  timer: number | null;
  offX: number;
  offY: number;
  w: number;
  h: number;
};

/**
 * The progression as a row of chips. Tap: select / deselect. Drag (mouse) or long-press then
 * drag (touch): move a chip; the others make room live, also across wrapped lines.
 * The chips are reordered with CSS `order`, so nothing moves in the DOM during a gesture.
 */
export const ProgressionChips: React.FC<{
  chips: ProgChip[];
  selected: number | null;
  onTap: (i: number) => void;
  onMove: (from: number, to: number) => void;
}> = ({ chips, selected, onTap, onMove }) => {
  const dragRef = useRef<Drag | null>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // no page scroll while a chip is being dragged by touch (or held for the long-press)
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault();
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => document.removeEventListener('touchmove', onTouchMove);
  }, []);

  const order = drag ? previewOrder(chips.length, drag.from, drag.to) : null;

  const start = (i: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current || (e.pointerType === 'mouse' && e.button !== 0) || chips.length < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const d: Drag = {
      from: i, to: i, id: e.pointerId, touch: e.pointerType !== 'mouse',
      x0: e.clientX, y0: e.clientY, active: false, timer: null,
      offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, h: r.height,
    };
    dragRef.current = d;
    const activate = (x: number, y: number) => {
      d.active = true;
      document.body.style.cursor = 'grabbing';
      setDrag({ from: d.from, to: d.to });
      setGhost({ x: x - d.offX, y: y - d.offY, w: d.w, h: d.h });
    };
    // the drop slot: the chip under the pointer takes the dragged one's place; past the last one: the end
    const target = (x: number, y: number) => {
      const rects = chipRefs.current.map((el) => el?.getBoundingClientRect() ?? null);
      for (let k = 0; k < chips.length; k++) {
        const rc = rects[k];
        if (k === d.from || !rc) continue;
        if (x >= rc.left && x <= rc.right && y >= rc.top - 3 && y <= rc.bottom + 3) {
          const shown = previewOrder(chips.length, d.from, d.to);
          return shown.indexOf(k);
        }
      }
      const valid = rects.filter((rc): rc is DOMRect => !!rc);
      const last = valid.reduce((a, b) => (b.top > a.top + 2 || (Math.abs(b.top - a.top) <= 2 && b.right > a.right) ? b : a), valid[0]);
      if (last && (y > last.bottom + 4 || (y >= last.top && x > last.right))) return chips.length - 1;
      const first = valid.reduce((a, b) => (b.top < a.top - 2 || (Math.abs(b.top - a.top) <= 2 && b.left < a.left) ? b : a), valid[0]);
      if (first && (y < first.top - 4 || (y <= first.bottom && x < first.left))) return 0;
      return d.to;
    };
    const finish = (commit: boolean) => {
      if (d.timer !== null) window.clearTimeout(d.timer);
      window.removeEventListener('pointermove', onMoveEv);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      dragRef.current = null;
      if (!d.active) return;
      document.body.style.cursor = '';
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 50);
      setDrag(null);
      setGhost(null);
      if (commit && d.to !== d.from) onMove(d.from, d.to);
    };
    const onMoveEv = (ev: PointerEvent) => {
      if (ev.pointerId !== d.id) return;
      const moved = Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) >= DRAG_THRESHOLD;
      if (!d.active) {
        if (!moved) return;
        if (d.touch) return finish(false); // moved before the long-press: a scroll, not a drag
        activate(ev.clientX, ev.clientY);
      }
      ev.preventDefault();
      setGhost({ x: ev.clientX - d.offX, y: ev.clientY - d.offY, w: d.w, h: d.h });
      const t = target(ev.clientX, ev.clientY);
      if (t !== d.to) {
        d.to = t;
        setDrag({ from: d.from, to: t });
      }
    };
    const onUp = (ev: PointerEvent) => { if (ev.pointerId === d.id) finish(true); };
    const onCancel = (ev: PointerEvent) => { if (ev.pointerId === d.id) finish(false); };
    window.addEventListener('pointermove', onMoveEv, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    if (d.touch) d.timer = window.setTimeout(() => { d.timer = null; if (dragRef.current === d) activate(d.x0, d.y0); }, LONG_PRESS_MS);
  };

  const dragged = drag ? chips[drag.from] : null;
  return (
    <>
      {chips.map((c, i) => {
        const isDragged = drag?.from === i;
        const sel = selected === i;
        return (
          <button
            key={i}
            ref={(el) => { chipRefs.current[i] = el; }}
            type="button"
            data-prog-chip={i}
            onPointerDown={(e) => start(i, e)}
            onClick={() => { if (!suppressClick.current) onTap(i); }}
            onContextMenu={(e) => { if (dragRef.current) e.preventDefault(); }}
            style={{ order: order ? order.indexOf(i) + 1 : i + 1, WebkitTouchCallout: 'none', touchAction: drag ? 'none' : undefined }}
            className={`flex flex-col items-center px-2.5 py-1 rounded-md border font-mono select-none ${drag ? '' : 'transition'} ${
              isDragged
                ? 'border-dashed border-zinc-600 text-transparent bg-transparent'
                : sel
                  ? 'bg-zinc-700 border-zinc-500 text-zinc-100 cursor-pointer'
                  : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer'
            }`}
          >
            <span className="text-sm">{c.name}</span>
            <span className={`text-[10px] ${isDragged ? 'text-transparent' : c.diatonic ? 'text-zinc-500' : 'text-amber-200/50'}`}>{c.roman}</span>
          </button>
        );
      })}
      {dragged && ghost && (
        <div
          aria-hidden
          className={`fixed z-50 pointer-events-none flex flex-col items-center justify-center px-2.5 py-1 rounded-md border font-mono shadow-lg shadow-black/50 ${
            selected === drag?.from ? 'bg-zinc-700 border-zinc-300 text-zinc-100' : 'bg-zinc-800 border-zinc-400 text-zinc-200'
          }`}
          style={{ left: ghost.x, top: ghost.y - 3, width: ghost.w, height: ghost.h, transform: 'scale(1.06)' }}
        >
          <span className="text-sm">{dragged.name}</span>
          <span className={`text-[10px] ${dragged.diatonic ? 'text-zinc-400' : 'text-amber-200/60'}`}>{dragged.roman}</span>
        </div>
      )}
    </>
  );
};
