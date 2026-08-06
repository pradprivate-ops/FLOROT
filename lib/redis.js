// /lib/redis.js — shared Upstash Redis client.
// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from process.env
// (set these in Vercel → Project → Settings → Environment Variables, from
// your Upstash dashboard → your database → REST API section).

import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Keys used across the app — centralized so chat.js and memories.js can't
// drift out of sync with each other.
export const REDIS_KEYS = {
  history: 'florot:history', // rolling conversation log (for continuity + admin viewing)
  facts: 'florot:facts',     // pinned facts/preferences ("remember that...")
};

// How much history to keep in Redis (for the admin log view) vs. how much
// to actually feed back into the Groq prompt each turn (keeps token usage
// sane — FLOROT doesn't need the full history, just recent context).
export const MAX_STORED_HISTORY = 100; // entries (≈50 exchanges)
export const MAX_CONTEXT_HISTORY = 20; // entries (≈10 exchanges) sent to Groq
export const MAX_STORED_FACTS = 50;
