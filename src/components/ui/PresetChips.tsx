import { presetChip, presetChipActive } from './styles';

// A row of "preset" chips used by the azimuthal touch-point picker (and
// reusable for any lon/lat preset list). The active chip is the one whose
// (phi, lambda) is within 0.5° of the current `active` point. Extracted from
// ControlPanel so the same chip row can back other preset pickers later.
export default function PresetChips({
  presets,
  active,
  onSelect,
}: {
  presets: { label: string; phi: number; lambda: number }[];
  active: { phi: number; lambda: number } | null;
  onSelect: (phi: number, lambda: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((p) => {
        const isActive =
          active != null && Math.abs(active.phi - p.phi) < 0.5 && Math.abs(active.lambda - p.lambda) < 0.5;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onSelect(p.phi, p.lambda)}
            className={`${presetChip} ${isActive ? presetChipActive : ''}`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
