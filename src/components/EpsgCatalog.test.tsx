import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EpsgCatalog from './EpsgCatalog';
import type { ProjectionParams } from '../store/useAppStore';

const setup = () => {
  const onClose = vi.fn();
  const applyPreset = vi.fn();
  render(<EpsgCatalog onClose={onClose} applyPreset={applyPreset} />);
  return { onClose, applyPreset };
};

describe('EpsgCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog title, close button and the four column headers', () => {
    setup();
    expect(screen.getByText('Выбор EPSG-проекции')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeTruthy();
    expect(screen.getByText('EPSG-код')).toBeTruthy();
    expect(screen.getByText('Вид проекции')).toBeTruthy();
    expect(screen.getByText('Тип искажения')).toBeTruthy();
    expect(screen.getByText('Название')).toBeTruthy();
    expect(screen.getByText('Единицы')).toBeTruthy();
  });

  it('opens an inline search input when a text header (EPSG-код) is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'EPSG-код' }));
    expect(screen.getByPlaceholderText('EPSG-код')).toBeTruthy();
  });

  it('opens a dropdown filter (starting with "Все") when a select header (Вид проекции) is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Вид проекции' }));
    // the first option must be the "all" value
    expect(screen.getAllByText('Все').length).toBeGreaterThan(0);
    // family values derived from the presets are offered (option buttons)
    expect(screen.getByRole('button', { name: 'Цилиндрическая' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Азимутальная перспективная' })).toBeTruthy();
  });

  it('filters rows by a text query and shows an empty state', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'EPSG-код' }));
    fireEvent.change(screen.getByPlaceholderText('EPSG-код'), {
      target: { value: 'NO_SUCH_CODE' },
    });
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  });

  it('filters rows by a select filter (Вид проекции = Азимутальная)', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Вид проекции' }));
    fireEvent.click(screen.getByRole('button', { name: 'Азимутальная перспективная' }));
    // an azimuthal code is present, a cylindrical one is gone
    expect(screen.getByText('EPSG:9810')).toBeTruthy();
    expect(screen.queryByText('EPSG:3395')).toBeNull();
  });

  it('applies the preset and closes when a row is selected', () => {
    const { onClose, applyPreset } = setup();
    fireEvent.click(screen.getByText('CYL-EA-GALL-PETERS'));
    expect(applyPreset).toHaveBeenCalledTimes(1);
    const arg = applyPreset.mock.calls[0][0] as Partial<ProjectionParams>;
    expect(arg.family).toBe('cylindrical');
    expect(arg.distortion).toBe('equalArea');
    expect(arg.phiOrigin).toBe(45);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('filters rows by a select filter (Тип искажения = Равноугольная)', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Тип искажения' }));
    // the "all" option plus the distortion values are offered
    expect(screen.getAllByText('Все').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Равноугольная' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Равноугольная' }));
    // a conformal cylindrical code stays, an equal-area one is removed
    expect(screen.getByText('EPSG:3395')).toBeTruthy();
    expect(screen.queryByText('CYL-EA-GALL-PETERS')).toBeNull();
  });

  it('locks column widths via a fixed table layout (colgroup)', () => {
    setup();
    const table = screen.getByRole('table');
    const colgroup = table.querySelector('colgroup');
    expect(colgroup).not.toBeNull();
    expect(colgroup?.querySelectorAll('col').length).toBe(5);
  });

  it('filters rows by Вид проекции = Коническая (only conic rows remain)', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Вид проекции' }));
    expect(screen.getByRole('button', { name: 'Коническая' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Коническая' }));
    expect(screen.getByText('EPSG:9801')).toBeTruthy(); // Lambert conformal conic
    expect(screen.queryByText('EPSG:3395')).toBeNull();
    expect(screen.queryByText('EPSG:9810')).toBeNull();
  });

  it('filters rows by Вид проекции = Цилиндрическая (only cylindrical rows remain)', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Вид проекции' }));
    fireEvent.click(screen.getByRole('button', { name: 'Цилиндрическая' }));
    expect(screen.getByText('EPSG:3395')).toBeTruthy();
    expect(screen.queryByText('EPSG:9802')).toBeNull();
  });

  it('filters rows by Вид проекции = Азимутальная математическая', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Вид проекции' }));
    fireEvent.click(screen.getByRole('button', { name: 'Азимутальная математическая' }));
    expect(screen.getByText('EPSG:9830')).toBeTruthy(); // Lambert azimuthal equal area
    expect(screen.queryByText('EPSG:3395')).toBeNull();
  });

  it('text search narrows within the active family filter', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Вид проекции' }));
    fireEvent.click(screen.getByRole('button', { name: 'Азимутальная перспективная' }));
    fireEvent.click(screen.getByRole('button', { name: 'EPSG-код' }));
    fireEvent.change(screen.getByPlaceholderText('EPSG-код'), { target: { value: '981' } });
    // 9810 (gnomonic) matches, 9809 (orthographic) is dropped from the azimuthal-perspective set
    expect(screen.getByText('EPSG:9810')).toBeTruthy();
    expect(screen.queryByText('EPSG:9809')).toBeNull();
  });
});
