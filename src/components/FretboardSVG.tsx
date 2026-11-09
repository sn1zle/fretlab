import React, { useEffect, useRef, useState } from 'react';
import {
  DIATONIC_DEGREES,
  type LabelMode,
  type NoteName,
  type RomanDegree,
  STANDARD_STRINGS,
  type Tuning,
  VISUALIZATION_TYPES,
  type VisualizationType,
  PENTA_OVERLAYS,
  type PentaOverlayId,
  MODE_COLOUR_FILL,
  MODE_COLOUR_TEXT,
  getNoteNameForKey,
  type SolopathChord,
  type SoloRegionOverride,
  SOLO_MAX_BOX_FRETS,
  soloGrowDir,
  soloResize,
  SOLO_PALETTE,
  soloNoteStyle,
  soloIsPinned,
  soloIsDrag,
  soloDragSnap,
} from '../data/musicTheory';
import { guitarSynth } from '../audio/guitarSynth';

interface FretboardSVGProps {
  parentKey: NoteName;
  focusRootChroma: number;
  activeDegree: RomanDegree;
  onSelectDegree: (roman: RomanDegree) => void;
  visType: VisualizationType;
  onChangeVisType: (type: VisualizationType) => void;
  semitones: Record<number, string>;
  labelMode: LabelMode;
  onChangeLabelMode: (mode: LabelMode) => void;
  /** Shape only: plain white circles, no names, intervals or role colours */
  shapeOnly?: boolean;
  onChangeShapeOnly?: (on: boolean) => void;
  fretCount?: number;
  characterOffsets: number[];
  avoidOffsets: number[];
  showTension: boolean;
  onToggleTension: () => void;
  shapeCount: number;
  shapeLabels?: string[];
  /** Selected shape indices; empty = All. */
  shapeSelection: number[];
  /** null = All; number = toggle that shape in/out of the selection. */
  onToggleShape: (idx: number | null) => void;
  /** Show octave repeats of box shapes (+12 frets). Hidden for string-set views. */
  shapeOctaves?: boolean;
  onChangeShapeOctaves?: (on: boolean) => void;
  shapeCells: Set<string> | null;
  shapeRanges: { min: number; max: number }[];
  ghostIntervals?: Record<number, string>;
  /** Pentatonic-only: which scale overlay is active (Off | Blues | modes). */
  pentaOverlay?: PentaOverlayId;
  onChangePentaOverlay?: (id: PentaOverlayId) => void;
  /** Mode implied by current Key+Degree (highlights Ionian…Locrian after remap). */
  degreeModeId?: Exclude<PentaOverlayId, 'off' | 'blues'>;
  /** Interval labels for overlay notes (semitone → label); empty when Off. */
  overlayIntervals?: Record<number, string>;
  /** When set (shape selected), only these cells get mode-colour dots (one-pass). */
  overlayCells?: Set<string> | null;
  /** Solid fill for mode-colour notes (palette per mode). */
  modeColourFill?: string;
  /** When set, replaces the normal note rendering with the Solopath view. */
  solopath?: { chords: SolopathChord[]; focus: number } | null;
  /** Manual box changes per region, and the setter (null = back to the planned box). */
  soloOverrides?: (SoloRegionOverride | null)[];
  onSoloOverride?: (index: number, ov: SoloRegionOverride | null) => void;
  /** Dragging a box: live position (final = false), then the drop (final = true; pos null = cancelled). */
  onSoloPin?: (index: number, pos: SoloPinPos | null, final: boolean) => void;
  /** Open strings, highest first (default: 6-string guitar). */
  tuning?: Tuning;
}

export type SoloPinPos = { fret: number; str: number; w: number; n: number };

/** Solopath notes: one size for every note, like the normal fretboard notes. */
/** One radius for every note circle on the board (labelled, root, ghost, solo, shape-only); rings sit outside it */
const NOTE_R = 13.5;
const SOLO_NOTE_R = NOTE_R;
/** Shape-only mode: every shown note is the same plain white dot */
const SHAPE_NOTE_R = NOTE_R;
const SHAPE_FILL = '#fafafa';
const soloColor = (i: number) => SOLO_PALETTE[((i % SOLO_PALETTE.length) + SOLO_PALETTE.length) % SOLO_PALETTE.length];

