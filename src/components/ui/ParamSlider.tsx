import { fieldRow, labelClass, sliderClass } from './styles';

// Generic labelled range slider with a value readout, used by ControlPanel for
// every projection parameter (lambda0, phiOrigin, scaleFactor, gamma, k₀, …).
// Shows a 🔒 prefix and a dimmed label when `disabled` (a locked param), or a
// 🔗 + tooltip when `disabled` AND `tooltip` is provided (a param linked to the
// selected variant). The value readout on the right carries the `suffix`
// (default '°'). Extracted from ControlPanel so any other panel can reuse the
// same control without duplicating the a11y / disabled-state wiring.
export default function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '°',
  disabled = false,
  tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
  disabled?: boolean;
  tooltip?: string | null;
}) {
  return (
    <div className={fieldRow} title={disabled && tooltip ? tooltip : undefined}>
      {tooltip && disabled ? (
        <span className={`${labelClass} w-36 shrink-0 cursor-help opacity-40`} title={tooltip}>
          {label} 🔗
        </span>
      ) : (
        <span className={`${labelClass} w-36 shrink-0 ${disabled ? 'opacity-40' : ''}`}>
          {disabled ? `🔒 ${label}` : label}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-[4px]">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={`${value}${suffix}`}
          onChange={(e) => onChange(Number(e.target.value))}
          className={sliderClass}
        />
        <span className={`w-12 shrink-0 text-right text-[12px] ${disabled ? 'text-gray-500' : 'text-neon-blue'}`}>
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}
