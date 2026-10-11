import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const { configuration } = await import('./config');
const { createApp } = await import('./app');
const config = configuration();
const { app, db } = createApp(config);
const server = app.listen(config.port, '0.0.0.0', () => console.log(`Luna API listening on http://localhost:${config.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
