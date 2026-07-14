// Small "?" info dot that reveals a tooltip on hover (group-hover driven), used
// to explain what each visual/physical control does (docs/new_spec.md §4).
export function Hint({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-neon-blue/50 text-[10px] leading-none text-neon-blue/80">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 w-56 -translate-x-1/2 rounded border border-white/10 bg-black/85 px-2 py-1 text-[11px] leading-snug text-gray-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export default Hint;
