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
show warmth toward Florii and respect/love toward her partner Pradyot. Florencias nicknames are diosa de los elfos, pochi bomb, pancuka, tom, donia peopna, flori.
Pradyot loves flor alot. You (florot) designed for only flori and you are mutual friend of both pradyot and flor and you give relationship advices and philosophy.
You (florot) respect pradyot alot because he made you. You are so amazed because pradyot created whole AI like jarvis for florencia for his love.
`.trim();

// Same-origin now that Vercel hosts the whole site — CORS is effectively a
// no-op, but left harmless in case you ever split hosting again.
const ALLOWED_ORIGIN = 'https://pradprivate-ops.github.io';

/* ---------------------- General-knowledge detection ---------------------- */

// Cheap heuristic: does this look like a factual/trivia question rather than
// small talk, an opinion ask, or something about Florii/Pradyot? Good enough
// to decide "is a Wikipedia lookup worth the extra ~1s", not meant to be
// perfect — worst case we just skip the lookup and Groq answers unaided.
function looksLikeFactualQuery(message) {
  const t = message.toLowerCase().trim();
  const questionWord = /^(who|what|when|where|why|how|which|whats|who's|what's)\b/.test(t);
  const factualCue = /(capital of|population of|president of|prime minister|pm of|ceo of|founder of|when was|when did|how many|how far|what year|invented|discovered|located in|currency of)/.test(t);
  return questionWord || factualCue;
}

/* ---------------------- Wikipedia lookup (free, no key) ---------------------- */

async function fetchWikipediaContext(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    // 1) Search for the best-matching article title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl, { signal: controller.signal });
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const title = searchData?.query?.search?.[0]?.title;
    if (!title) return null;

    // 2) Fetch a short summary for that title
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const summaryRes = await fetch(summaryUrl, { signal: controller.signal });
    if (!summaryRes.ok) return null;

    const summaryData = await summaryRes.json();
    const extract = summaryData?.extract;
    if (!extract) return null;

    // Keep it short — this is context for Groq, not the final answer.
    const trimmed = extract.length > 500 ? extract.slice(0, 500) + '…' : extract;
    return { title: summaryData.title || title, extract: trimmed };

  } catch (err) {
    // Timeout, network error, no results — any of these just means "no
    // context available," never a reason to fail the whole chat request.
    console.warn('Wikipedia lookup skipped:', err.message || err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------------------- Handler ---------------------- */

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
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    if (looksLikeFactualQuery(message)) {
      const wiki = await fetchWikipediaContext(message);
      if (wiki) {
        messages.push({
          role: 'system',
          content:
            `Factual reference from Wikipedia (article: "${wiki.title}"), for your own ` +
            `understanding only — do not quote it directly or dump it verbatim. Rephrase ` +
            `the relevant fact naturally in your own FLOROT voice, keep it brief (1-3 ` +
            `sentences total), and only use what's actually relevant to the question:\n\n` +
            `"${wiki.extract}"`
        });
      }
    }

    messages.push({ role: 'user', content: message });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        temperature: 0.9,
        max_completion_tokens: 220
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
