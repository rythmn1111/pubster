import { z } from 'zod';

/**
 * Environment configuration, validated at boot with zod.
 * Mirrors `services/api/.env.example` and docs/BACKEND.md §Environment.
 * On invalid config the process prints the problems and exits (fail fast).
 */

// Best-effort load of a local `.env` for dev. In production PM2 provides the
// environment (and a real `.env` sits next to the process). Node >=20.12 ships
// `process.loadEnvFile`; missing file is fine, so we swallow the error.
try {
  process.loadEnvFile();
} catch {
  // no .env file present — rely on the ambient environment
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL: z.string().min(1).default('30d'),
  DUMMY_OTP_CODE: z.string().min(1).default('000000'),
  CURRENCY: z.string().min(1).default('USD'),
  // Comma-separated list of allowed CORS origins -> string[].
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
