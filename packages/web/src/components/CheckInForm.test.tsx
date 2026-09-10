import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckInForm } from './CheckInForm';

describe('CheckInForm', () => {
  it('submits a normalizable phone number', async () => {
    const onSubmit = vi.fn();
    render(<CheckInForm onSubmit={onSubmit} submitting={false} businessName="Test Shop" />);

    await userEvent.type(screen.getByLabelText(/phone/i), '555-123-4567');
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(onSubmit).toHaveBeenCalledWith('(555) 123-4567', false);
  });

  it('passes true for sms consent only when the box is checked', async () => {
    const onSubmit = vi.fn();
    render(<CheckInForm onSubmit={onSubmit} submitting={false} businessName="Test Shop" />);

    await userEvent.type(screen.getByLabelText(/phone/i), '555-123-4567');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(onSubmit).toHaveBeenCalledWith('(555) 123-4567', true);
  });

  it('masks the number as (xxx) xxx-xxxx while it is typed', async () => {
    render(<CheckInForm onSubmit={() => {}} submitting={false} businessName="Test Shop" />);

    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    await userEvent.type(input, '5551234567');

    expect(input.value).toBe('(555) 123-4567');
  });

  it('hides the SMS consent checkbox once the typed number is known to have consent on file', async () => {
    render(
      <CheckInForm
        onSubmit={() => {}}
        submitting={false}
        businessName="Test Shop"
        isPhoneKnownConsented={(phone) => phone.replace(/\D/g, '') === '5551234567'}
      />,
    );

    // Shown for a fresh number...
    await userEvent.type(screen.getByLabelText(/phone/i), '5550000000');
    expect(screen.queryByRole('checkbox')).not.toBeNull();

    // ...gone once they finish typing the known one.
    await userEvent.clear(screen.getByLabelText(/phone/i));
    await userEvent.type(screen.getByLabelText(/phone/i), '5551234567');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it("names the business in the consent checkbox label, not TallyUp", () => {
    render(<CheckInForm onSubmit={() => {}} submitting={false} businessName="Nico's Bookstore" />);

    expect(screen.getByText(/Nico's Bookstore/)).toBeTruthy();
  });

  it('shows a validation error instead of submitting for an invalid number', async () => {
    const onSubmit = vi.fn();
    render(<CheckInForm onSubmit={onSubmit} submitting={false} businessName="Test Shop" />);

    await userEvent.type(screen.getByLabelText(/phone/i), '123');
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('disables the button while submitting', () => {
    render(<CheckInForm onSubmit={() => {}} submitting={true} businessName="Test Shop" />);

    // The label switches to "Checking in…" while submitting.
    expect(screen.getByRole('button', { name: /check(ing)? in/i })).toBeDisabled();
  });
});
