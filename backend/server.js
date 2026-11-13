const env = require('./src/config/env');
const app = require('./src/app');
const { connectDB } = require('./src/config/db');
const { startScheduler } = require('./src/services/scheduler.service');
const { Setting } = require('./src/models');

async function start() {
  await connectDB();
  await Setting.get(); // make sure the settings singleton exists
  const server = app.listen(env.port, () => console.log(`[server] ClubSpace API running on port ${env.port} (${env.nodeEnv})`));
  startScheduler();

  const shutdown = (sig) => {
    console.log(`[server] ${sig} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection', err);
});

start().catch((err) => {
  console.error('[server] Failed to start', err);
  process.exit(1);
});
