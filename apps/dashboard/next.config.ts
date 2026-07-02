import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/**
 * Next.js config for the Pubster general dashboard.
 *
 * - `@pubster/shared` is a workspace package that ships raw TypeScript source
 *   (its `main`/`exports` point at `src/index.ts`), so Next must transpile it.
 * - `turbopack.root` pins the workspace root to the monorepo root so Next does
 *   not mis-infer it from a parent checkout's lockfile.
 *
 * Linting is intentionally not wired here: the monorepo owns a single flat
 * ESLint config at the repo root (`eslint.config.mjs`), run via the `lint`
 * script. (Next 16 dropped the built-in `eslint` build integration.)
 */
const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, '..', '..');

const nextConfig: NextConfig = {
  transpilePackages: ['@pubster/shared'],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
