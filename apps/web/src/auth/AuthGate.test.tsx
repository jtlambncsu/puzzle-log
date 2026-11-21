import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useAuth, type AuthContextProps } from 'react-oidc-context';
import { AuthGate } from './AuthGate';

vi.mock('react-oidc-context', () => ({ useAuth: vi.fn() }));
vi.mock('./config', () => ({ cognitoLogoutUrl: () => 'https://login.example/logout' }));

function mockAuth(state: Partial<AuthContextProps>) {
  const auth = {
    isLoading: false,
    isAuthenticated: false,
    signinRedirect: vi.fn(),
    removeUser: vi.fn(),
    ...state,
  } as AuthContextProps;
  vi.mocked(useAuth).mockReturnValue(auth);
  return auth;
}

describe('AuthGate', () => {
  it('asks signed-out users to sign in', async () => {
    const auth = mockAuth({});
    render(<AuthGate>secret stuff</AuthGate>);

    expect(screen.queryByText('secret stuff')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signinRedirect).toHaveBeenCalled();
  });

  it('shows the app and the user to signed-in users', () => {
    mockAuth({
      isAuthenticated: true,
      user: { profile: { email: 'me@example.com' } } as AuthContextProps['user'],
    });
    render(<AuthGate>secret stuff</AuthGate>);

    expect(screen.getByText('secret stuff')).toBeInTheDocument();
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('shows sign-in errors', () => {
    mockAuth({ error: new Error('access_denied') as AuthContextProps['error'] });
    render(<AuthGate>secret stuff</AuthGate>);
    expect(screen.getByRole('alert')).toHaveTextContent('access_denied');
  });
});
