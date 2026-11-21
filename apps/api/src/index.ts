import { createApp } from './app.js';
import { depsFromEnv } from './config.js';

const port = Number(process.env.PORT ?? 3001);

createApp(depsFromEnv()).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
