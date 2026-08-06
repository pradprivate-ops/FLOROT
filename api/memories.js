// /api/florot/memories.js — Vercel Serverless Function
// Admin-only view/reset of FLOROT's persistent memory.
//
// ⚠️ REQUIRES ADMIN_SECRET to be set in Vercel → Settings → Environment
// Variables — pick any long random string yourself (e.g. generate one at
// https://1password.com/password-generator or run `openssl rand -hex 32`
// locally). This is NOT a Redis/Upstash value — you make it up.
//
// Without a valid `x-admin-key` header matching that secret, every request
// here is rejected. This is what stops the URL alone from exposing or
// wiping Florii's entire chat history to anyone who finds it.
//
// Usage:
//   GET    /api/florot/memories   → { history, facts }
//   DELETE /api/florot/memories   → clears both, returns { reset: true }
// Both require header: x-admin-key: <your ADMIN_SECRET>

import { redis, REDIS_KEYS } from '../../lib/redis.js';

export default async function handler(req, res) {
  // Same-origin site (Vercel hosts both frontend and API) — CORS is a
  // formality here, not the actual security boundary. The admin-key check
  // below is what matters.
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const providedKey = req.headers['x-admin-key'];
  const realSecret = process.env.ADMIN_SECRET;

  if (!realSecret) {
    // Fail closed: if you forgot to set ADMIN_SECRET, this route refuses to
    // run at all rather than silently having no protection.
    console.error('ADMIN_SECRET is not set — refusing all /memories requests.');
    return res.status(503).json({ error: 'admin_not_configured' });
  }

  if (!providedKey || providedKey !== realSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const history = (await redis.get(REDIS_KEYS.history)) || [];
      const facts = (await redis.get(REDIS_KEYS.facts)) || [];
      return res.status(200).json({
        history,
        facts,
        counts: { history: history.length, facts: facts.length }
      });
    }

    if (req.method === 'DELETE') {
      await redis.del(REDIS_KEYS.history);
      await redis.del(REDIS_KEYS.facts);
      return res.status(200).json({ reset: true });
    }

    return res.status(405).json({ error: 'method_not_allowed' });

  } catch (err) {
    console.error('Memories route failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
