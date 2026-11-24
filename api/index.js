// Root Vercel Serverless Function entry point
import app, { initPromise } from '../backend/server.js';

export default async function handler(req, res) {
  if (initPromise) {
    await initPromise;
  }
  return app(req, res);
}
