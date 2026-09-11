import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneField } from './PhoneField';

function ControlledPhoneField() {
  const [value, setValue] = useState('');
  return <PhoneField value={value} onChange={setValue} />;
}

describe('PhoneField', () => {
  it('masks the number as (xxx) xxx-xxxx while it is typed', async () => {
    render(<ControlledPhoneField />);

    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    await userEvent.type(input, '5551234567');

    expect(input.value).toBe('(555) 123-4567');
  });

  it('calls onChange with the formatted value', async () => {
    const onChange = vi.fn();
    render(<PhoneField value="" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(/phone/i), '5');

    expect(onChange).toHaveBeenCalledWith('(5');
  });

  it('shows an error message when given one', () => {
    render(<PhoneField value="" onChange={() => {}} error="That doesn't look right." />);

    expect(screen.getByRole('alert')).toHaveTextContent("That doesn't look right.");
  });

  it('shows no error by default', () => {
    render(<PhoneField value="" onChange={() => {}} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('uses a custom label when given one', () => {
    render(<PhoneField value="" onChange={() => {}} label="Your number" />);

    expect(screen.getByLabelText('Your number')).toBeTruthy();
  });
});
