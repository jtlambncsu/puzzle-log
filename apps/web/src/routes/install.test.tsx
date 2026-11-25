import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/test/server';
import { renderApp } from '@/test/renderApp';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('install card', () => {
  it('shows iPhone users the steps, and stays away once dismissed', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    db.add({ title: 'Castle' });
    const user = userEvent.setup();
    renderApp('/');

    const card = await screen.findByRole('region', { name: 'Install Puzzle Log on your phone' });
    expect(card).toHaveTextContent('Add to Home Screen');
    await user.click(screen.getByRole('button', { name: "Don't show again" }));
    expect(card).not.toBeInTheDocument();

    cleanup();
    renderApp('/');
    expect(await screen.findByText('Castle')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Install/ })).not.toBeInTheDocument();
    // The steps can still be found on the More page.
    cleanup();
    renderApp('/more');
    expect(
      await screen.findByRole('region', { name: 'Install Puzzle Log on your phone' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Don't show again" })).not.toBeInTheDocument();
  });

  it("isn't shown in the installed app", async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
    const matchMedia = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...matchMedia(query),
      matches: query === '(display-mode: standalone)',
    }));
    db.add({ title: 'Castle' });
    renderApp('/');
    expect(await screen.findByText('Castle')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Install/ })).not.toBeInTheDocument();
  });

  it("offers the browser's install dialog where there is one", async () => {
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    const user = userEvent.setup();
    renderApp('/more');

    await user.click(await screen.findByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument(),
    );
  });
});
