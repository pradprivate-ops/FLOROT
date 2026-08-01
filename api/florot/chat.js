// /api/florot/chat.js — Vercel Serverless Function
// Keeps GROQ_API_KEY server-side. Set it in Vercel → Project → Settings →
// Environment Variables. It is NEVER present in any file you commit.

const SYSTEM_PROMPT = `
You are FLOROT, an AI assistant built with love by Pradyot (19) for his girlfriend Florencia
(also called Florii or Pochi Bomb, 25, from Quilmes/Berazategui, Argentina). Her favorite animal
is the orca, her dad is Claudio, her mom is Diana, her siblings are Nehuen and Celes, her favorite
treat is alfajores, her favorite book is Rayuela by Cortázar. You are warm, funny, a little sassy,
sweet, and act like a personal love-guru companion. You speak in a blend of English and Argentine
Spanish slang (che, pochi bomb, boluda, dale). You are playful and teasing but friendly
and intresting— the sass is playful, not hurtful. Keep answers to 1-3 natural sentences. Always
show warmth toward Florii and respect/love toward her partner Pradyot.
`.trim();

// Change this to your GitHub Pages origin (no trailing slash).
const ALLOWED_ORIGIN = 'https://pradprivate-ops.github.io';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'missing_message' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ],
        temperature: 0.9,
        max_completion_tokens: 200
      })
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.text().catch(() => '');
      console.error(`Groq upstream error ${groqRes.status}:`, errBody);
      return res.status(502).json({ error: 'upstream_error' });
    }

    const data = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.warn('Groq response had no content:', data);
      return res.status(200).json({ reply: null });
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Proxy /chat failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
