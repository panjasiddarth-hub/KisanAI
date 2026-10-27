// KisanAI backend — entry point
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import mongoose from 'mongoose';
import {
  assertNoDefaultDemoCredentials,
  createCorsOptions,
  parseTrustProxyHops,
  shouldSeedDemoUser,
  validateProductionEnvironment,
} from './src/config/runtimeConfig.js';
import { connectDB } from './src/database/config/db.js';
import { ensureRateLimitIndexes } from './src/database/models/RateLimitBucket.js';
import { seedDemoUser, users } from './src/database/repositories/store.js';
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agents.routes.js';
import calendarRoutes from './src/routes/calendar.routes.js';
import farmsRoutes from './src/routes/farms.routes.js';
import cropsRoutes from './src/routes/crops.routes.js';
import weatherRoutes from './src/routes/weather.routes.js';
import marketRoutes from './src/routes/market.routes.js';
import orchestratorRouter from './src/routes/orchestrator.routes.js';

const app = express();
validateProductionEnvironment();
app.set('trust proxy', parseTrustProxyHops());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '12mb' }));

// uploaded disease photos (served statically)
fs.mkdirSync('uploads', { recursive: true });
app.use('/uploads', express.static('uploads'));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'kisanai-api', mode: globalThis.__DB_MODE__, time: new Date().toISOString() })
);
app.get('/api/health/live', (_req, res) =>
  res.json({ ok: true, service: 'kisanai-api', status: 'live', time: new Date().toISOString() })
);
app.get('/api/health/ready', (_req, res) => {
  const databaseReady = globalThis.__DB_MODE__ !== 'mongodb' || mongoose.connection.readyState === 1;
  const ready = databaseReady && globalThis.__DB_MODE__ !== 'unavailable';
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: 'kisanai-api',
    status: ready ? 'ready' : 'not_ready',
    mode: globalThis.__DB_MODE__,
    checks: { database: databaseReady ? 'ready' : 'unavailable' },
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/farms', farmsRoutes);
app.use('/api/crops', cropsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/orchestrator', orchestratorRouter);

// 404 + error handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  const uploadLimitError = typeof err.code === 'string' && err.code.startsWith('LIMIT_');
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : uploadLimitError ? 400 : 500);
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? 'Uploaded file must be 5 MB or smaller.'
    : err.status ? err.message : uploadLimitError ? 'Invalid upload request.' : 'Server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 5000;
await connectDB();          // mongo if MONGODB_URI set, else in-memory
if (globalThis.__DB_MODE__ === 'mongodb') await ensureRateLimitIndexes();
if (shouldSeedDemoUser()) await seedDemoUser(); // local demo account only
else await assertNoDefaultDemoCredentials(users);

app.listen(PORT, () => console.log(`✅ KisanAI API listening on http://localhost:${PORT} (${globalThis.__DB_MODE__} mode)`));