export const FretboardSVG: React.FC<FretboardSVGProps> = ({
  parentKey,
  focusRootChroma,
  activeDegree,
  onSelectDegree,
  visType,
  onChangeVisType,
  semitones,
  labelMode,
  onChangeLabelMode,
  shapeOnly = false,
  onChangeShapeOnly,
  fretCount = 24,
  characterOffsets,
  avoidOffsets,
  showTension,
  onToggleTension,
  shapeCount = 0,
  shapeLabels = [],
  shapeSelection = [],
  onToggleShape = () => {},
  shapeOctaves = true,
  onChangeShapeOctaves,
  shapeCells = null,
  shapeRanges = [],
  ghostIntervals = {},
  pentaOverlay = 'off',
  onChangePentaOverlay,
  degreeModeId: _degreeModeId = 'ionian',
  overlayIntervals = {},
  overlayCells = null,
  modeColourFill = MODE_COLOUR_FILL.ionian,
  solopath = null,
  soloOverrides = [],
  onSoloOverride,
  onSoloPin,
  tuning = STANDARD_STRINGS,
}) => {
  const tensionAvailable = visType === 'scale' || visType === 'scale3nps';
  const tensionOn = tensionAvailable && showTension;
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [soloSelRaw, setSoloSel] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // a press on a box: a tap (select / play) until it moves SOLO_DRAG_THRESHOLD px, then a drag
  const soloDragRef = useRef<{
    i: number;
    id: number;
    x0: number;
    y0: number;
    start: { fret: number; str: number; w: number; n: number };
    dragging: boolean;
    last: { fret: number; str: number };
  } | null>(null);
  const soloSuppressClick = useRef(false);
  const [soloDragging, setSoloDragging] = useState<number | null>(null);

  const cols = fretCount + 1; // 0 (open) through 24
  const W = 1680;
  const boardX = 64;
  const boardY = 48;
  const boardW = W - 88;
  // one row per string pair; 42 units apart whatever the string count (4 strings: a shorter neck)
  const nStr = Math.max(1, tuning.length);
  const rowH = 42;
  const boardH = rowH * Math.max(1, nStr - 1);
  const colW = boardW / cols;

  const cx = (fret: number) => boardX + (fret + 0.5) * colW;
  const cy = (stringIdx: number) => boardY + stringIdx * rowH;

  const singleInlayFrets = [3, 5, 7, 9, 15, 17, 19, 21];
  const doubleInlayFrets = [12, 24];
  const markedFrets = [...singleInlayFrets, ...doubleInlayFrets];

  const soloChords = solopath && Array.isArray(solopath.chords) ? solopath.chords : [];
  const soloActive = soloChords.length > 0;
  const H = (soloActive ? 306 : 310) - (210 - boardH); // solo: fret numbers move below the board, labels sit at their regions
  const soloFocus = soloActive
    ? Math.min(Math.max(solopath?.focus ?? 0, 0), soloChords.length - 1)
    : 0;
  const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  const soloSel = soloActive && soloSelRaw !== null && soloSelRaw < soloChords.length ? soloSelRaw : null;
  useEffect(() => {
    // tapping anywhere outside a box or its toolbar closes the toolbar
    if (soloSel === null) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || !t.closest || !t.closest('[data-solo-keep]')) setSoloSel(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [soloSel]);
  const neckTop = boardY - 14;
  const neckBot = boardY + boardH + 14;
  /** A region: plain rounded rectangle over its strings × frets, clamped inside the neck. */
  const soloRect = (c: SolopathChord) => {
    const strs = Array.isArray(c.strings) && c.strings.length ? c.strings : [0];
    const sTop = Math.min(...strs);
    const sBot = Math.max(...strs);
    const x = boardX + c.region.min * colW + 2;
    const w = (c.region.max - c.region.min + 1) * colW - 4;
    const y = Math.max(neckTop, cy(sTop) - rowH / 2 + 2);
    const y2 = Math.min(neckBot, cy(sBot) + rowH / 2 - 2);
    return { x, y, w, h: y2 - y };
  };
  /** Start tracking a press on box i (mouse, pen or touch). */
  const soloPointerDown = (i: number, e: React.PointerEvent) => {
    if (!onSoloPin || (e.pointerType === 'mouse' && e.button !== 0) || soloDragRef.current) return;
    // touch: the first tap selects the box (the page can still scroll over it), then it can be dragged
    if (e.pointerType === 'touch' && soloSel !== i) return;
    const c = soloChords[i];
    if (!c) return;
    const strs = c.strings.length ? c.strings : [0];
    const start = { fret: c.region.min, str: Math.min(...strs), w: c.region.max - c.region.min + 1, n: strs.length };
    soloDragRef.current = { i, id: e.pointerId, x0: e.clientX, y0: e.clientY, start, dragging: false, last: { fret: start.fret, str: start.str } };
    const svg = svgRef.current;
    const scale = () => {
      const r = svg?.getBoundingClientRect();
      return r && r.width > 0 ? W / r.width : 1; // screen px → SVG units
    };
    const end = (commit: boolean) => {
      const d = soloDragRef.current;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      soloDragRef.current = null;
      if (!d || !d.dragging) return;
      try { svg?.releasePointerCapture(d.id); } catch { /* already released */ }
      document.body.style.cursor = '';
      setSoloDragging(null);
      soloSuppressClick.current = true;
      setTimeout(() => { soloSuppressClick.current = false; }, 0);
      const moved = d.last.fret !== d.start.fret || d.last.str !== d.start.str;
      onSoloPin(d.i, commit && moved ? { ...d.last, w: d.start.w, n: d.start.n } : null, true);
      if (commit) setSoloSel(d.i);
    };
    const onMove = (ev: PointerEvent) => {
      const d = soloDragRef.current;
      if (!d || ev.pointerId !== d.id) return;
      const dx = ev.clientX - d.x0;
      const dy = ev.clientY - d.y0;
      if (!d.dragging) {
        if (!soloIsDrag(dx, dy)) return;
        d.dragging = true;
        try { svg?.setPointerCapture(d.id); } catch { /* pointer gone */ }
        document.body.style.cursor = 'grabbing';
        setSoloDragging(d.i);
      }
      ev.preventDefault();
      const k = scale();
      const p = soloDragSnap(d.start, dx * k, dy * k, colW, rowH, nStr);
      if (p.fret !== d.last.fret || p.str !== d.last.str) {
        d.last = p;
        onSoloPin(d.i, { ...p, w: d.start.w, n: d.start.n }, false);
      }
    };
    const onUp = (ev: PointerEvent) => { if (soloDragRef.current && ev.pointerId === soloDragRef.current.id) end(true); };
    const onCancel = (ev: PointerEvent) => { if (soloDragRef.current && ev.pointerId === soloDragRef.current.id) end(false); };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };
  // while a touch drag runs, the page must not scroll
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onTouchMove = (e: TouchEvent) => { if (soloDragRef.current?.dragging) e.preventDefault(); };
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => svg.removeEventListener('touchmove', onTouchMove);
  }, []);
  const soloLoopHint = (c: SolopathChord) => c.wrap && c.jumpToNext && soloChords.length > 1;
  const soloLabelText = (c: SolopathChord, i: number) => `${i + 1} ${c.name}`;
  const soloLabelSub = (c: SolopathChord) => `${c.shapeLabel && c.shapeLabel !== 'scale' ? c.shapeLabel : ''}${soloLoopHint(c) ? `${c.shapeLabel && c.shapeLabel !== 'scale' ? ' · ' : ''}↺ to 1` : ''}`;
  // Labels: a small tab at the region's top-left corner (outside above, else below, else inside),
  // never on top of another label or a note
  const soloLabelPos = (() => {
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const notes = soloChords.flatMap((c) => (Array.isArray(c.cells) ? c.cells : []).map((x) => ({ x: cx(x.f), y: cy(x.s) })));
    const hits = (b: { x: number; y: number; w: number; h: number }) =>
      b.y < 2 || b.y + b.h > neckBot + 8 || // keep clear of the fret numbers below
      placed.some((p) => b.x < p.x + p.w + 4 && b.x + b.w + 4 > p.x && b.y < p.y + p.h && b.y + b.h > p.y) ||
      notes.some((n) => n.x > b.x - 15 && n.x < b.x + b.w + 15 && n.y > b.y - 15 && n.y < b.y + b.h + 15);
    return soloChords.map((c, i) => {
      const r = soloRect(c);
      const sub = soloLabelSub(c);
      const w = soloLabelText(c, i).length * 7.2 + (sub ? sub.length * 6 + 8 : 0) + 4;
      const h = 13;
      const cands = [
        { x: r.x + 3, y: r.y - h - 2 }, // above, left
        { x: r.x + 3, y: r.y + r.h + 2 }, // below, left
        { x: r.x + r.w - w - 3, y: r.y - h - 2 }, // above, right
        { x: r.x + r.w - w - 3, y: r.y + r.h + 2 }, // below, right
        { x: r.x + 4, y: r.y + 2 }, // inside, top-left
        { x: r.x + 4, y: r.y + r.h - h - 2 }, // inside, bottom-left
      ];
      const pick = cands.find((p) => !hits({ ...p, w, h })) ?? cands.find((p) => !placed.some((q) => p.x < q.x + q.w && p.x + w > q.x && p.y < q.y + q.h && p.y + h > q.y)) ?? cands[0];
      placed.push({ ...pick, w, h });
      return { x: pick.x, y: pick.y + h - 3 };
    });
  })();

  const handleNoteClick = (stringIdx: number, fret: number, midi: number) => {
    guitarSynth.playNote(midi, 1.25, 0.8);
    const id = `${stringIdx}-${fret}`;
    setActiveCell(id);
    setTimeout(() => setActiveCell(null), 380);
  };

  function renderSoloRegions() {
    const focus = soloChords[soloFocus];
    const next = soloChords[focus.nextIndex] ?? null;
    return (
      <g>
        {/* Region tints: one plain rounded rectangle per chord */}
        {soloChords.map((c, i) => {
          const col = soloColor(c.colorIndex);
          const isFocus = i === soloFocus;
          const isNext = next !== null && i === focus.nextIndex && i !== soloFocus;
          const r = soloRect(c);
          const sel = soloSel === i;
          const drag = soloDragging === i;
          return (
            <rect
              key={`solo-region-${i}`}
              data-solo-keep="1"
              data-solo-box={i}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={8}
              fill={col}
              fillOpacity={drag ? 0.22 : sel ? 0.16 : isFocus ? 0.13 : isNext ? 0.08 : 0.05}
              stroke={drag ? '#f4f4f5' : col}
              strokeOpacity={drag ? 0.9 : sel ? 0.95 : isFocus ? 0.6 : isNext ? 0.38 : 0.2}
              strokeWidth={drag ? 2.5 : sel ? 2 : isFocus ? 1.25 : 1}
              strokeDasharray={soloIsPinned(soloOverrides[i]) && !drag && !sel ? '6 3' : undefined}
              className={onSoloOverride ? (soloDragging !== null ? 'cursor-grabbing' : onSoloPin ? 'cursor-grab' : 'cursor-pointer') : undefined}
              style={onSoloPin && (sel || drag) ? { touchAction: 'none' } : undefined}
              onPointerDown={onSoloPin ? (e) => soloPointerDown(i, e) : undefined}
              onClick={onSoloOverride ? () => setSoloSel(sel ? null : i) : undefined}
            />
          );
        })}
      </g>
    );
  }

  function renderSolopath() {
    const pt = (p: { s: number; f: number }) => ({ x: cx(p.f), y: cy(p.s) });
    const key = (p: { s: number; f: number }) => `${p.s}-${p.f}`;
    // which arrows are drawn: every forward step, plus the loop only when it stays close
    const drawSteps = (c: SolopathChord) => !c.wrap || !c.jumpToNext;
    // one owner per fret cell: the focused region, then a step's end points, then the first region
    const owner = new Map<string, number>();
    soloChords[soloFocus].cells.forEach((x) => owner.set(key(x), soloFocus));
    soloChords.forEach((c, i) => {
      if (!drawSteps(c)) return;
      c.transitions.forEach((t) => {
        if (!owner.has(key(t.from)) && c.cells.some((x) => key(x) === key(t.from))) owner.set(key(t.from), i);
        const n = soloChords[c.nextIndex];
        if (n && !owner.has(key(t.to)) && n.cells.some((x) => key(x) === key(t.to))) owner.set(key(t.to), c.nextIndex);
      });
    });
    // where two boxes share a note: the stronger role wins (target > root > chord tone > passing), then the earlier box
    const rank = (x: SolopathChord['cells'][number]) => (x.role === 'primary' ? 0 : x.semi === 0 ? 1 : x.role === 'passing' ? 3 : 2);
    const bestRank = new Map<string, number>();
    soloChords.forEach((c, i) => c.cells.forEach((x) => {
      const k = key(x);
      if (owner.has(k) && !bestRank.has(k)) return; // focus / step end point already fixed
      const r = rank(x);
      if (!owner.has(k) || r < (bestRank.get(k) ?? 9)) { owner.set(k, i); bestRank.set(k, r); }
    }));
    const stepEnds = new Set<string>();
    const stepOut = new Set<string>();
    soloChords.forEach((c) => { if (drawSteps(c)) c.transitions.forEach((t) => stepOut.add(key(t.from))); });
    soloChords.forEach((c) => { if (drawSteps(c)) c.transitions.forEach((t) => { stepEnds.add(key(t.from)); stepEnds.add(key(t.to)); }); });

    const arrow = (k: string, a: { x: number; y: number }, b: { x: number; y: number }, col: number, opts: { strong: boolean; dashed: boolean; focus: boolean; title: string }) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const pad = 14;
      const sx = a.x + ux * pad;
      const sy = a.y + uy * pad;
      const ex = b.x - ux * pad;
      const ey = b.y - uy * pad;
      const bend = opts.focus ? Math.min(22, len * 0.25) : Math.min(10, len * 0.12);
      const qx = (sx + ex) / 2 - uy * bend;
      const qy = (sy + ey) / 2 + ux * bend;
      return (
        <path
          key={k}
          d={`M${sx},${sy} Q${qx},${qy} ${ex},${ey}`}
          fill="none"
          stroke={soloColor(col)}
          strokeOpacity={opts.dashed ? 0.4 : opts.focus ? (opts.strong ? 0.95 : 0.75) : opts.strong ? 0.7 : 0.45}
          strokeWidth={opts.strong ? (opts.focus ? 2.2 : 1.8) : opts.focus ? 1.6 : 1.3}
          strokeDasharray={opts.dashed ? '3 5' : undefined}
          strokeLinecap="round"
          markerEnd={`url(#solo-arrow-${((col % SOLO_PALETTE.length) + SOLO_PALETTE.length) % SOLO_PALETTE.length})`}
        >
          <title>{opts.title}</title>
        </path>
      );
    };

    return (
      <g>
        <defs>
          {SOLO_PALETTE.map((col, i) => (
            <marker key={i} id={`solo-arrow-${i}`} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={5} markerHeight={5} orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill={col} />
            </marker>
          ))}
          <mask id="solo-dim-mask" maskUnits="userSpaceOnUse">
            <rect x={0} y={0} width={W} height={H} fill="white" />
            {soloChords.map((c, i) => {
              const r = soloRect(c);
              return <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={8} fill="black" />;
            })}
          </mask>
        </defs>

        {/* Dim the rest of the neck: only the path regions stay bright */}
        <rect
          x={boardX - 6}
          y={boardY - 22}
          width={boardW + 12}
          height={boardH + 44}
          fill="#09090b"
          fillOpacity={0.6}
          mask="url(#solo-dim-mask)"
          pointerEvents="none"
        />

        {/* Inside each region: a quiet dotted line from where you arrive to where you leave (forward only) */}
        {soloChords.map((c, i) => {
          if (c.wrap) return null;
          const out = c.transitions[0];
          const prevC = i > 0 ? soloChords[i - 1] : null;
          const entry = prevC && !prevC.wrap ? prevC.transitions[0]?.to : undefined;
          if (!entry || !out || (entry.s === out.from.s && entry.f === out.from.f)) return null;
          const dir = soloChords[c.nextIndex]?.stepDir === 'down' ? -1 : 1;
          if ((out.from.f - entry.f) * dir < 0) return null;
          const a = pt(entry);
          const b = pt(out.from);
          return (
            <line key={`solo-pathline-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={soloColor(c.colorIndex)} strokeOpacity={0.4} strokeWidth={1.25} strokeDasharray="1.5 4" strokeLinecap="round" pointerEvents="none" />
          );
        })}

        {/* Every region's notes, all the same size and labelled; the role shows only in the colour */}
        {soloChords.map((c, i) => {
          const isFocus = i === soloFocus;
          const cells = [...c.cells].filter((x) => owner.get(key(x)) === i);
          const nextCol = soloColor(soloChords[c.nextIndex]?.colorIndex ?? 0);
          return (
            <g
              key={`solo-notes-${i}`}
              opacity={isFocus || soloDragging === i ? 1 : 0.85}
              data-solo-keep="1"
              style={onSoloPin && (soloSel === i || soloDragging === i) ? { touchAction: 'none' } : undefined}
              onPointerDown={onSoloPin ? (e) => soloPointerDown(i, e) : undefined}
              onClick={onSoloOverride ? () => setSoloSel(i) : undefined}
            >
              {cells.map((x) => {
                const id = key(x);
                const midi = (tuning[x.s]?.midi ?? 0) + x.f;
                const px = cx(x.f);
                const py = cy(x.s);
                const label = labelMode === 'note' ? x.name : x.label;
                const st = soloNoteStyle(x.role, x.semi === 0, c.colorIndex);
                const isEnd = stepEnds.has(id);
                const roleName = x.role === 'primary' ? 'target' : x.semi === 0 ? 'root' : x.role === 'passing' ? 'passing note' : 'chord tone';
                return (
                  <g key={id} onClick={() => handleNoteClick(x.s, x.f, midi)} className="cursor-pointer">
                    <title>{`${c.name}: ${x.name} (${x.label}) · ${roleName}`}</title>
                    {activeCell === id && <circle cx={px} cy={py} r={19} fill="none" stroke="#e4e4e7" strokeWidth={1.5} opacity={0.7} />}
                    {isEnd && !shapeOnly && <circle cx={px} cy={py} r={SOLO_NOTE_R + 3.5} fill="none" stroke={stepOut.has(id) ? soloColor(c.colorIndex) : nextCol} strokeOpacity={0.75} strokeWidth={1.25} />}
                    {shapeOnly ? (
                      <circle cx={px} cy={py} r={SHAPE_NOTE_R} fill={SHAPE_FILL} />
                    ) : (
                      <>
                        <circle cx={px} cy={py} r={SOLO_NOTE_R} fill={st.fill} stroke={st.stroke} strokeWidth={st.strokeWidth} />
                        <text x={px} y={py + 4} fill={st.text} fontFamily={mono} fontSize={label.length > 2 ? 10.5 : 12} fontWeight={st.weight} textAnchor="middle" pointerEvents="none">
                          {label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Steps: chord tone of one chord → chord tone of the next, always forward; guide-tone steps stronger */}
        {soloChords.map((c, i) => {
          if (!drawSteps(c)) return null;
          const isFocus = i === soloFocus;
          const n = soloChords[c.nextIndex];
          const trs = isFocus ? c.transitions : c.transitions.slice(0, 1);
          return (
            <g key={`solo-steps-${i}`}>
              {trs.map((t, k) => {
                const a = pt(t.from);
                const b = pt(t.to);
                const title = `${c.name} → ${n?.name ?? ''}: ${t.fromName} ${t.type === 'hold' ? 'held' : '→'} ${t.toName}${t.kind === 'guide' ? ' (guide tone)' : ''}`;
                if (t.from.s === t.to.s && t.from.f === t.to.f) {
                  return (
                    <g key={k} pointerEvents="none">
                      <title>{title}</title>
                      <text x={a.x + 16} y={a.y - 13} fill={soloColor(n?.colorIndex ?? 0)} fillOpacity={isFocus ? 1 : 0.6} fontFamily={mono} fontSize={11} fontWeight="700" textAnchor="middle">=</text>
                    </g>
                  );
                }
                return arrow(`${k}`, a, b, n?.colorIndex ?? 0, { strong: t.kind === 'guide', dashed: c.wrap, focus: isFocus, title });
              })}
            </g>
          );
        })}

        {/* Labels: small tabs at each region's top-left corner */}
        {soloChords.map((c, i) => {
          const col = soloColor(c.colorIndex);
          const isFocus = i === soloFocus;
          const pos = soloLabelPos[i];
          const sub = soloLabelSub(c);
          return (
            <text
              key={`solo-label-${i}`}
              x={pos.x}
              y={pos.y}
              fill={col}
              fillOpacity={isFocus ? 1 : 0.65}
              fontFamily={mono}
              fontSize={12}
              fontWeight={isFocus ? '700' : '600'}
              pointerEvents="none"
            >
              {soloLabelText(c, i)}
              {sub && (
                <tspan dx={6} fontSize={10} fontWeight="500" fillOpacity={isFocus ? 0.75 : 0.55}>
                  {sub}
                </tspan>
              )}
            </text>
          );
        })}
      </g>
    );
  }

  /** Toolbar of the selected box: strings −/+, frets (width) −/+, its frets, reset. */
  function renderSoloToolbar() {
    if (soloSel === null || !onSoloOverride || soloDragging !== null) return null;
    const i = soloSel;
    const c = soloChords[i];
    const n = soloChords.length;
    const ov: SoloRegionOverride = { ...(soloOverrides[i] ?? {}) };
    const mean = (x: SolopathChord) => x.strings.reduce((a, b) => a + b, 0) / Math.max(1, x.strings.length);
    // add strings toward the next box's strings first (the last box: the way the path was going)
    const toward = Math.sign(i < n - 1 ? mean(soloChords[i + 1]) - mean(c) : i > 0 ? mean(c) - mean(soloChords[i - 1]) : -1) || -1;
    const minS = Math.min(...c.strings);
    const maxS = Math.max(...c.strings);
    const set = (patch: SoloRegionOverride) => {
      const o = { ...ov, ...patch };
      (Object.keys(o) as (keyof SoloRegionOverride)[]).forEach((k) => { if (o[k] === undefined) delete o[k]; });
      onSoloOverride(i, Object.keys(o).length ? o : null);
    };
    const pinnedHere = soloIsPinned(ov);
    // strings are stored absolute (top string + count), so they stay right when the chord moves
    const setStrings = (lo: number, hi: number) => set({ str: lo, n: hi - lo + 1 });
    const addString = () => {
      if (toward < 0 && minS > 0) setStrings(minS - 1, maxS);
      else if (toward > 0 && maxS < nStr - 1) setStrings(minS, maxS + 1);
      else if (minS > 0) setStrings(minS - 1, maxS);
      else if (maxS < nStr - 1) setStrings(minS, maxS + 1);
    };
    const removeString = () => (toward < 0 ? setStrings(minS, maxS - 1) : setStrings(minS + 1, maxS));
    // frets: + grows the box the way the path goes on (− shrinks it from there), its start side stays
    const width = c.region.max - c.region.min + 1;
    const grow = soloGrowDir(soloChords.map((x) => x.stepDir), i);
    const setWidth = (w: number) => {
      const r = soloResize(c.region, w, grow);
      set(pinnedHere ? { frets: r.max - r.min + 1, fret: r.min } : { frets: r.max - r.min + 1 });
    };
    const col = soloColor(c.colorIndex);
    const BH = 40; // button size (SVG units; about 28–30 px on a phone)
    const BW = 44;
    const TH = BH + 8;
    type Item = { kind: 'text'; text: string; w: number; dim?: boolean; color?: string } | { kind: 'btn'; text: string; w: number; on: () => void; disabled: boolean; label: string };
    const items: Item[] = [
      { kind: 'text', text: `${i + 1} ${c.name}`, w: `${i + 1} ${c.name}`.length * 8 + 10, color: col },
      { kind: 'text', text: 'Strings', w: 62, dim: true },
      { kind: 'btn', text: '−', w: BW, on: removeString, disabled: c.strings.length <= 1, label: 'One string less' },
      { kind: 'text', text: String(c.strings.length), w: 24 },
      { kind: 'btn', text: '+', w: BW, on: addString, disabled: c.strings.length >= nStr, label: 'One string more' },
    ];
    items.push(
      { kind: 'text', text: 'Frets', w: 54, dim: true },
      { kind: 'btn', text: '−', w: BW, on: () => setWidth(width - 1), disabled: width <= 1, label: 'One fret less' },
      { kind: 'text', text: String(width), w: 24 },
      { kind: 'btn', text: '+', w: BW, on: () => setWidth(width + 1), disabled: width >= SOLO_MAX_BOX_FRETS, label: 'One fret more' },
    );
    items.push({ kind: 'text', text: `fr ${c.region.min}–${c.region.max}${pinnedHere ? ' · moved' : ''}`, w: pinnedHere ? 128 : 74, dim: true });
    items.push({ kind: 'btn', text: '↺', w: BW, on: () => onSoloOverride(i, null), disabled: !soloOverrides[i], label: 'Back to the planned box' });
    const gap = 6;
    const tw = items.reduce((a, it) => a + it.w + gap, 0) + 10;
    const r = soloRect(c);
    const lbl = soloLabelPos[i];
    const x = Math.max(4, Math.min(W - tw - 4, r.x));
    const aboveY = Math.min(r.y, lbl ? lbl.y - 12 : r.y) - TH - 4;
    const belowY = Math.max(r.y + r.h, lbl ? lbl.y + 4 : 0) + 4;
    const y = aboveY >= 0 ? aboveY : belowY + TH <= H ? belowY : H - TH - 2;
    let cx0 = x + 8;
    return (
      <g data-solo-keep="1" onClick={(e) => e.stopPropagation()}>
        <rect x={x} y={y} width={tw} height={TH} rx={10} fill="#18181b" fillOpacity={0.97} stroke="#3f3f46" strokeWidth={1} />
        {items.map((it, k) => {
          const ix = cx0;
          cx0 += it.w + gap;
          if (it.kind === 'text') {
            return (
              <text key={k} x={ix + it.w / 2} y={y + TH / 2 + 5} fill={it.color ?? (it.dim ? '#71717a' : '#e4e4e7')} fontFamily={mono} fontSize={it.dim ? 12 : 14} fontWeight={it.dim ? '500' : '700'} textAnchor="middle" pointerEvents="none">
                {it.text}
              </text>
            );
          }
          return (
            <g
              key={k}
              role="button"
              aria-label={it.label}
              aria-disabled={it.disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (!it.disabled) it.on();
              }}
              className={it.disabled ? '' : 'cursor-pointer'}
              opacity={it.disabled ? 0.3 : 1}
            >
              <title>{it.label}</title>
              <rect x={ix} y={y + 4} width={it.w} height={BH} rx={8} fill="#27272a" stroke="#3f3f46" strokeWidth={1} />
              <text x={ix + it.w / 2} y={y + 4 + BH / 2 + 7} fill="#e4e4e7" fontFamily={mono} fontSize={20} fontWeight="500" textAnchor="middle" pointerEvents="none">
                {it.text}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <div className="w-full bg-[#13161c] border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      {/* Fretboard Toolbar: Diatonic Degree Buttons (I..vii°) + Dropdown + Small Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
        {/* Diatonic Chord Degree Buttons (I ii iii IV V vi vii°) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-zinc-400 mr-1">
            Degrees:
          </span>
          {DIATONIC_DEGREES.map((deg) => {
            const isSelected = activeDegree === deg.roman;

            return (
              <button
                key={deg.roman}
                type="button"
                onClick={() => onSelectDegree(deg.roman)}
                className={`px-2.5 py-1.5 rounded-lg font-mono text-xs transition cursor-pointer border flex items-baseline gap-1.5 ${
                  isSelected
                    ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold shadow-sm'
                    : 'bg-[#0c0e12] text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-zinc-100'
                }`}
              >
                <span>{deg.roman}</span>
              </button>
            );
          })}
        </div>

        {/* Right side: Dropdown + Compact Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onToggleTension}
            disabled={!tensionAvailable}
            aria-pressed={tensionOn}
            title={tensionAvailable ? 'Highlight character and avoid notes' : 'Only available in the scale view'}
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              !tensionAvailable
                ? 'bg-[#0c0e12] text-zinc-700 border-zinc-900 cursor-not-allowed'
                : tensionOn
                ? 'bg-zinc-800 text-zinc-100 border-zinc-700 cursor-pointer'
                : 'bg-[#0c0e12] text-zinc-500 border-zinc-800 hover:text-zinc-300 cursor-pointer'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[#c9a66b]" />
              Character
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-dashed border-[#b97c7c]" />
              Avoid
            </span>
          </button>

          <select
            id="vis-select"
            aria-label="Choose scale or arpeggio"
            value={visType}
            onChange={(e) =>
              onChangeVisType(e.target.value as VisualizationType)
            }
            className="bg-[#0c0e12] text-zinc-100 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer"
          >
            {VISUALIZATION_TYPES.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          {shapeCount > 0 && (
            <div className="inline-flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex items-center rounded-lg bg-[#0c0e12] p-0.5 border border-zinc-800">
                <span className="px-2 text-[11px] text-zinc-500">
                  {visType === 'pentatonic' ? 'Shape' : visType === 'triad' || visType === 'arp7' ? 'Strings' : '3nps Position'}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleShape(null)}
                  aria-pressed={shapeSelection.length === 0}
                  title="Show all notes (no shape filter)"
                  className={`px-2 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                    shapeSelection.length === 0 ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  All
                </button>
                {Array.from({ length: shapeCount }, (_, k) => k).map((k) => {
                  const active = shapeSelection.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => onToggleShape(k)}
                      aria-pressed={active}
                      title={`Box ${k + 1} · ${shapeLabels[k] ?? k + 1} — toggle shape (several can be on at once)`}
                      className={`px-2 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                        active ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {shapeLabels[k] ?? k + 1}
                    </button>
                  );
                })}
              </div>
              {onChangeShapeOctaves && (
                <button
                  type="button"
                  onClick={() => onChangeShapeOctaves(!shapeOctaves)}
                  disabled={shapeSelection.length === 0}
                  aria-pressed={shapeOctaves && shapeSelection.length > 0}
                  title={
                    shapeSelection.length === 0
                      ? 'Select a shape to show or hide its octave up the neck'
                      : shapeOctaves
                      ? 'Hide the octave repeat of each selected shape'
                      : 'Show the octave repeat of each selected shape'
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    shapeSelection.length === 0
                      ? 'bg-[#0c0e12] text-zinc-700 border-zinc-900 cursor-not-allowed'
                      : shapeOctaves
                      ? 'bg-zinc-800 text-zinc-100 border-zinc-700 cursor-pointer'
                      : 'bg-[#0c0e12] text-zinc-500 border-zinc-800 hover:text-zinc-300 cursor-pointer'
                  }`}
                >
                  Octave
                </button>
              )}
            </div>
          )}

          {/* Small compact toggle: Notes / Intervals / Shape (plain dots) */}
          <div className="inline-flex items-center rounded-lg bg-[#0c0e12] p-0.5 border border-zinc-800">
            <button
              type="button"
              onClick={() => { onChangeLabelMode('note'); onChangeShapeOnly?.(false); }}
              aria-pressed={!shapeOnly && labelMode === 'note'}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                !shapeOnly && labelMode === 'note'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Notes
            </button>
            <button
              type="button"
              onClick={() => { onChangeLabelMode('degree'); onChangeShapeOnly?.(false); }}
              aria-pressed={!shapeOnly && labelMode === 'degree'}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                !shapeOnly && labelMode === 'degree'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Intervals
            </button>
            {onChangeShapeOnly && (
              <button
                type="button"
                onClick={() => onChangeShapeOnly(true)}
                aria-pressed={shapeOnly}
                title="Show only the shape: plain dots, no note names or intervals"
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  shapeOnly ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Shape
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Parallel mode: remaps Key+Degree so this root becomes that mode; Blues is a note overlay */}
      {visType === 'pentatonic' && onChangePentaOverlay && (
        <div className="flex flex-wrap items-center gap-2 -mt-1">
          <span
            className="text-[11px] uppercase tracking-wider text-zinc-500 shrink-0"
            title="Modes retune Key + Degree so the current root stays put but becomes that mode. Blues adds blue notes without changing key."
          >
            As mode
          </span>
          <div className="inline-flex flex-wrap items-center rounded-lg bg-[#0c0e12] p-0.5 border border-zinc-800" role="radiogroup" aria-label="Parallel mode of this root">
            {PENTA_OVERLAYS.map((opt) => {
              const on = pentaOverlay === opt.id;
              const modeFill =
                opt.id !== 'off' && opt.id !== 'blues' ? MODE_COLOUR_FILL[opt.id] : undefined;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChangePentaOverlay(opt.id)}
                  title={
                    opt.id === 'off'
                      ? 'Plain pentatonic — no mode colours or blue notes'
                      : opt.id === 'blues'
                      ? 'Add b3 and b5 of this root on top of the pentatonic'
                      : `Make this root ${opt.label}: switch parent key & degree (root note stays)`
                  }
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    on && !modeFill
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : on && modeFill
                      ? 'shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  style={on && modeFill ? { backgroundColor: modeFill, color: MODE_COLOUR_TEXT } : undefined}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {pentaOverlay !== 'off' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: pentaOverlay === 'blues' ? '#60a5fa' : modeColourFill }}
              />
              {pentaOverlay === 'blues' ? 'blue notes' : 'mode colours'}
            </span>
          )}
        </div>
      )}


      {/* SVG Fretboard */}
      <div className="w-full overflow-x-auto pb-1">
        <svg
          ref={svgRef}
          onClickCapture={(e) => { if (soloSuppressClick.current) { e.stopPropagation(); e.preventDefault(); } }}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[1160px] h-auto select-none"
        >
          {/* Fretboard Surface (Frets 1..24) */}
          <rect
            x={boardX + colW}
            y={boardY - 14}
            width={boardW - colW}
            height={boardH + 28}
            rx={6}
            fill="#181b22"
            stroke="#272b36"
            strokeWidth={1}
          />

          {/* Open String Area (Fret 0) */}
          <rect
            x={boardX}
            y={boardY - 14}
            width={colW}
            height={boardH + 28}
            fill="#13161c"
          />

          {/* Fret Numbers (0..24) */}
          {Array.from({ length: cols }).map((_, fret) => (
            <text
              key={`fret-num-${fret}`}
              x={cx(fret)}
              y={soloActive ? boardY + boardH + 34 : boardY - 24}
              fill={markedFrets.includes(fret) ? '#a1a1aa' : '#52525b'}
              fontSize={12}
              fontWeight={
                fret === 0 || fret === 12 || fret === 24 ? '700' : '500'
              }
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              textAnchor="middle"
            >
              {fret}
            </text>
          ))}

          {/* Subtle Fretboard Inlays */}
          {Array.from({ length: cols }).map((_, fret) => {
            if (singleInlayFrets.includes(fret)) {
              return (
                <circle
                  key={`inlay-${fret}`}
                  cx={cx(fret)}
                  cy={boardY + boardH / 2}
                  r={5}
                  fill="#262a34"
                />
              );
            }
            if (doubleInlayFrets.includes(fret)) {
              return (
                <g key={`inlay-${fret}`}>
                  <circle
                    cx={cx(fret)}
                    cy={boardY + boardH * 0.3}
                    r={5}
                    fill="#262a34"
                  />
                  <circle
                    cx={cx(fret)}
                    cy={boardY + boardH * 0.7}
                    r={5}
                    fill="#262a34"
                  />
                </g>
              );
            }
            return null;
          })}

          {/* Fret Wires & Nut */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            if (i === 0) return null;
            const x = boardX + i * colW;
            const isNut = i === 1;
            return (
              <line
                key={`wire-${i}`}
                x1={x}
                y1={boardY - 14}
                x2={x}
                y2={boardY + boardH + 14}
                stroke={isNut ? '#a1a1aa' : '#2c313d'}
                strokeWidth={isNut ? 4 : 1.5}
              />
            );
          })}

          {soloActive && renderSoloRegions()}

          {/* Active shape frame */}
          {!soloActive && (shapeRanges ?? []).map((r, k) => (
            <rect
              key={`shape-frame-${k}`}
              x={boardX + r.min * colW + 3}
              y={boardY - 20}
              width={(r.max - r.min + 1) * colW - 6}
              height={boardH + 40}
              rx={10}
              fill="#ffffff"
              fillOpacity={0.025}
              stroke="#71717a"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          ))}

          {/* Strings, highest on top (guitar e B G D A E, bass G D A E) */}
          {tuning.map((str, sIdx) => {
            const y = cy(sIdx);
            const thickness = (tuning[0].midi < 50 ? 1.9 : 1.1) + sIdx * 0.32; // bass strings heavier
            return (
              <g key={`string-${sIdx}`}>
                <line
                  x1={boardX + colW}
                  y1={y}
                  x2={boardX + boardW}
                  y2={y}
                  stroke="#525866"
                  strokeWidth={thickness}
                />
                <text
                  x={boardX - 24}
                  y={y + 4.5}
                  fill="#a1a1aa"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize={14}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {str.label}
                </text>
              </g>
            );
          })}

          {soloActive && renderSolopath()}

          {/* Scale / Arpeggio Note Nodes */}
          {!soloActive && tuning.map((str, sIdx) =>
            Array.from({ length: cols }).map((_, fret) => {
              const midi = str.midi + fret;
              const noteChroma = ((midi % 12) + 12) % 12;
              const semiFromFocusRoot =
                (noteChroma - focusRootChroma + 12) % 12;
              const degree = semitones[semiFromFocusRoot];

              if (!degree) {
                const overlay = overlayIntervals[semiFromFocusRoot];
                const ghost = ghostIntervals[semiFromFocusRoot];
                const gCell = `${sIdx}-${fret}`;
                // Overlay notes (pentatonic Add row): show across the neck; when a shape is
                // selected, keep them in the shape's fret window so they sit next to the box.
                if (overlay) {
                  // One-pass: with a shape selected, only pre-picked cells (one per colour degree).
                  // 'All' → overlayCells null → every occurrence on the neck.
                  if (overlayCells) {
                    if (!overlayCells.has(gCell)) return null;
                  } else if (shapeCells) {
                    const inShapeBox =
                      shapeRanges.length > 0 &&
                      shapeRanges.some((r) => fret >= r.min && fret <= r.max);
                    if (!inShapeBox) return null;
                  }
                  const gx = cx(fret);
                  const gy = cy(sIdx);
                  const oLabel = labelMode === 'note' ? getNoteNameForKey(midi, parentKey) : overlay;
                  const fill = modeColourFill;
                  if (shapeOnly) {
                    return (
                      <g key={gCell} onClick={() => handleNoteClick(sIdx, fret, midi)} className="cursor-pointer">
                        <title>Mode colour</title>
                        <circle cx={gx} cy={gy} r={SHAPE_NOTE_R} fill={fill} />
                      </g>
                    );
                  }
                  return (
                    <g key={gCell} onClick={() => handleNoteClick(sIdx, fret, midi)} className="cursor-pointer">
                      <title>{`Mode colour: ${oLabel}`}</title>
                      <circle cx={gx} cy={gy} r={NOTE_R} fill={fill} stroke="#ffffff55" strokeWidth={1} />
                      <text
                        x={gx}
                        y={gy + 4}
                        fill={MODE_COLOUR_TEXT}
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fontSize={oLabel.length > 2 ? 10 : 11.5}
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {oLabel}
                      </text>
                    </g>
                  );
                }
                if (!ghost || shapeOnly || (shapeCells && !shapeCells.has(gCell))) return null;
                const gx = cx(fret);
                const gy = cy(sIdx);
                const gLabel = labelMode === 'note' ? getNoteNameForKey(midi, parentKey) : ghost;
                return (
                  <g
                    key={gCell}
                    onClick={() => handleNoteClick(sIdx, fret, midi)}
                    className="cursor-pointer"
                  >
                    <title>Characteristic tone (typical extension)</title>
                    <circle cx={gx} cy={gy} r={NOTE_R} fill="#13161c" stroke="#c9a66b" strokeWidth={1.5} strokeDasharray="3 2.5" />
                    <text
                      x={gx}
                      y={gy + 4}
                      fill="#c9a66b"
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fontSize={gLabel.length > 2 ? 10 : 11.5}
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {gLabel}
                    </text>
                  </g>
                );
              }

              const isRoot = semiFromFocusRoot === 0;
              const noteName = getNoteNameForKey(midi, parentKey);
              const label = labelMode === 'note' ? noteName : degree;
              const x = cx(fret);
              const y = cy(sIdx);
              const cellId = `${sIdx}-${fret}`;
              const isClicked = activeCell === cellId;
              const inShape = !shapeCells || shapeCells.has(cellId);
              const isCharacter = tensionOn && characterOffsets.includes(semiFromFocusRoot);
              const isAvoid = tensionOn && avoidOffsets.includes(semiFromFocusRoot);

              if (shapeOnly) {
                if (!inShape) return null;
                return (
                  <g key={cellId} onClick={() => handleNoteClick(sIdx, fret, midi)} className="cursor-pointer">
                    {isClicked && <circle cx={x} cy={y} r={19} fill="none" stroke="#e4e4e7" strokeWidth={1.5} opacity={0.6} />}
                    <circle cx={x} cy={y} r={SHAPE_NOTE_R} fill={SHAPE_FILL} />
                  </g>
                );
              }

              return (
                <g
                  key={cellId}
                  onClick={() => handleNoteClick(sIdx, fret, midi)}
                  className="cursor-pointer"
                  opacity={inShape ? 1 : 0.13}
                >
                  {isClicked && (
                    <circle
                      cx={x}
                      cy={y}
                      r={19}
                      fill="none"
                      stroke="#e4e4e7"
                      strokeWidth={1.75}
                      opacity={0.7}
                    />
                  )}
                  {isCharacter && (
                    <circle cx={x} cy={y} r={isAvoid ? 21.5 : 18} fill="none" stroke="#c9a66b" strokeWidth={1.75} />
                  )}
                  {isAvoid && (
                    <circle cx={x} cy={y} r={18} fill="none" stroke="#b97c7c" strokeWidth={1.75} strokeDasharray="3 2.5" />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={NOTE_R}
                    fill={isRoot ? '#e4e4e7' : '#272c37'}
                    stroke={isRoot ? '#ffffff' : '#525b6d'}
                    strokeWidth={isRoot ? 2 : 1.25}
                  />
                  <text
                    x={x}
                    y={y + 4}
                    fill={isRoot ? '#090a0f' : '#f4f4f5'}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fontSize={label.length > 2 ? 10.5 : 12}
                    fontWeight={isRoot ? '700' : '600'}
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                </g>
              );
            })
          )}
          {soloActive && renderSoloToolbar()}
        </svg>
      </div>
    </div>
  );
};
