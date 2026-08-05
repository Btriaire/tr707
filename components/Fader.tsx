"use client";

import { useCallback, useRef } from "react";

// Fader vertical façon mixette TR-707 : glisser verticalement pour régler,
// la valeur monte vers le haut (comme un vrai fader physique).
export default function Fader({
  label,
  value,
  onChange,
  defaultValue = 0.75,
  tall,
}: {
  label: string;
  value: number; // 0..1
  onChange: (v: number) => void;
  defaultValue?: number;
  tall?: boolean;
}) {
  const drag = useRef<{ startY: number; startV: number } | null>(null);
  const trackHeight = tall ? 150 : 120;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      drag.current = { startY: e.clientY, startV: value };
    },
    [value],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      const dy = drag.current.startY - e.clientY;
      onChange(Math.min(1, Math.max(0, drag.current.startV + dy / trackHeight)));
    },
    [onChange, trackHeight],
  );
  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      onChange(Math.min(1, Math.max(0, value - Math.sign(e.deltaY) * 0.03)));
    },
    [onChange, value],
  );

  return (
    <div className={`fader-unit${tall ? " tall" : ""}`}>
      <div className="fader-scale-label top">MAX</div>
      <div
        className="fader-track"
        style={{ height: trackHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={() => onChange(defaultValue)}
        role="slider"
        aria-label={label}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="fader-groove" />
        <div className="fader-cap" style={{ bottom: `${value * 100}%` }} />
      </div>
      <div className="fader-scale-label bottom">MIN</div>
      <div className="fader-label">{label}</div>
    </div>
  );
}
