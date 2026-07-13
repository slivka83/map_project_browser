import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dropdown from './Dropdown';

const OPTIONS = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета' },
];

describe('Dropdown', () => {
  it('shows the current option label when closed', () => {
    render(<Dropdown value="a" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByText('Альфа')).toBeTruthy();
  });

  it('opens on trigger click and lists all options', () => {
    render(<Dropdown value="a" options={OPTIONS} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Бета' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Альфа' }));
    expect(screen.getByRole('button', { name: 'Бета' })).toBeTruthy();
  });

  it('calls onChange with the selected value and closes', () => {
    const onChange = vi.fn();
    render(<Dropdown value="a" options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Альфа' }));
    fireEvent.click(screen.getByRole('button', { name: 'Бета' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('button', { name: 'Бета' })).toBeNull();
  });

  it('falls back to the first option when value is unknown', () => {
    render(<Dropdown value="z" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByText('Альфа')).toBeTruthy();
  });

  it('prepends an "all" entry and emits empty string when chosen', () => {
    const onChange = vi.fn();
    render(<Dropdown value="" options={OPTIONS} onChange={onChange} allLabel="Все" />);
    fireEvent.click(screen.getByRole('button', { name: 'Все' })); // opens the menu
    fireEvent.click(screen.getAllByRole('button', { name: 'Все' })[1]); // selects the "all" entry
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('closes on outside click and invokes onClose', () => {
    const onClose = vi.fn();
    render(
      <div>
        <Dropdown value="a" options={OPTIONS} onChange={() => {}} onClose={onClose} initialOpen />
        <button type="button">outside</button>
      </div>,
    );
    expect(screen.getByRole('button', { name: 'Бета' })).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('button', { name: 'Бета' })).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('supports the inline variant', () => {
    render(<Dropdown value="a" options={OPTIONS} onChange={() => {}} variant="inline" />);
    expect(screen.getByText('Альфа')).toBeTruthy();
  });
});
