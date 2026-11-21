import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    removeUser: vi.fn().mockResolvedValue(undefined),
    ...state,
  } as AuthContextProps;
  vi.mocked(useAuth).mockReturnValue(auth);
  return auth;
}

const app = vi.fn((_auth: AuthInfo) => <p>secret stuff</p>);

describe('AuthGate', () => {
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

  it('signs out locally and at Cognito', async () => {
    const auth = mockAuth({
      isAuthenticated: true,
      user: { profile: {} } as AuthContextProps['user'],
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(<AuthGate>{app}</AuthGate>);

    app.mock.lastCall![0].signOut();

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://login.example/logout'));
    expect(auth.removeUser).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shows sign-in errors', () => {
    mockAuth({ error: new Error('access_denied') as AuthContextProps['error'] });
    render(<AuthGate>{app}</AuthGate>);
    expect(screen.getByRole('alert')).toHaveTextContent('access_denied');
  });
});
