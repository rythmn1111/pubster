/**
 * Runtime configuration for the dashboard.
 *
 * `NEXT_PUBLIC_API_BASE_URL` is inlined at build time by Next (it must be
 * prefixed `NEXT_PUBLIC_` to be exposed to the browser). Defaults to the local
 * backend (see docs/BACKEND.md — REST JSON API under `/api/v1`).
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
