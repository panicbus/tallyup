import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaffPicker } from './StaffPicker';

const staff = [
  { id: 'staff-1', email: 'anna@example.com', role: 'owner' },
  { id: 'staff-2', email: 'ben@example.com', role: 'owner' },
];

describe('StaffPicker', () => {
  it('lists each staff member by email', () => {
    render(<StaffPicker staff={staff} selectedId="staff-1" onChange={() => {}} />);

    expect(screen.getByRole('option', { name: 'anna@example.com' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'ben@example.com' })).toBeTruthy();
  });

  it('calls onChange with the selected staff id', async () => {
    const onChange = vi.fn();
    render(<StaffPicker staff={staff} selectedId="staff-1" onChange={onChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'staff-2');

    expect(onChange).toHaveBeenCalledWith('staff-2');
  });
});
