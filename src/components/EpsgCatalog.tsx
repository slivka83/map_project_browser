import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { EPSG_PRESETS } from '../constants/epsgPresets';
import type { ProjectionParams } from '../store/useAppStore';
import Dropdown from './Dropdown';
import { FAMILY_LABEL, DISTORTION_LABEL } from './ui/labels';

type Col = 'code' | 'type' | 'distortion' | 'name' | 'units';
type ColKind = 'text' | 'select';

interface ColDef {
  key: Col;
  label: string;
  kind: ColKind;
}

const COLS: ColDef[] = [
  { key: 'code', label: 'EPSG-код', kind: 'text' },
  { key: 'type', label: 'Вид проекции', kind: 'select' },
  { key: 'distortion', label: 'Тип искажения', kind: 'select' },
  { key: 'name', label: 'Название', kind: 'text' },
  { key: 'units', label: 'Единицы', kind: 'select' },
];

interface Props {
  onClose: () => void;
  applyPreset: (preset: Partial<ProjectionParams>) => void;
}

export default function EpsgCatalog({ onClose, applyPreset }: Props) {
  const [active, setActive] = useState<Col | null>(null);
  const [codeQ, setCodeQ] = useState('');
  const [nameQ, setNameQ] = useState('');
  const [typeSel, setTypeSel] = useState('');
  const [distortionSel, setDistortionSel] = useState('');
  const [unitSel, setUnitSel] = useState('');

  const familyOptions = useMemo(
    () => Array.from(new Set(EPSG_PRESETS.map((e) => FAMILY_LABEL[e.params.family]))),
    [],
  );
  const distortionOptions = useMemo(
    () => Array.from(new Set(EPSG_PRESETS.map((e) => DISTORTION_LABEL[e.params.distortion]))),
    [],
  );
  const unitOptions = useMemo(
    () => Array.from(new Set(EPSG_PRESETS.map((e) => e.units))),
    [],
  );

  const rows = useMemo(
    () =>
      EPSG_PRESETS.filter((e) => {
        if (codeQ && !e.code.toLowerCase().includes(codeQ.toLowerCase())) return false;
        if (nameQ && !e.name.toLowerCase().includes(nameQ.toLowerCase())) return false;
        if (typeSel && FAMILY_LABEL[e.params.family] !== typeSel) return false;
        if (distortionSel && DISTORTION_LABEL[e.params.distortion] !== distortionSel) return false;
        if (unitSel && e.units !== unitSel) return false;
        return true;
      }),
    [codeQ, nameQ, typeSel, distortionSel, unitSel],
  );

  // Current value of the column's filter state, and its setter. Centralising
  // the column→state mapping removes the repeated ternaries in the header.
  const filterValue = (c: Col): string =>
    c === 'code'
      ? codeQ
      : c === 'name'
        ? nameQ
        : c === 'type'
          ? typeSel
          : c === 'distortion'
            ? distortionSel
            : unitSel;

  const setFilterValue = (c: Col, v: string): void => {
    if (c === 'code') setCodeQ(v);
    else if (c === 'name') setNameQ(v);
    else if (c === 'type') setTypeSel(v);
    else if (c === 'distortion') setDistortionSel(v);
    else setUnitSel(v);
  };

  const hasFilter = (c: Col) => !!filterValue(c);

  const onHeaderClick = (c: Col) => setActive((prev) => (prev === c ? null : c));

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[920px] flex-col overflow-hidden rounded-lg border border-white/10 bg-panel-bg p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="neon-text text-sm font-semibold">Выбор EPSG-проекции</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="text-lg leading-none text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-panel-bg text-left text-xs uppercase tracking-wider text-neon-blue/80">
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-2 py-2 align-middle">
                    <div className="flex h-7 items-center">
                          {active === c.key ? (
                            c.kind === 'text' ? (
                              <input
                                autoFocus
                                value={filterValue(c.key)}
                                onChange={(e) => setFilterValue(c.key, e.target.value)}
                                onBlur={() => setActive(null)}
                                placeholder={c.label}
                                className="h-full w-full rounded border border-neon-blue/50 bg-panel-bg px-1.5 text-[11px] normal-case text-neon-blue outline-none drop-shadow-[0_0_3px_var(--color-neon-blue-soft)]"
                              />
                             ) : (
                              <Dropdown
                                variant="inline"
                                initialOpen
                                value={filterValue(c.key)}
                                options={
                                  (c.key === 'type'
                                    ? familyOptions
                                    : c.key === 'distortion'
                                      ? distortionOptions
                                      : unitOptions
                                  ).map((o) => ({ value: o, label: o }))
                                }
                                allLabel="Все"
                                onChange={(v) => setFilterValue(c.key, v)}
                                onClose={() => setActive(null)}
                              />
                             )
                           ) : (
                        <button
                          type="button"
                          onClick={() => onHeaderClick(c.key)}
                          className={`flex h-full w-full items-center gap-1 normal-case transition hover:text-neon-blue ${
                            hasFilter(c.key) ? 'text-neon-blue' : ''
                          }`}
                        >
                          {c.label}
                          {c.kind === 'text' ? (
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70">
                              <circle cx="11" cy="11" r="7" />
                              <path d="M21 21l-4.3-4.3" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr
                  key={entry.code}
                  onClick={() => {
                    applyPreset(entry.params);
                    onClose();
                  }}
                  className="cursor-pointer border-t border-white/5 text-white/80 transition hover:bg-neon-blue/10 hover:text-neon-blue"
                >
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-neon-blue/90">{entry.code}</td>
                  <td className="whitespace-nowrap px-2 py-2">{FAMILY_LABEL[entry.params.family]}</td>
                  <td className="whitespace-nowrap px-2 py-2">{DISTORTION_LABEL[entry.params.distortion]}</td>
                  <td className="whitespace-nowrap px-2 py-2">{entry.name}</td>
                  <td className="whitespace-nowrap px-2 py-2">{entry.units}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-white/40">
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
