"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Fader from "@/components/Fader";
import Knob from "@/components/Knob";
import {
  TR707Engine,
  INSTRUMENTS,
  FADER_IDS,
  FADER_LABELS,
  KITS,
  NUM_STEPS,
  NUM_PATTERNS,
  BANK_LABELS,
  defaultPattern,
  demoPattern,
  randomPattern,
  type InstrumentId,
  type FaderId,
  type Pattern,
} from "@/lib/synth";

const STORAGE_KEY = "tr707-state-v1";

// regroupement des 15 voix en 8 lignes LCD, comme la façade du vrai (2 sous-
// voix par ligne pour BD/SD/HH/Cymbal, 3 pour les toms, 1 pour le reste)
const LCD_ROWS: { label: string; slots: InstrumentId[] }[] = [
  { label: "ACCENT", slots: [] },
  { label: "CYMBAL", slots: ["crash", "ride"] },
  { label: "HIHAT", slots: ["hhClosed", "hhOpen"] },
  { label: "HCP/TAMB", slots: ["clap", "tamb"] },
  { label: "RIM/COWBELL", slots: ["rim", "cowbell"] },
  { label: "LM/H TOM", slots: ["lt", "mt", "ht"] },
  { label: "SNARE DRUM", slots: ["sd1", "sd2"] },
  { label: "BASS DRUM", slots: ["bd1", "bd2"] },
];

const PAD_LABELS: { label: string; span: InstrumentId[] }[] = [
  { label: "Bass Drum", span: ["bd1", "bd2"] },
  { label: "Snare Drum", span: ["sd1", "sd2"] },
  { label: "Low Tom", span: ["lt"] },
  { label: "Mid Tom", span: ["mt"] },
  { label: "Hi Tom", span: ["ht"] },
  { label: "RIMshot", span: ["rim"] },
  { label: "COWbell", span: ["cowbell"] },
  { label: "Hand Clap", span: ["clap"] },
  { label: "TAMBourine", span: ["tamb"] },
  { label: "Hi Hat", span: ["hhClosed", "hhOpen"] },
  { label: "CYmbal", span: ["crash", "ride"] },
];

const SCALE_STEPS = [16, 12, 8];

