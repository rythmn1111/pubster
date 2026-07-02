import { buildApp } from './app.js';
import { env } from './config/env.js';

/** Boot the API: build the app and listen. Entry point for PM2 (dist/server.js). */
async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info(`Received ${signal}, shutting down`);
      void app.close().then(() => process.exit(0));
    });
  }
}

void main();
