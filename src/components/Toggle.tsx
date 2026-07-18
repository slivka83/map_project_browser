import type { ReactNode } from 'react';
import { toggleTrack, toggleTrackOn, toggleTrackOff, toggleThumb, toggleThumbOn, toggleThumbOff } from './ui/styles';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  icon?: ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

// On/off switch used throughout the visualization panel. Renders as a horizontal
// row: optional icon + label + the switch track/thumb. Accessibility: a real
// <button role="switch"> so keyboard and screen-reader users can toggle it.
export default function Toggle({ checked, onChange, label, icon, disabled = false, size = 'md' }: Props) {
  const labelSize = size === 'sm' ? 'text-[11px]' : 'text-[12px]';
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
      {icon && <span className="flex h-4 w-4 items-center justify-center text-neon-blue/80">{icon}</span>}
      {label && <span className={`${labelSize} text-gray-300`}>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`${toggleTrack} ${checked ? toggleTrackOn : toggleTrackOff}`}
      >
        <span className={`${toggleThumb} ${checked ? toggleThumbOn : toggleThumbOff}`} />
      </button>
    </label>
  );
}
