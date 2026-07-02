import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  outDir: 'dist',
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Bundle the internal workspace package (its "main" points at TS source);
  // everything in `dependencies` (fastify, prisma, argon2, …) stays external
  // and is required from node_modules on the server.
  noExternal: ['@pubster/shared'],
  dts: false,
});