export default function TR707() {
  const engineRef = useRef<TR707Engine | null>(null);
  if (!engineRef.current) engineRef.current = new TR707Engine();
  const engine = engineRef.current;
  useEffect(() => {
    (window as unknown as { __tr707: TR707Engine }).__tr707 = engine;
  }, [engine]);

  const [faders, setFaders] = useState<Record<FaderId, number>>({ ...engine.faders });
  const [volume, setVolume] = useState(engine.volume);
  const [kitIndex, setKitIndex] = useState(0);
  const [shuffle, setShuffle] = useState(0);
  const [patterns, setPatterns] = useState<Pattern[]>(() => {
    const arr = Array.from({ length: NUM_PATTERNS }, () => defaultPattern());
    arr[0] = demoPattern();
    return arr;
  });
  const [currentPattern, setCurrentPattern] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const [selectedInst, setSelectedInst] = useState<InstrumentId>("bd1");
  const [editMode, setEditMode] = useState(true);
  const [accentEdit, setAccentEdit] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [listName] = useState("1 Preset");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.faders) setFaders((f) => ({ ...f, ...s.faders }));
        if (typeof s.volume === "number") setVolume(s.volume);
        if (typeof s.kitIndex === "number") setKitIndex(s.kitIndex);
        if (typeof s.shuffle === "number") setShuffle(s.shuffle);
        if (Array.isArray(s.patterns) && s.patterns.length === NUM_PATTERNS) setPatterns(s.patterns);
        if (typeof s.currentPattern === "number") setCurrentPattern(s.currentPattern);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ faders, volume, kitIndex, shuffle, patterns, currentPattern }),
        );
      } catch {}
    }, 300);
    return () => clearTimeout(id);
  }, [faders, volume, kitIndex, shuffle, patterns, currentPattern, loaded]);

  useEffect(() => {
    if (!engine.isReady) return;
    for (const id of FADER_IDS) engine.setFader(id, faders[id]);
  }, [faders, engine]);
  useEffect(() => {
    if (engine.isReady) engine.setVolume(volume);
  }, [volume, engine]);
  useEffect(() => {
    if (engine.isReady) engine.setKit(kitIndex);
  }, [kitIndex, engine]);
  useEffect(() => {
    engine.shuffle = shuffle;
  }, [shuffle, engine]);
  useEffect(() => {
    engine.patterns = patterns;
  }, [patterns, engine]);
  useEffect(() => {
    engine.currentPattern = currentPattern;
  }, [currentPattern, engine]);
  useEffect(() => {
    engine.onStep = (s) => setPlayhead(s);
    return () => {
      engine.onStep = null;
    };
  }, [engine]);

  const pattern = patterns[currentPattern];

  const updatePattern = useCallback(
    (patch: Partial<Pattern>) => {
      setPatterns((ps) => ps.map((p, i) => (i === currentPattern ? { ...p, ...patch } : p)));
    },
    [currentPattern],
  );

  const togglePlay = useCallback(() => {
    engine.toggle();
    setPlaying(engine.playing);
    if (!engine.playing) setPlayhead(-1);
  }, [engine]);

  const onStepToggle = useCallback(
    (idx: number) => {
      if (accentEdit) {
        const accent = [...pattern.accent];
        accent[idx] = !accent[idx];
        updatePattern({ accent });
        return;
      }
      const steps = { ...pattern.steps, [selectedInst]: [...pattern.steps[selectedInst]] };
      steps[selectedInst][idx] = !steps[selectedInst][idx];
      updatePattern({ steps });
    },
    [accentEdit, pattern, selectedInst, updatePattern],
  );

  const onPadTap = useCallback(
    (id: InstrumentId) => {
      engine.playPreview(id);
      if (editMode) {
        setSelectedInst(id);
        setAccentEdit(false);
      }
    },
    [engine, editMode],
  );

  const onPatternBank = useCallback((i: number) => setCurrentPattern(i), []);

  const onClear = useCallback(() => updatePattern(defaultPattern(pattern.name, pattern.tempo)), [updatePattern, pattern.name, pattern.tempo]);
  const onRandomize = useCallback(() => updatePattern(randomPattern(pattern.length)), [updatePattern, pattern.length]);

  const onScaleClick = useCallback(() => {
    const idx = SCALE_STEPS.indexOf(pattern.length);
    const next = SCALE_STEPS[(idx + 1) % SCALE_STEPS.length] ?? 16;
    updatePattern({ length: next });
  }, [pattern.length, updatePattern]);

  const selInstDef = INSTRUMENTS.find((i) => i.id === selectedInst)!;

  return (
    <div className="stage">
      <div className="chassis">
        <div className="panel">
          {/* ————— header ————— */}
          <div className="top-row">
            <div className="brand-block">
              <div className="roland-logo">
                <span className="roland-badge">R</span>Roland
              </div>
              <div className="cart-slot">
                <div className="cart-body">
                  <div className="cart-tab">CARTRIDGE</div>
                  <div className="cart-name">M-64C</div>
                </div>
              </div>
            </div>

            <div className="lcd-block">
              <div className="lcd-screen">
                <div className="lcd-grid" style={{ gridTemplateColumns: `70px repeat(${NUM_STEPS}, 1fr)` }}>
                  <div className="lcd-corner">STEP</div>
                  {Array.from({ length: NUM_STEPS }, (_, i) => (
                    <div key={i} className="lcd-step-num">
                      {i + 1}
                    </div>
                  ))}
                  {LCD_ROWS.map((row) => (
                    <div key={row.label} className="lcd-row-wrap" style={{ display: "contents" }}>
                      <div className="lcd-row-label">{row.label}</div>
                      {Array.from({ length: NUM_STEPS }, (_, c) => (
                        <div key={c} className="lcd-cell">
                          {row.label === "ACCENT"
                            ? pattern.accent[c] && <div className="lcd-dot" />
                            : row.slots.map((inst, si) => (
                                pattern.steps[inst][c] && (
                                  <div
                                    key={inst}
                                    className="lcd-dot"
                                    style={{ top: `${((si + 0.5) / row.slots.length) * 100}%` }}
                                  />
                                )
                              ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="lcd-fields">
                  <div className="lcd-field">
                    <span className="lcd-field-label">LIST</span>
                    <span className="lcd-field-value">{listName}</span>
                  </div>
                  <div className="lcd-field">
                    <span className="lcd-field-label">PTN</span>
                    <input
                      className="lcd-field-input"
                      value={pattern.name}
                      onChange={(e) => updatePattern({ name: e.target.value })}
                    />
                    <div className="lcd-tempo-stepper">
                      <button onClick={() => updatePattern({ tempo: Math.max(40, pattern.tempo - 1) })}>▲</button>
                      <button onClick={() => updatePattern({ tempo: Math.min(300, pattern.tempo + 1) })}>▼</button>
                    </div>
                    <span className="lcd-field-value tempo">{pattern.tempo}</span>
                  </div>
                  <div className="lcd-field">
                    <span className="lcd-field-label">KIT</span>
                    <span className="lcd-field-value">{KITS[kitIndex].name}</span>
                    <div className="lcd-tempo-stepper">
                      <button onClick={() => setKitIndex((i) => (i - 1 + KITS.length) % KITS.length)}>▲</button>
                      <button onClick={() => setKitIndex((i) => (i + 1) % KITS.length)}>▼</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="fader-block">
              {FADER_IDS.map((id) => (
                <Fader key={id} label={FADER_LABELS[id]} value={faders[id]} onChange={(v) => setFaders((f) => ({ ...f, [id]: v }))} />
              ))}
              <Fader label="VOLUME" value={volume} onChange={setVolume} defaultValue={0.85} tall />
            </div>

            <div className="panel-select">
              <div className="panel-select-title">PANEL</div>
              {["ORG", "1", "2"].map((p, i) => (
                <button key={p} className={`panel-radio${i === 0 ? " active" : ""}`}>
                  <span className="led-dot small" />
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* ————— rangée mi-panneau ————— */}
          <div className="mid-row">
            <div className="lock-block">
              <button className="lock-btn">POSITION LOCK
                <br />
                TO DAW
              </button>
            </div>

            <div className="pattern-block">
              <div className="section-title">PATTERN</div>
              <div className="pattern-grid">
                {BANK_LABELS.map((label, i) => (
                  <button
                    key={label}
                    className={`pattern-btn${currentPattern === i ? " active" : ""}`}
                    onClick={() => onPatternBank(i)}
                  >
                    <span className="led-dot small" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-block">
              <div className="section-title">MENU</div>
              <div className="menu-grid">
                <button className="menu-btn wide">
                  <span className="led-dot small" /> MIDI
                </button>
                <button className="menu-btn wide">
                  <span className="led-dot small on" /> AUDIO
                </button>
                <button className="menu-btn">OPTION</button>
                <button className="menu-btn">DRAG &amp; DROP</button>
                <button className="menu-btn">HELP</button>
                <button className="menu-btn">SUB OUT</button>
                <button className="menu-btn">ABOUT</button>
              </div>
              <button className={`edit-btn${editMode ? " active" : ""}`} onClick={() => setEditMode((e) => !e)}>
                <span className={`led-dot small${editMode ? " on" : ""}`} />
                EDIT
              </button>
            </div>

            <div className="shuffle-block">
              <Knob label="SHUFFLE" value={shuffle} onChange={setShuffle} defaultValue={0} />
            </div>
          </div>

          {/* ————— scale / accent-edit ————— */}
          <div className="scale-row">
            <button className="scale-btn" onClick={onScaleClick}>
              SCALE
              <br />
              <span>{pattern.length}</span>
            </button>
            <div className="scale-display">
              {Array.from({ length: 4 }, (_, g) => (
                <div key={g} className="scale-group">
                  {Array.from({ length: 4 }, (_, i) => {
                    const stepIdx = g * 4 + i;
                    const beyond = stepIdx >= pattern.length;
                    return (
                      <span key={i} className={`scale-note${beyond ? " dim" : ""}${i === 0 ? " beat" : ""}`}>
                        {i === 0 ? "♩" : "♪"}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            <button
              className={`accent-edit-btn${accentEdit ? " active" : ""}`}
              onClick={() => setAccentEdit((a) => !a)}
            >
              <span className={`led-dot small${accentEdit ? " on" : ""}`} />
              ACCENT
              <br />
              EDIT
            </button>
          </div>

          {/* ————— step LEDs (playhead / programmation) ————— */}
          <div className="step-led-row">
            {Array.from({ length: NUM_STEPS }, (_, i) => {
              const active = accentEdit ? pattern.accent[i] : pattern.steps[selectedInst][i];
              return (
                <button
                  key={i}
                  className={`step-led-btn${i >= pattern.length ? " beyond" : ""}`}
                  onClick={() => onStepToggle(i)}
                >
                  <span className={`led-dot${i === playhead ? " on playhead" : active ? " on filled" : ""}`} />
                  <span className="step-num">{i + 1}</span>
                </button>
              );
            })}
          </div>

          {/* ————— pads instruments ————— */}
          <div className="pad-row">
            <button className={`start-stop-pad${playing ? " on" : ""}`} onClick={togglePlay}>
              START
              <br />
              /STOP
            </button>
            {INSTRUMENTS.map((inst) => (
              <button
                key={inst.id}
                className={`inst-pad${selectedInst === inst.id && !accentEdit ? " selected" : ""}`}
                onPointerDown={() => onPadTap(inst.id)}
              >
                {inst.short}
              </button>
            ))}
          </div>
          <div className="pad-label-row">
            {PAD_LABELS.map((pl) => (
              <div key={pl.label} className="pad-label" style={{ gridColumn: `span ${pl.span.length}` }}>
                {pl.label}
              </div>
            ))}
          </div>

          <div className="bottom-bar">
            <button className="chip-btn" onClick={onClear}>
              CLEAR PATTERN
            </button>
            <button className="chip-btn" onClick={onRandomize}>
              RANDOM
            </button>
            <div className="hint">
              Pads = déclenche + sélectionne l&apos;instrument (si EDIT actif) · rangée numérotée = pas de l&apos;instrument
              sélectionné ({selInstDef.name}) ou de l&apos;accent si ACCENT EDIT est actif
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
