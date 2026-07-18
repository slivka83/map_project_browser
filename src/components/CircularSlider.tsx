import { useCallback, useRef } from 'react';

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: number;
  title?: string;
  centerLabel?: string;
}

// Circular dial slider (like a clock / protractor) for angular parameters such
// as the cylinder tilt or camera azimuth. The filled arc spans from the top
// (12 o'clock = min) clockwise to the current value; a draggable thumb sits at
// the arc end. Pointer + touch are both supported.
export default function CircularSlider({
  value,
  min = -180,
  max = 180,
  step = 1,
  onChange,
  disabled = false,
  size = 80,
  title,
  centerLabel,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);

  const angleForValue = (v: number): number => {
    const t = (v - min) / (max - min);
    return -90 + t * 360; // 0 at top, clockwise
  };

  const valueForAngle = useCallback(
    (deg: number): number => {
      let t = (deg + 90) / 360;
      t = Math.max(0, Math.min(1, t));
      const raw = min + t * (max - min);
      const snapped = Math.round(raw / step) * step;
      return Math.max(min, Math.min(max, snapped));
    },
    [min, max, step],
  );

  const polar = (deg: number, r: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [size / 2 + r * Math.cos(a), size / 2 + r * Math.sin(a)];
  };

  const handlePointer = (clientX: number, clientY: number) => {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    onChange(valueForAngle(deg));
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    handlePointer(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || e.buttons === 0) return;
    handlePointer(e.clientX, e.clientY);
  };

  const r = size / 2 - 8;
  const startDeg = -90;
  const endDeg = angleForValue(value);
  // Arc sweep (clockwise). If value === min, draw nothing. Use two arcs via path.
  const [sx, sy] = polar(startDeg, r);
  const [ex, ey] = polar(endDeg, r);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  const arcPath = Math.abs(endDeg - startDeg) < 0.5 ? '' : `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweep} ${ex} ${ey}`;
  const [tx, ty] = polar(endDeg, r);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled}
      aria-label={title}
      className={disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer touch-none select-none'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <circle cx={size / 2} cy={size / 2} r={r} className="circular-slider-track" strokeWidth={3} />
      {arcPath && <path d={arcPath} className="circular-slider-fill" strokeWidth={3} style={{ transition: 'stroke-dashoffset 0.15s' }} />}
      <circle cx={tx} cy={ty} r={6} className="circular-slider-thumb" />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" className="fill-neon-blue text-[12px]">
        {centerLabel ?? `${value}°`}
      </text>
    </svg>
  );
}
