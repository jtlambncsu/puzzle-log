import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

describe('duplicates', () => {
  beforeEach(() => localStorage.clear());

  it('shows look-alikes from the More page, and deletes the extra copy', async () => {
    db.add({ title: 'Lion King', photoFingerprint: '0123456789abcdef', status: 'done' });
    const extra = db.add({ title: 'Imported puzzle', photoFingerprint: '0123456789abcdee' });
    db.add({ title: 'Something else', photoFingerprint: 'fedcba9876543210' });
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('link', { name: /More/ }));
    await user.click(await screen.findByRole('link', { name: /Duplicates/ }));

    const list = await screen.findByRole('list', { name: 'Possible duplicates' });
    expect(within(list).getByText('Same photo')).toBeInTheDocument();
    expect(within(list).queryByText('Something else')).not.toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Delete “Imported puzzle”' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByText('No duplicates found. 🧩')).toBeInTheDocument();
    expect(db.puzzles.has(extra.id)).toBe(false);
  });

  it('remembers puzzles marked as different', async () => {
    db.add({ title: 'Castle' });
    db.add({ title: 'castle' });
    const user = userEvent.setup();
    renderApp('/duplicates');

    expect(await screen.findByText('Same title')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Not duplicates' }));

    await waitFor(() => expect(screen.getByText('No duplicates found. 🧩')).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('puzzle-log:not-duplicates')!)).toHaveLength(1);
  });

  it('offers to check photos without a fingerprint', async () => {
    db.add({ title: 'New', imageKey: 'uploads/u/a', imageUrl: 'https://photos.s3.example/a' });
    renderApp('/duplicates');
    expect(await screen.findByText(/1 photo hasn’t been checked yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check them now' })).toBeEnabled();
  });
});
