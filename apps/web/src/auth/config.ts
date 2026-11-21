import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const authority = import.meta.env.VITE_COGNITO_AUTHORITY;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const domain = import.meta.env.VITE_COGNITO_DOMAIN;

/**
 * Login is on when the Cognito settings are present (Vercel, or a local `.env.local`).
 * Without them the app runs against the local API, which uses a fixed dev user.
 */
export const authEnabled = Boolean(authority && clientId && domain);

/**
 * Talks to Cognito using OpenID Connect: the authorization code flow with PKCE, so no
 * client secret is needed. Tokens are refreshed in the background with the refresh token.
 */
export const userManager = authEnabled
  ? new UserManager({
      authority: authority!,
      client_id: clientId!,
      redirect_uri: window.location.origin,
      post_logout_redirect_uri: window.location.origin,
      response_type: 'code',
      scope: 'openid email profile',
      automaticSilentRenew: true,
      // Keep the session across tabs and browser restarts. The tradeoff: any script
      // running on the page (e.g. via an XSS bug) could read the tokens.
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    })
  : null;

/** Gets a valid access token, refreshing it first if it has expired. */
export async function getAccessToken() {
  if (!userManager) return undefined;
  let user = await userManager.getUser();
  if (user?.expired) user = await userManager.signinSilent().catch(() => null);
  return user?.access_token;
}

/** Cognito's logout endpoint isn't in its OIDC discovery document, so build it by hand. */
export function cognitoLogoutUrl() {
  const params = new URLSearchParams({ client_id: clientId!, logout_uri: window.location.origin });
  return `${domain}/logout?${params}`;
}

/** After login, Cognito redirects back with `?code=...`; remove it from the address bar. */
export function onSigninCallback() {
  window.history.replaceState({}, document.title, window.location.pathname);
}
