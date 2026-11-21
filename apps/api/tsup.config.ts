import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  // Bundle the shared workspace package (it ships TypeScript source, not JS).
  noExternal: ['@puzzle-log/shared'],
});
