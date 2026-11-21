import { createApp } from './app.js';
import { localDevUser } from './auth.js';
import { depsFromEnv } from './config.js';

const port = Number(process.env.PORT ?? 3001);

createApp({ ...depsFromEnv(), resolveUser: localDevUser }).listen(port, () => {
  console.log(`API listening on http://localhost:${port} (signed in as the local dev user)`);
});
