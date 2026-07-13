import { useEffect, useRef, useState } from 'react';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  // When provided, a leading "show all" entry is added (mapped to the empty string).
  allLabel?: string;
  // Called after a selection and on outside click (used to close the parent popover).
  onClose?: () => void;
  variant?: 'button' | 'inline';
  initialOpen?: boolean;
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Custom dark dropdown. Native <select> popups ignore CSS background on most
// browsers (they render white), so we keep this custom control to hold the theme.
// Generic over the option value type so callers avoid string→domain casts.
export default function Dropdown<T extends string = string>({
  value,
  options,
  onChange,
  allLabel,
  onClose,
  variant = 'button',
  initialOpen = false,
}: Props<T>) {
  const [open, setOpen] = useState(initialOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onClose?.();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);

  const items: DropdownOption<T>[] = allLabel !== undefined
    ? [{ value: '' as T, label: allLabel }, ...options]
    : options;

  const current = items.find((o) => o.value === value) ?? items[0];

  const triggerClass =
    variant === 'button'
      ? 'flex w-full items-center justify-between rounded border border-neon-blue/50 bg-panel-bg px-2 py-1 text-[12px] font-medium text-neon-blue outline-none transition drop-shadow-[0_0_3px_var(--color-neon-blue-soft)] focus:border-neon-blue focus:bg-neon-blue/10'
      : 'flex h-full w-full items-center justify-between gap-1 text-left text-neon-blue';

  const menuClass =
    variant === 'button'
      ? 'absolute z-20 mt-1 w-full overflow-hidden rounded border border-neon-blue/50 bg-panel-bg py-1 shadow-2xl shadow-black/60'
      : 'absolute left-0 top-full z-30 mt-1 max-h-48 w-44 overflow-auto rounded border border-neon-blue/50 bg-panel-bg py-1 shadow-2xl shadow-black/60';

  return (
    <div ref={ref} className={variant === 'button' ? 'relative w-full flex-1' : 'relative'}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerClass}>
        <span className="truncate">{current?.label ?? ''}</span>
        <Caret open={open} />
      </button>
      {open && (
        <ul className={menuClass}>
          {items.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  onClose?.();
                }}
                className={`block w-full px-2 py-1 text-left text-[11px] transition ${
                  o.value === value
                    ? 'bg-neon-blue/20 text-neon-blue'
                    : 'text-white/80 hover:bg-neon-blue/10 hover:text-neon-blue'
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
