import { useEffect, useMemo, useState } from 'react';

function usePersistentState<T>(key: string, initial: T, isValid: (v: unknown) => boolean = () => true) {
  const storageKey = `fretboard:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) return parsed as T;
      }
    } catch {
      /* ignore */
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [storageKey, value]);
  return [value, setValue] as const;
}
import {
  CHROMATIC_NOTES,
  type LabelMode,
  type NoteName,
  type RomanDegree,
  type VisualizationType,
  type PentaOverlayId,
  getNoteNameForKey,
  isPentaOverlayId,
  getPentaOverlayNotes,
  getDegreeModeColourNotes,
  pickModeColourCellsForPentShape,
  expandPentRangeForModeShape,
  MODE_COLOUR_FILL,
  remapForParallelMode,
  modeIdForDegree,
  getActiveFretboardView,
  getDegreeSpec,
  getShapeCells,
  getShapeCount,
  getShapeLabels,
  getPentatonicBoxNames,
  mergeShapeResults,
  getChordGripCells,
  CHORD_GRIPS,
  EXTENSION_GRIPS,
  getExtGripCells,
  getStringSetCells,
  PROG_DIATONIC,
  PROG_BORROWED,
  PROG_SECONDARY,
  CHORD_FORMULAS,
  findProgDef,
  progChordName,
  type ProgChord,
  type ProgChordDef,
  computeSolopath,
  solopathStartRange,
  sanitizeSoloOverrides,
  type SoloDirection,
  type SoloRegionOverride,
  soloNoteStyle,
  soloPinOverrides,
  INSTRUMENTS,
  type InstrumentId,
  isInstrumentId,
  getInstrument,
} from './data/musicTheory';
import { FretboardSVG, type SoloPinPos } from './components/FretboardSVG';
import { ProgressionChips } from './components/ProgressionChips';
import { moveItem, remapIndexAfterMove } from './data/reorder';

const BRIGHTNESS_ORDER: RomanDegree[] = ['IV', 'I', 'V', 'ii', 'vi', 'iii', 'vii°'];

export function App() {
  const [selectedKey, setSelectedKey] = usePersistentState<NoteName>('key', 'C', (v) => (CHROMATIC_NOTES as readonly unknown[]).includes(v));
  const [activeDegree, setActiveDegree] = usePersistentState<RomanDegree>('degree', 'I', (v) => ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'].includes(v as string));
  const [visType, setVisType] = usePersistentState<VisualizationType>('visType', 'scale', (v) => ['scale', 'pentatonic', 'triad', 'arp7'].includes(v as string));
  const [labelMode, setLabelMode] = usePersistentState<LabelMode>('labelMode', 'note', (v) => v === 'note' || v === 'degree');
  const [shapeOnly, setShapeOnly] = usePersistentState<boolean>('shapeOnly', false, (v) => typeof v === 'boolean');
  const [showTension, setShowTension] = usePersistentState<boolean>('showTension', false, (v) => typeof v === 'boolean');
  const [pentaOverlay, setPentaOverlay] = usePersistentState<PentaOverlayId>('pentaOverlay', 'off', isPentaOverlayId);
  const [shapeSelection, setShapeSelection] = usePersistentState<number[]>(
    'shapeSelection',
    [],
    (v) => Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0)
  );
  const [shapeOctaves, setShapeOctaves] = usePersistentState<boolean>('shapeOctaves', true, (v) => typeof v === 'boolean');
  const [instrumentId, setInstrumentId] = usePersistentState<InstrumentId>('instrument', 'guitar', isInstrumentId);
  const instrument = getInstrument(instrumentId);
  const tuning = instrument.strings;
  const nStr = tuning.length;

  const view = getActiveFretboardView(selectedKey, activeDegree, visType);
  const degreeSpec = getDegreeSpec(activeDegree);
  const tonicChroma = CHROMATIC_NOTES.indexOf(selectedKey);
  // Overlay radio gates extras: Off = plain pent; Blues = blue notes only;
  // a mode id = mode−pent colour tones (after parallel remap).
  const pentaOverlayNotes =
    visType !== 'pentatonic' || pentaOverlay === 'off'
      ? { offsets: [] as number[], intervals: {} as Record<number, string> }
      : pentaOverlay === 'blues'
        ? getPentaOverlayNotes(
            'blues',
            tonicChroma,
            view.focusRootChroma,
            degreeSpec.pentatonicOffsets
          )
        : getDegreeModeColourNotes(
            degreeSpec.scaleOffsets,
            degreeSpec.scaleIntervals,
            degreeSpec.pentatonicOffsets
          );
  /** Mode buttons remap Key+Degree so the focus root becomes that parallel mode; Off/Blues only touch the overlay. */
  const handlePentaOverlay = (id: PentaOverlayId) => {
    if (id === 'off' || id === 'blues') {
      setPentaOverlay(id);
      return;
    }
    const { key, degree } = remapForParallelMode(view.focusRootChroma, id);
    setSelectedKey(key);
    setActiveDegree(degree);
    setPentaOverlay(id);
  };
  // Active grip: chord = null means the basic 7th chord, otherwise an extension like 'maj9'
  const [grip, setGrip] = useState<{ chord: string | null; index: number } | null>(null);
  // grips are guitar voicings; on other instruments a chord shows its chord tones over the whole neck
  const gripTotal = (chord: string | null) =>
    !instrument.grips ? 1 : chord === null ? CHORD_GRIPS.length : EXTENSION_GRIPS[chord]?.grips.length ?? 0;
  const cycleGrip = (chord: string | null) => {
    setProgIndex(null);
    setGrip((g) => {
      if (!g || g.chord !== chord) return gripTotal(chord) > 0 ? { chord, index: 0 } : null;
      return g.index + 1 < gripTotal(chord) ? { chord, index: g.index + 1 } : null;
    });
  };
  useEffect(() => setGrip(null), [activeDegree, selectedKey, instrumentId]);
  const extDef = grip && grip.chord !== null ? EXTENSION_GRIPS[grip.chord] : null;
  const activeGrip: { cells: Set<string> | null; ranges: { min: number; max: number }[] } | null = !grip
    ? null
    : !instrument.grips
      ? grip.chord === null || extDef
        ? { cells: null, ranges: [] }
        : null
    : grip.chord === null
      ? getChordGripCells(view.focusRootChroma, degreeSpec.arp7Offsets, grip.index)
      : extDef
        ? getExtGripCells(view.focusRootChroma, extDef.grips[grip.index])
        : null;
  const gripLabel = !grip
    ? ''
    : !instrument.grips
      ? 'chord tones'
    : grip.chord === null
      ? CHORD_GRIPS[grip.index].label
      : extDef?.grips[grip.index].label ?? '';
  const gripSemitones = !grip ? null : grip.chord === null ? degreeSpec.arp7Intervals : extDef?.labels ?? null;
  const [progression, setProgression] = usePersistentState<ProgChord[]>(
    'progression2',
    [],
    (v) =>
      Array.isArray(v) &&
      v.every((c) => c && typeof c === 'object' && typeof (c as ProgChord).semi === 'number' && typeof (c as ProgChord).suffix === 'string')
  );
  const [progIndex, setProgIndex] = useState<number | null>(null);
  const [addGroup, setAddGroup] = useState<'diatonic' | 'borrowed' | 'secondary'>('diatonic');
  const selectedProg = progIndex !== null ? progression[progIndex] ?? null : null;
  const selectedProgDef = selectedProg ? findProgDef(selectedProg) : undefined;
  const selectProgStep = (i: number) => {
    if (progression.length === 0) return;
    const idx = ((i % progression.length) + progression.length) % progression.length;
    setProgIndex(idx);
    setGrip(null);
    const c = progression[idx];
    if (c.degree) setActiveDegree(c.degree);
  };
  const addProgChord = (d: ProgChordDef) => {
    const c: ProgChord = { roman: d.roman, degreeNum: d.degreeNum, semi: d.semi, suffix: d.suffix, kind: d.kind, degree: d.degree };
    setProgression([...progression, c]);
  };
  const setProgSuffix = (suffix: string) => {
    if (progIndex === null) return;
    setProgression(progression.map((c, i) => (i === progIndex ? { ...c, suffix } : c)));
  };
  const [solopath, setSolopath] = usePersistentState<boolean>('solopath', false, (v) => typeof v === 'boolean');
  const [solopathDir, setSolopathDir] = usePersistentState<SoloDirection>('solopathDir', 'up', (v) => v === 'up' || v === 'down');
  // Start fret per direction (fret where the first region's window begins)
  const [solopathStartFret, setSolopathStartFret] = usePersistentState<{ up: number; down: number }>(
    'solopathStartFret',
    { up: 0, down: 12 },
    (v) => {
      const o = v as { up?: unknown; down?: unknown } | null;
      return !!o && typeof o === 'object' && Number.isInteger(o.up) && Number.isInteger(o.down);
    }
  );
  useEffect(() => {
    // the old Start setting was an index into CAGED anchors; it does not translate to frets
    try {
      localStorage.removeItem('fretboard:solopathStart');
    } catch {
      /* ignore */
    }
  }, []);
  const soloOn = solopath && progression.length >= 2;
  const soloStartRange = useMemo(() => solopathStartRange(progression.length, solopathDir), [progression.length, solopathDir]);
  const soloStartFret = Math.min(soloStartRange.max, Math.max(soloStartRange.min, solopathStartFret[solopathDir]));
  const shiftSoloStart = (d: number) => {
    const v = Math.min(soloStartRange.max, Math.max(soloStartRange.min, soloStartFret + d));
    setSolopathStartFret({ ...solopathStartFret, [solopathDir]: v });
  };
  // Manual box changes (strings, frets, dragged position) per region; they belong to one key + progression
  const soloSigOf = (prog: ProgChord[]) => `${selectedKey}|${prog.map((c) => `${c.kind}:${c.roman}${c.suffix}`).join(',')}`;
  const soloSig = soloSigOf(progression);
  const validOverrideStore = (v: unknown) => {
    const o = v as { sig?: unknown; regions?: unknown } | null;
    return !!o && typeof o === 'object' && typeof o.sig === 'string' && Array.isArray(o.regions);
  };
  // stored per instrument (string numbers mean different strings), so switching back keeps the boxes
  const [guitarOverrideStore, setGuitarOverrideStore] = usePersistentState<{ sig: string; regions: (SoloRegionOverride | null)[] }>(
    'solopathRegionOverrides',
    { sig: '', regions: [] },
    validOverrideStore
  );
  const [bassOverrideStore, setBassOverrideStore] = usePersistentState<{ sig: string; regions: (SoloRegionOverride | null)[] }>(
    'solopathRegionOverrides:bass4',
    { sig: '', regions: [] },
    validOverrideStore
  );
  const soloOverrideStore = instrumentId === 'guitar' ? guitarOverrideStore : bassOverrideStore;
  const setSoloOverrideStore = instrumentId === 'guitar' ? setGuitarOverrideStore : setBassOverrideStore;
  const soloOverrides = useMemo(
    () => (soloOverrideStore.sig === soloSig ? sanitizeSoloOverrides(soloOverrideStore.regions, progression.length, nStr) : []),
    [soloOverrideStore, soloSig, progression.length, nStr]
  );
  const soloHasOverrides = soloOverrides.some((o) => o !== null);
  const setSoloOverride = (i: number, ov: SoloRegionOverride | null) => {
    const regions = Array.from({ length: Math.max(progression.length, i + 1) }, (_, k) => soloOverrides[k] ?? null);
    regions[i] = ov && Object.keys(ov).length ? ov : null;
    setSoloOverrideStore({ sig: soloSig, regions: sanitizeSoloOverrides(regions, progression.length, nStr) });
  };
  // a chip dragged to a new place: the selection and the box changes (all absolute) go with their chord
  const moveProgChord = (from: number, to: number) => {
    const next = moveItem(progression, from, to);
    const regions = moveItem(Array.from({ length: progression.length }, (_, k) => soloOverrides[k] ?? null), from, to);
    setProgression(next);
    setProgIndex(remapIndexAfterMove(progIndex, from, to));
    if (regions.some((o) => o)) setSoloOverrideStore({ sig: soloSigOf(next), regions: sanitizeSoloOverrides(regions, next.length, nStr) });
  };
  const resetSoloOverrides = () => setSoloOverrideStore({ sig: soloSig, regions: [] });
  // dragging a box: a live preview while the finger / mouse moves, stored on drop
  const [soloDrag, setSoloDrag] = useState<{ i: number; pos: SoloPinPos } | null>(null);
  const onSoloPin = (i: number, pos: SoloPinPos | null, final: boolean) => {
    if (!final) return setSoloDrag(pos ? { i, pos } : null);
    setSoloDrag(null);
    if (pos) setSoloOverrideStore({ sig: soloSig, regions: soloPinOverrides(soloOverrides, i, pos, progression.length, nStr) });
  };
  const soloPlanOverrides = useMemo(
    () => (soloDrag ? soloPinOverrides(soloOverrides, soloDrag.i, soloDrag.pos, progression.length, nStr) : soloOverrides),
    [soloDrag, soloOverrides, progression.length, nStr]
  );
  useEffect(() => {
    // a new key or progression starts with the planned boxes again
    if (soloOverrideStore.sig !== soloSig && soloOverrideStore.regions.length > 0) setSoloOverrideStore({ sig: soloSig, regions: [] });
  }, [soloSig, soloOverrideStore, setSoloOverrideStore]);
  const soloChords = useMemo(
    () => (soloOn ? computeSolopath(selectedKey, progression, solopathDir, { startFret: soloStartFret, overrides: soloPlanOverrides, tuning }) : []),
    [soloOn, selectedKey, progression, solopathDir, soloStartFret, soloPlanOverrides, tuning]
  );
  const soloFocus = soloChords.length > 0 ? Math.min(progIndex ?? 0, soloChords.length - 1) : 0;
  const soloFocusChord = soloChords[soloFocus] ?? null;
  const soloNextChord = soloFocusChord ? soloChords[soloFocusChord.nextIndex] ?? null : null;
  const progOverride = selectedProg
    ? {
        rootChroma: (CHROMATIC_NOTES.indexOf(selectedKey) + selectedProg.semi) % 12,
        semitones: CHORD_FORMULAS[selectedProg.suffix] ?? CHORD_FORMULAS[''],
      }
    : null;
  // Solopath takes precedence over grips and the progression override
  const gripView = soloOn ? null : activeGrip;
  const po = soloOn || activeGrip ? null : progOverride;
  const degreeRoot = view.focusRoot;
  const seventhChord = `${degreeRoot}${degreeSpec.arp7Suffix}`;
  const ghostIntervals: Record<number, string> =
    visType === 'arp7'
      ? Object.fromEntries(
          degreeSpec.characterOffsets
            .filter((o) => !(o in view.semitones))
            .map((o) => [o, degreeSpec.scaleIntervals[o]])
        )
      : {};
  const shapeCount = getShapeCount(visType, tuning);
  // empty selection = All; drop indices past the current shape count (e.g. after instrument switch)
  const selectedShapes = shapeSelection.filter((i) => i < shapeCount);
  const isStringSet = visType === 'triad' || visType === 'arp7';
  const activeShape =
    shapeCount > 0 && selectedShapes.length > 0
      ? mergeShapeResults(
          selectedShapes.map((idx) =>
            isStringSet
              ? getStringSetCells(
                  view.focusRootChroma,
                  Object.keys(view.semitones).map(Number),
                  idx,
                  visType,
                  24,
                  tuning
                )
              : getShapeCells(
                  view.focusRootChroma,
                  Object.keys(view.semitones).map(Number),
                  visType === 'pentatonic' ? 2 : 3,
                  idx,
                  24,
                  tuning,
                  shapeOctaves
                )
          )
        )
      : null;
  // One-pass mode colours: EVERY CAGED box when All, else each selected box
  // (one fret per colour degree per box — not one for the whole neck).
  const overlayCells: Set<string> | null =
    visType === 'pentatonic' && pentaOverlayNotes.offsets.length > 0
      ? (() => {
          const indices =
            selectedShapes.length > 0
              ? selectedShapes
              : Array.from({ length: getShapeCount('pentatonic', tuning) }, (_, i) => i);
          const cells = new Set<string>();
          for (const idx of indices) {
            pickModeColourCellsForPentShape(
              view.focusRootChroma,
              degreeSpec.pentatonicOffsets,
              pentaOverlayNotes.offsets,
              idx,
              shapeOctaves,
              tuning,
              24,
              degreeSpec.scaleOffsets
            ).forEach((c) => cells.add(c));
          }
          return cells;
        })()
      : null;

  return (
    <div className="min-h-screen bg-[#0c0e12] text-zinc-100 flex flex-col justify-center py-8 px-4 sm:px-8">
      <div className="max-w-[1560px] w-full mx-auto space-y-6">
        {/* Clean Minimal Header */}
        <header className="pb-3 border-b border-zinc-800/80">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-1">
            Fretboard Visualizer · {instrument.name} · 24 frets
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            {view.title}{' '}
            <span className="text-zinc-500 font-normal text-lg">
              ({view.subtitle})
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            <span className="text-zinc-300">{degreeSpec.modeSubtitle}: {degreeSpec.modeQuality}</span>
            {degreeSpec.characteristics.length > 0 && (
              <span className="text-zinc-500">
                {' — '}
                <span className="text-zinc-400">{degreeSpec.characteristics.join(', ')}</span>
              </span>
            )}
          </p>

          {/* Brightness scale: modes from bright to dark */}
          <div className="mt-3 flex items-center gap-3 max-w-md">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">Bright</span>
            <div className="relative flex-1">
              <div className="absolute left-0 right-0 top-[5px] h-px bg-gradient-to-r from-zinc-400/60 to-zinc-800" />
              <div className="relative flex justify-between">
                {BRIGHTNESS_ORDER.map((roman) => {
                  const spec = getDegreeSpec(roman);
                  const isActive = roman === activeDegree;
                  const fill = MODE_COLOUR_FILL[modeIdForDegree(roman)];
                  return (
                    <button
                      key={roman}
                      type="button"
                      title={spec.modeSubtitle}
                      onClick={() => setActiveDegree(roman)}
                      className="flex flex-col items-center gap-1 cursor-pointer group"
                    >
                      <span
                        className={`block rounded-full transition ${
                          isActive ? 'w-3 h-3 -mt-px ring-2 ring-white/25' : 'w-2.5 h-2.5 opacity-70 group-hover:opacity-100'
                        }`}
                        style={{ backgroundColor: fill }}
                      />
                      <span
                        className={`text-[10px] leading-none ${
                          isActive ? 'text-zinc-200' : 'text-zinc-600 group-hover:text-zinc-400'
                        }`}
                      >
                        {spec.modeSubtitle.slice(0, 3)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">Dark</span>
          </div>
        </header>

        {/* Key Selector Row (Tonart auswählen) */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Instrument: Guitar | Bass */}
            <div className="inline-flex items-center rounded-lg bg-[#0c0e12] p-0.5 border border-zinc-800 mr-2" role="group" aria-label="Instrument">
              {INSTRUMENTS.map((ins) => (
                <button
                  key={ins.id}
                  type="button"
                  aria-pressed={ins.id === instrumentId}
                  onClick={() => setInstrumentId(ins.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    ins.id === instrumentId ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {ins.name}
                </button>
              ))}
            </div>
            <span className="text-xs font-medium text-zinc-400 mr-1">
              Key:
            </span>
            {CHROMATIC_NOTES.map((note) => {
              const isSelected = selectedKey === note;
              return (
                <button
                  key={note}
                  onClick={() => setSelectedKey(note)}
                  className={`w-10 h-9 rounded-lg font-mono text-xs font-semibold transition cursor-pointer border ${
                    isSelected
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm'
                      : 'bg-[#13161c] text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {note}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
          {/* Compact Active Notes Summary without middle dots */}
          <div className="inline-flex items-center gap-1 text-xs text-zinc-400 font-mono bg-[#13161c] px-3 py-1.5 rounded-lg border border-zinc-800/80 flex-wrap">
            <span className="text-zinc-500 font-sans mr-1">{labelMode === 'note' ? 'Notes:' : 'Intervals:'}</span>
            {view.notes.map((item, idx) => {
              const altered = /[b#]/.test(item.degree);
              const text = labelMode === 'note' ? item.note : item.degree;
              return (
                <span
                  key={item.degree}
                  title={altered ? 'Differs from the major scale' : undefined}
                  className={`px-1.5 py-0.5 rounded ${
                    altered ? 'bg-zinc-800 text-zinc-100 font-semibold' : idx === 0 ? 'text-zinc-100 font-bold' : 'text-zinc-400'
                  }`}
                >
                  {text}
                </span>
              );
            })}
            {visType === 'pentatonic' && pentaOverlayNotes.offsets.map((semi) => {
              const note = getNoteNameForKey((view.focusRootChroma + semi) % 12, selectedKey);
              const deg = pentaOverlayNotes.intervals[semi];
              const text = labelMode === 'note' ? note : deg;
              const isBlues = pentaOverlay === 'blues';
              return (
                <span
                  key={`ov-${semi}`}
                  title={isBlues ? 'Blue note' : `${degreeSpec.modeSubtitle} colour note`}
                  className="px-1.5 py-0.5 rounded font-semibold"
                  style={{
                    backgroundColor: isBlues
                      ? '#60a5fa'
                      : MODE_COLOUR_FILL[modeIdForDegree(activeDegree)],
                    color: '#14141c',
                  }}
                >
                  {text}
                </span>
              );
            })}
          </div>

          {/* Compact Chord Card: each chord name cycles through its grips */}
          <div className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border bg-[#13161c] border-zinc-800/80 flex-wrap">
            <span className="text-zinc-500 font-sans">Chord:</span>
            {(() => {
              const chip = (chord: string | null, text: string, strong = false) => {
                const active = grip !== null && grip.chord === chord;
                return (
                  <button
                    key={chord ?? 'base'}
                    type="button"
                    onClick={() => cycleGrip(chord)}
                    title={instrument.grips ? 'Click to cycle through common grips' : 'Click to show the chord tones'}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                      active
                        ? 'bg-zinc-700 text-zinc-100'
                        : strong
                          ? 'text-zinc-100 hover:bg-zinc-800'
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {strong ? <strong>{text}</strong> : text}
                  </button>
                );
              };
              const exts = degreeSpec.extensions.filter((e) => EXTENSION_GRIPS[e]);
              return (
                <>
                  {chip(null, seventhChord, true)}
                  {exts.length > 0 && <span className="text-zinc-600 font-sans ml-1">typical:</span>}
                  {exts.map((e) => chip(e, `${degreeRoot}${e}`))}
                </>
              );
            })()}
            {grip && (
              <span className="text-zinc-500 ml-1">
                {instrument.grips ? `grip ${grip.index + 1}/${gripTotal(grip.chord)} · ${gripLabel}` : gripLabel}
              </span>
            )}
          </div>
          </div>
        </section>

        {/* 24-Fret Fretboard with Degree Buttons (I..vii°), Dropdown & Small Toggle */}
        <FretboardSVG
          parentKey={selectedKey}
          focusRootChroma={soloFocusChord ? soloFocusChord.rootChroma : po ? po.rootChroma : view.focusRootChroma}
          activeDegree={activeDegree}
          onSelectDegree={(r) => {
            setProgIndex(null);
            setActiveDegree(r);
          }}
          visType={visType}
          onChangeVisType={(t) => {
            setVisType(t);
            setShapeSelection([]);
            setProgIndex(null);
          }}
          semitones={gripView && gripSemitones ? gripSemitones : po ? po.semitones : view.semitones}
          labelMode={labelMode}
          onChangeLabelMode={setLabelMode}
          shapeOnly={shapeOnly}
          onChangeShapeOnly={setShapeOnly}
          fretCount={24}
          characterOffsets={po ? [] : degreeSpec.characterOffsets}
          avoidOffsets={po ? [] : degreeSpec.avoidOffsets}
          showTension={showTension}
          onToggleTension={() => setShowTension((v) => !v)}
          shapeCount={shapeCount}
          shapeLabels={
            visType === 'pentatonic'
              ? getPentatonicBoxNames(view.focusRootChroma, degreeSpec.pentatonicOffsets, tuning)
              : getShapeLabels(visType, tuning)
          }
          shapeSelection={shapeCount > 0 && !gripView && !po && !soloOn ? selectedShapes : []}
          onToggleShape={(k) => {
            setGrip(null);
            setProgIndex(null);
            if (k === null) {
              setShapeSelection([]);
              return;
            }
            setShapeSelection((prev) => {
              const cur = prev.filter((i) => i < shapeCount);
              return cur.includes(k) ? cur.filter((i) => i !== k) : [...cur, k].sort((a, b) => a - b);
            });
          }}
          shapeOctaves={shapeOctaves}
          onChangeShapeOctaves={isStringSet ? undefined : setShapeOctaves}
          shapeCells={gripView ? gripView.cells : po ? null : activeShape ? activeShape.cells : null}
          shapeRanges={
            gripView
              ? gripView.ranges
              : po
              ? []
              : activeShape
              ? visType === 'pentatonic'
                ? activeShape.ranges.map((r) =>
                    expandPentRangeForModeShape(
                      r,
                      view.focusRootChroma,
                      degreeSpec.scaleOffsets,
                      tuning,
                      24,
                      overlayCells ? [...overlayCells].map((c) => +c.split('-')[1]) : []
                    )
                  )
                : activeShape.ranges
              : []
          }
          ghostIntervals={gripView || po ? {} : ghostIntervals}
          pentaOverlay={visType === 'pentatonic' && !gripView && !po && !soloOn ? pentaOverlay : 'off'}
          onChangePentaOverlay={handlePentaOverlay}
          degreeModeId={modeIdForDegree(activeDegree)}
          overlayIntervals={gripView || po || soloOn ? {} : pentaOverlayNotes.intervals}
          overlayCells={gripView || po || soloOn ? null : overlayCells}
          modeColourFill={MODE_COLOUR_FILL[modeIdForDegree(activeDegree)]}
          solopath={soloOn && soloChords.length > 0 ? { chords: soloChords, focus: soloFocus } : null}
          soloOverrides={soloPlanOverrides}
          onSoloOverride={setSoloOverride}
          onSoloPin={onSoloPin}
          tuning={tuning}
        />

        {/* Chord progression builder */}
        <div className="mt-4 rounded-xl border border-zinc-800/80 bg-[#13161c] px-4 py-3 space-y-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-500 w-20 shrink-0" style={{ order: 0 }}>Progression</span>
            {progression.length === 0 ? (
              <span className="text-zinc-600" style={{ order: 1 }}>Tap chords below to build a progression.</span>
            ) : (
              <ProgressionChips
                chips={progression.map((c) => ({ name: progChordName(selectedKey, c), roman: c.roman, diatonic: c.kind === 'diatonic' }))}
                selected={progIndex}
                onTap={(i) => (progIndex === i ? setProgIndex(null) : selectProgStep(i))}
                onMove={moveProgChord}
              />
            )}
            {progression.length > 0 && (
              <div className="ml-auto flex items-center gap-1.5 flex-wrap" style={{ order: 1000 }}>
                {progression.length >= 2 && (
                  <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSolopath((v) => !v)}
                      aria-pressed={solopath}
                      title="Show a diagonal solo path over the progression"
                      className={`px-2 py-1 transition cursor-pointer ${solopath ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                    >
                      Solopath
                    </button>
                    {solopath &&
                      (['up', 'down'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSolopathDir(d)}
                          aria-pressed={solopathDir === d}
                          title={d === 'up' ? 'Move from low to high frets' : 'Move from high to low frets'}
                          className={`px-2 py-1 border-l border-zinc-800 transition cursor-pointer ${solopathDir === d ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                        >
                          {d === 'up' ? '↗ up' : '↘ down'}
                        </button>
                      ))}
                  </div>
                )}
                <button type="button" onClick={() => selectProgStep((progIndex ?? 0) - 1)} className="px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:bg-zinc-800" title="Previous chord">‹</button>
                <button type="button" onClick={() => selectProgStep(progIndex === null ? 0 : progIndex + 1)} className="px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:bg-zinc-800" title="Next chord">›</button>
                <button
                  type="button"
                  onClick={() => {
                    if (progIndex !== null) {
                      setProgression(progression.filter((_, i) => i !== progIndex));
                      setProgIndex(null);
                    } else {
                      setProgression(progression.slice(0, -1));
                    }
                  }}
                  className="px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                >
                  {progIndex !== null ? 'Remove' : 'Undo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProgression([]);
                    setProgIndex(null);
                  }}
                  className="px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Solopath info: focused chord, transitions, legend */}
          {soloOn && soloFocusChord && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-zinc-500 w-20 shrink-0">Solopath</span>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="inline-flex items-center rounded-md border border-zinc-800 overflow-hidden"
                    title={`Fret where the path starts (${soloStartRange.min}–${soloStartRange.max}); the whole staircase moves with it`}
                  >
                    <button
                      type="button"
                      onClick={() => shiftSoloStart(-1)}
                      disabled={soloStartFret <= soloStartRange.min}
                      className="px-2 py-1 text-zinc-400 hover:bg-zinc-800 cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
                      aria-label="Start one fret lower"
                    >
                      ‹
                    </button>
                    <span className="px-2 py-1 border-x border-zinc-800 text-zinc-400 whitespace-nowrap">
                      Start: <span className="font-mono text-zinc-200">fr {soloStartFret}</span>
                      {soloChords[0]?.shapeLabel && <span className="text-zinc-600"> · {soloChords[0].shapeLabel}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => shiftSoloStart(1)}
                      disabled={soloStartFret >= soloStartRange.max}
                      className="px-2 py-1 text-zinc-400 hover:bg-zinc-800 cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent"
                      aria-label="Start one fret higher"
                    >
                      ›
                    </button>
                  </div>
                  {soloHasOverrides ? (
                    <button
                      type="button"
                      onClick={resetSoloOverrides}
                      className="px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer"
                      title="Back to the planned boxes"
                    >
                      Reset boxes
                    </button>
                  ) : (
                    <span className="text-zinc-600">Tap a box to change it · drag to move it</span>
                  )}
                </div>
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap font-mono">
                  <span className="text-zinc-200">
                    {soloFocusChord.name}
                    {soloFocusChord.shapeLabel && <span className="text-zinc-400"> · {soloFocusChord.shapeLabel}</span>}
                    <span className="text-zinc-500"> · strings {soloFocusChord.groupLabel}</span>
                    <span className="text-zinc-600"> · frets {soloFocusChord.region.min}–{soloFocusChord.region.max}</span>
                  </span>
                  {soloNextChord && (
                    <span className="text-zinc-400">
                      → {soloNextChord.name}
                      {soloFocusChord.transitions.length > 0 ? ': ' : ''}
                      {soloFocusChord.transitions
                        .map((t) => (t.type === 'hold' ? `hold ${t.fromName}` : `${t.fromName}→${t.toName}`))
                        .join(' · ')}
                      {soloFocusChord.jumpToNext && (
                        <span className="text-zinc-600">{soloFocusChord.wrap ? ' (loop, jump)' : ' (octave jump)'}</span>
                      )}
                    </span>
                  )}
                  <span className="text-zinc-600">passing: {soloFocusChord.scale.join(' ')}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-500">
                  {([
                    ['Target', 'primary', false, '3rd/7th'],
                    ['Root', 'secondary', true, ''],
                    ['Chord tone', 'secondary', false, ''],
                    ['Passing', 'passing', false, ''],
                  ] as const).map(([name, role, isRoot, sub]) => {
                    const st = soloNoteStyle(role, isRoot, soloFocusChord.colorIndex);
                    return (
                      <span key={name} className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ background: st.fill, boxShadow: `inset 0 0 0 1.5px ${st.stroke}` }} />
                        <span className="text-zinc-400">{name}</span>
                        {sub && <span className="text-zinc-600">{sub}</span>}
                      </span>
                    );
                  })}
                  <span>→ move · = hold · ‹ › step chords</span>
                </div>
              </div>
            </div>
          )}

          {/* Spice-up suggestions for the selected chord */}
          {selectedProg && selectedProgDef && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-500 w-20 shrink-0">Spice up</span>
              {[selectedProgDef.suffix, ...selectedProgDef.spiceUps].map((suf) => (
                <button
                  key={suf || 'basic'}
                  type="button"
                  onClick={() => setProgSuffix(suf)}
                  className={`px-2 py-1 rounded-md border font-mono transition cursor-pointer ${
                    selectedProg.suffix === suf
                      ? 'bg-zinc-700 border-zinc-500 text-zinc-100'
                      : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {progChordName(selectedKey, { ...selectedProg, suffix: suf })}
                </button>
              ))}
              {selectedProgDef.note && <span className="text-zinc-500 basis-full pl-[5.5rem]">{selectedProgDef.note}</span>}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-500 w-20 shrink-0">Add</span>
            <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden mr-1">
              {(['diatonic', 'borrowed', 'secondary'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setAddGroup(g)}
                  className={`px-2 py-1 transition cursor-pointer ${addGroup === g ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'}`}
                >
                  {g === 'diatonic' ? 'Diatonic' : g === 'borrowed' ? 'Borrowed' : 'Sec. dominants'}
                </button>
              ))}
            </div>
            {(addGroup === 'diatonic' ? PROG_DIATONIC : addGroup === 'borrowed' ? PROG_BORROWED : PROG_SECONDARY).map((d) => (
              <button
                key={d.roman}
                type="button"
                onClick={() => addProgChord(d)}
                title={d.note}
                className="flex flex-col items-center px-2.5 py-1 rounded-md border border-zinc-800 text-zinc-400 font-mono hover:bg-zinc-800 hover:text-zinc-200 transition cursor-pointer"
              >
                <span className="text-sm">{progChordName(selectedKey, d)}</span>
                <span className="text-[10px] text-zinc-600">{d.roman}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
