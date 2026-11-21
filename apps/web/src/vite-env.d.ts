/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API, without a trailing slash or /api. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
