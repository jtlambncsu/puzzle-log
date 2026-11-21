/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API, without a trailing slash or /api. */
  readonly VITE_API_URL?: string;
  /** `https://cognito-idp.<region>.amazonaws.com/<userPoolId>` (CDK output CognitoAuthority). */
  readonly VITE_COGNITO_AUTHORITY?: string;
  /** Cognito app client ID (CDK output CognitoClientId). */
  readonly VITE_COGNITO_CLIENT_ID?: string;
  /** Managed login base URL, e.g. `https://puzzle-log-abc.auth.us-east-1.amazoncognito.com`. */
  readonly VITE_COGNITO_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
