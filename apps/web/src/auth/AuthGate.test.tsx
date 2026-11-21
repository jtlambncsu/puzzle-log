import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth, type AuthContextProps } from 'react-oidc-context';
import type { AuthInfo } from '@/router';
import { AuthGate } from './AuthGate';

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn() }));
vi.mock('./config', () => ({ cognitoLogoutUrl: () => 'https://login.example/logout' }));

function mockAuth(state: Partial<AuthContextProps>) {
  const auth = {
    isLoading: false,
    isAuthenticated: false,
    signinRedirect: vi.fn(),
    signinSilent: vi.fn().mockResolvedValue(undefined),
    removeUser: vi.fn().mockResolvedValue(undefined),
    ...state,
  } as AuthContextProps;
  vi.mocked(useAuth).mockReturnValue(auth);
  return auth;
}

const app = vi.fn((_auth: AuthInfo) => <p>secret stuff</p>);

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

const expiredUser = {
  expired: true,
  profile: { email: 'me@example.com' },
} as AuthContextProps['user'];

describe('AuthGate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks signed-out users to sign in', async () => {
    const auth = mockAuth({});
    render(<AuthGate>{app}</AuthGate>);

    expect(screen.queryByText('secret stuff')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signinRedirect).toHaveBeenCalled();
  });

  it('renders the app with the signed-in user', () => {
    mockAuth({
      isAuthenticated: true,
      user: { profile: { email: 'me@example.com' } } as AuthContextProps['user'],
    });
    render(<AuthGate>{app}</AuthGate>);

    expect(screen.getByText('secret stuff')).toBeInTheDocument();
    expect(app).toHaveBeenLastCalledWith(expect.objectContaining({ email: 'me@example.com' }));
  });

  it('deletes saved data, then signs out locally and at Cognito', async () => {
    const auth = mockAuth({
      isAuthenticated: true,
      user: { profile: {} } as AuthContextProps['user'],
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const order: string[] = [];
    const onSignOut = vi.fn(async () => {
      order.push('forget data');
    });
    vi.mocked(auth.removeUser).mockImplementation(async () => {
      order.push('remove tokens');
    });
    render(<AuthGate onSignOut={onSignOut}>{app}</AuthGate>);

    app.mock.lastCall![0].signOut();

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://login.example/logout'));
    expect(order).toEqual(['forget data', 'remove tokens']);
    vi.unstubAllGlobals();
  });

  it('refreshes an expired session silently instead of asking to sign in', async () => {
    setOnline(true);
    const auth = mockAuth({ user: expiredUser });
    render(<AuthGate>{app}</AuthGate>);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(auth.signinSilent).toHaveBeenCalledTimes(1);
  });

  it('asks to sign in if the silent refresh fails', async () => {
    setOnline(true);
    const auth = mockAuth({ user: expiredUser });
    vi.mocked(auth.signinSilent).mockRejectedValue(new Error('refresh token expired'));
    render(<AuthGate>{app}</AuthGate>);

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows saved puzzles offline even with an expired session', () => {
    setOnline(false);
    const auth = mockAuth({ user: expiredUser });
    render(<AuthGate>{app}</AuthGate>);

    expect(screen.getByText('secret stuff')).toBeInTheDocument();
    expect(auth.signinSilent).not.toHaveBeenCalled();
  });

  it('shows sign-in errors', () => {
    mockAuth({ error: new Error('access_denied') as AuthContextProps['error'] });
    render(<AuthGate>{app}</AuthGate>);
    expect(screen.getByRole('alert')).toHaveTextContent('access_denied');
  });
});
