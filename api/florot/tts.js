// /api/florot/tts.js — Vercel Serverless Function
// Keeps ELEVENLABS_API_KEY server-side. Set it in Vercel → Project →
// Settings → Environment Variables. It is NEVER present in any file you commit.

const VOICE_ID = 'iFhPOZcajR7W3sDL39qJ'; // Blackie

// Change this to your GitHub Pages origin (no trailing slash).
const ALLOWED_ORIGIN = 'https://pradprivate-ops.github.io';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { text, model_id, voice_settings } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'missing_text' });
  }

  try {
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: model_id || 'eleven_multilingual_v2',
        voice_settings: voice_settings || {
          stability: 0.35,
          similarity_boost: 0.85,
          style: 0.45,
          use_speaker_boost: true
        }
      })
    });

    if (!elevenRes.ok) {
      const errBody = await elevenRes.text().catch(() => '');
      console.error(`ElevenLabs upstream error ${elevenRes.status}:`, errBody);
      return res.status(502).json({ error: 'upstream_error' });
    }

    const arrayBuffer = await elevenRes.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(Buffer.from(arrayBuffer));

  } catch (err) {
    console.error('Proxy /tts failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
