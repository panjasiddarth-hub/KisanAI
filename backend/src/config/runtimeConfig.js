const DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function parseCorsOrigins(env = process.env) {
  const configured = (env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  const origins = configured.length ? configured : env.NODE_ENV === 'production' ? [] : DEVELOPMENT_ORIGINS;
  if (!origins.length) throw new Error('CORS_ORIGINS must list the frontend origin(s) in production.');

  for (const origin of origins) {
    if (origin === '*') throw new Error('CORS origin must be an exact HTTP(S) origin without a path: *');
    let parsed;
    try { parsed = new URL(origin); }
    catch { throw new Error(`Invalid CORS origin: ${origin}`); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(`CORS origin must be an exact HTTP(S) origin without a path: ${origin}`);
    }
  }
  return [...new Set(origins)];
}

export function createCorsOptions(env = process.env) {
  const allowedOrigins = new Set(parseCorsOrigins(env));
  return {
    origin(origin, callback) {
      // Requests without an Origin header include health checks and native clients.
      callback(null, !origin || allowedOrigins.has(origin));
    },
  };
}

export function parseTrustProxyHops(value = process.env.TRUST_PROXY_HOPS) {
  if (value === undefined || value === '') return 0;
  if (!/^\d+$/.test(String(value))) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10.');
  const hops = Number(value);
  if (!Number.isSafeInteger(hops) || hops < 0 || hops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10.');
  }
  return hops;
}

export function validateProductionEnvironment(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  if (!env.MONGODB_URI?.trim()) throw new Error('MONGODB_URI is required in production.');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production.');
  }
  parseCorsOrigins(env);
  parseTrustProxyHops(env.TRUST_PROXY_HOPS);
}

export function getJwtSecret(env = process.env) {
  if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production.');
  }
  return env.JWT_SECRET || 'dev-secret-change-me';
}

export function shouldSeedDemoUser(env = process.env) {
  return env.NODE_ENV !== 'production';
}

export async function assertNoDefaultDemoCredentials(users, env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const demoUser = await users.findByEmail('siddarth@kisan.com');
  if (demoUser && await users.verifyPassword(demoUser, 'password123')) {
    throw new Error('The default demo account still uses its public password. Remove or rotate it before production startup.');
  }
}
