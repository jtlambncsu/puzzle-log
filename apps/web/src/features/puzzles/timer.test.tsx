import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe('puzzle timer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps counting a timer started earlier, and pauses it into a session', async () => {
    const puzzle = db.add({
      title: 'Big Ben',
      status: 'in_progress',
      pieceCount: 1000,
      startedAt: '2026-11-20',
      sessions: [{ start: minutesAgo(24 * 60), end: minutesAgo(23 * 60) }],
      timerStartedAt: minutesAgo(30),
    });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}`);

    // One hour of sessions plus 30 minutes running.
    expect(await screen.findByRole('timer', { name: 'Total time' })).toHaveTextContent(
      /^1:30:0\d$/,
    );
    expect(screen.getByText(/^This session 30:0\d$/)).toBeInTheDocument();
    expect(screen.getByText(/^Started Nov 20, 2026$/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(db.puzzles.get(puzzle.id)?.sessions).toHaveLength(2);
    expect(screen.getByText('About 667 pieces an hour')).toBeInTheDocument();
  });

  it('deletes a session, with undo', async () => {
    const sessions = [
      { start: '2026-11-20T18:00:00.000Z', end: '2026-11-20T19:00:00.000Z' },
      { start: '2026-11-21T01:00:00.000Z', end: '2026-11-21T09:00:00.000Z' },
    ];
    const puzzle = db.add({ title: 'Big Ben', status: 'in_progress', sessions });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}`);

    await user.click(await screen.findByRole('button', { name: '2 sessions' }));
    const list = screen.getByRole('list', { name: 'Sessions' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('8h 00m'); // newest first
    await user.click(within(list).getAllByRole('button', { name: /delete session/i })[0]!);

    await waitFor(() => expect(db.puzzles.get(puzzle.id)?.sessions).toEqual([sessions[0]]));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(db.puzzles.get(puzzle.id)?.sessions).toEqual(sessions));
  });

  it('adds time that was not timed', async () => {
    const puzzle = db.add({
      title: 'Big Ben',
      status: 'done',
      sessions: [{ start: minutesAgo(60), end: minutesAgo(30) }],
    });
    const user = userEvent.setup();
    renderApp(`/puzzles/${puzzle.id}`);

    // Done puzzles show their total, without timer buttons.
    expect(await screen.findByRole('timer', { name: 'Total time' })).toHaveTextContent('30m');
    expect(screen.queryByRole('button', { name: /start timer|resume/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1 session' }));
    await user.click(screen.getByRole('button', { name: 'Add time' }));
    await user.click(screen.getByRole('button', { name: 'Save time' }));
    expect(await screen.findByText('Enter some time')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Hours'), '2');
    await user.type(screen.getByLabelText('Minutes'), '15');
    await user.click(screen.getByRole('button', { name: 'Save time' }));

    expect(await screen.findByRole('timer', { name: 'Total time' })).toHaveTextContent('2h 45m');
    const added = db.puzzles.get(puzzle.id)?.sessions?.[1];
    expect(Date.parse(added!.end) - Date.parse(added!.start)).toBe(135 * 60_000);
  });

  it("can't start the timer offline", async () => {
    const puzzle = db.add({ title: 'Big Ben', status: 'in_progress' });
    renderApp(`/puzzles/${puzzle.id}`);
    const start = await screen.findByRole('button', { name: 'Start timer' });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
      onlineManager.setOnline(false);
    });

    expect(start).toBeDisabled();
    expect(screen.getByText('The timer needs a connection.')).toBeInTheDocument();
    onlineManager.setOnline(true);
  });

  it('marks in-progress puzzles on the list, and shows a running timer', async () => {
    db.add({ title: 'Big Ben', status: 'in_progress', timerStartedAt: minutesAgo(5) });
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByText(', timer running')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'In progress, 1 puzzle' }));
    expect(screen.getByText('Big Ben')).toBeInTheDocument();
  });
});
