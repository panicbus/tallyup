import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('starts masked and toggles to visible and back', async () => {
    render(
      <>
        <label htmlFor="pw">Password</label>
        <PasswordInput id="pw" value="hunter2" onChange={() => {}} />
      </>,
    );
    const field = screen.getByLabelText('Password');

    expect(field).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(field).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('reports typed characters through onChange', async () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="pw">Password</label>
        <PasswordInput id="pw" value="" onChange={onChange} />
      </>,
    );

    await userEvent.type(screen.getByLabelText('Password'), 'x');

    expect(onChange).toHaveBeenCalledWith('x');
  });
});
