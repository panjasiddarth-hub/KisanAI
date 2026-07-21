// KisanAI backend — entry point
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { connectDB } from './src/config/db.js';
import { seedDemoUser } from './src/repositories/store.js';
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agents.routes.js';
import calendarRoutes from './src/routes/calendar.routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));

// uploaded disease photos (served statically)
fs.mkdirSync('uploads', { recursive: true });
app.use('/uploads', express.static('uploads'));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'kisanai-api', mode: globalThis.__DB_MODE__, time: new Date().toISOString() })
);

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/calendar', calendarRoutes);

// 404 + error handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
await connectDB();          // mongo if MONGODB_URI set, else in-memory
await seedDemoUser();       // siddarth@kisan.com / password123

app.listen(PORT, () => console.log(`✅ KisanAI API listening on http://localhost:${PORT} (${globalThis.__DB_MODE__} mode)`));
