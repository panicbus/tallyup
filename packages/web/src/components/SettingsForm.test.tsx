import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from './SettingsForm';

const business = {
  name: 'Demo Bookstore',
  slug: 'demo-bookstore',
  rewardThreshold: 10,
  rewardDescription: 'A free used book',
};

describe('SettingsForm', () => {
  it('pre-fills fields from the current business', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} saved={false} />);

    expect(screen.getByLabelText(/business name/i)).toHaveValue('Demo Bookstore');
    expect(screen.getByLabelText(/punches needed/i)).toHaveValue(10);
    expect(screen.getByLabelText(/reward, in your words/i)).toHaveValue('A free used book');
  });

  it('shows the check-in URL locked, not editable', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} saved={false} />);

    const urlField = screen.getByLabelText(/check-in url/i);
    expect(urlField).toHaveValue('demo-bookstore');
    expect(urlField).toBeDisabled();
  });

  it('warns that lowering the threshold makes customers instantly eligible', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} saved={false} />);

    expect(screen.getByText(/instantly eligible/i)).toBeTruthy();
  });

  it('submits the edited values', async () => {
    const onSubmit = vi.fn();
    render(<SettingsForm business={business} onSubmit={onSubmit} submitting={false} saved={false} />);

    const thresholdField = screen.getByLabelText(/punches needed/i);
    await userEvent.clear(thresholdField);
    await userEvent.type(thresholdField, '5');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Demo Bookstore',
      rewardThreshold: 5,
      rewardDescription: 'A free used book',
    });
  });

  it('disables the button while submitting', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={true} saved={false} />);

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('shows an error message when given one', () => {
    render(
      <SettingsForm business={business} onSubmit={() => {}} submitting={false} saved={false} error="Something went wrong." />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('shows a saved confirmation after a successful save', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} saved={true} />);

    expect(screen.getByText(/saved/i)).toBeTruthy();
  });

  it('does not show a saved confirmation before saving', () => {
    render(<SettingsForm business={business} onSubmit={() => {}} submitting={false} saved={false} />);

    expect(screen.queryByText(/saved/i)).toBeNull();
  });
});
