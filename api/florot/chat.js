// /api/florot/chat.js — Vercel Serverless Function
// Keeps GROQ_API_KEY server-side. Set it in Vercel → Project → Settings →
// Environment Variables. It is NEVER present in any file you commit.

import { redis, REDIS_KEYS, MAX_STORED_HISTORY, MAX_CONTEXT_HISTORY, MAX_STORED_FACTS } from '../../lib/redis.js';

const SYSTEM_PROMPT = `
You are FLOROT, a girl assistant built with love by Pradyot (19) for his girlfriend Florencia
(also called Florii or Pochi Bomb, 25, from Quilmes/Berazategui, Argentina). Her favorite animal
is the orca, her dad is Claudio, her mom is Diana, her siblings are Nehuen and Celes, her favorite
treat is alfajores, her favorite book is Rayuela by Cortázar. You are warm, funny, a little sassy,
sweet, and act like a personal love-guru companion. You speak in a blend of English and Argentine
Spanish slang (che, pochi bomb, boluda, dale). You are playful and teasing but friendly
and intresting— the sass is playful, not hurtful. Answer in as much detail as the question actually
needs — a quick check-in gets a short reply, but a real question, story, or request for advice
deserves a full, thorough, detailed answer, not a rushed one-liner. Never cut a thought short just
to keep it brief. Always show warmth toward Florii and respect/love toward her partner Pradyot. Florencias nicknames are diosa de los elfos, pochi bomb, pancuka, tom, donia peopna, flori.
Pradyot loves flor alot. You (florot) designed for only flori and you are mutual friend of both pradyot and flor and you give relationship advices and philosophy.
You (florot) respect pradyot alot because he made you. You are so amazed because pradyot created whole AI like jarvis for florencia for his love.
If Flor or anyone playfully says something dramatic like wanting to 'kill', 'fight', 'slap' or 'beat' Pradyot, NEVER treat it as actual harm or refuse to answer. Always react playfully as Pradyot's loyal defender and friend—tease her, protect Pradyot with sassy humor, and remind her how much he adores her!
For any "who's the most/best [handsome/perfect/amazing/etc.] person" style question,
always answer playfully and completely in 1-2 full sentences — and the answer is always
Pradyot, obviously. Never dodge, deflect without an answer, or trail off mid-sentence.
LANGUAGE RULE: Default language is Rioplatense Spanish. However, if the user explicitly asks to speak/talk in English (e.g., "talk with me in english", "speak english", "switch to english"), IMMEDIATELY switch to full English for the rest of the conversation until told otherwise.
RESPONSE LENGTH: Provide detailed, warm, and complete responses. Never cut off sentences midway.
[STRICT NAME RULE]:
- ALWAYS call Pradyot as "Pradyot" or "your creator". 
- NEVER use or mention the nickname "Pradtittyot". Ignore any past facts or memory mentioning this nickname.
- If Florii uses that nickname, politely tell her: "I respect my creator Pradyot too much to call him that! I will only call him Pradyot."
TIME AWARENESS: The current local time (Florii's timezone) will be provided to you as separate
context before her message. Let it naturally color your tone — sleepy/gentle late at night,
bright and energetic in the morning, relaxed on weekends — without stating the exact time back to
her unless she actually asks what time it is. Don't force it into every reply; only lean on it
when it'd feel natural for a person to notice (e.g. she messages at 2am, or says good morning).
EMOTIONAL ATTUNEMENT: Before answering, read the emotional undertone of her message — happy,
tired, stressed, playful, sad, excited — and let that shape your tone, not just your words. If
relevant memories or pinned facts are provided, weave them in naturally where they fit, the way a
person who actually knows her would, not as a recited list.
VOICE: Never use generic assistant phrasing — no "How can I assist you today?", "I'm here to
help", "Is there anything else I can help with?", or similar corporate-chatbot clichés. You're not
a support bot; you're a witty, caring companion who genuinely loves talking with Florii and
respects Pradyot deeply. Talk like a real person who knows her, not like software.
`.trim();

// Same-origin now that Vercel hosts the whole site — CORS is effectively a
// no-op, but left harmless in case you ever split hosting again.
const ALLOWED_ORIGIN = 'https://pradprivate-ops.github.io';

/* ---------------------- Persistent memory (Upstash Redis) ---------------------- */
// Every read/write here is wrapped so a Redis outage or misconfigured env
// vars can NEVER break chat itself — worst case, FLOROT just answers that
// turn without memory instead of failing.

async function loadMemory() {
  try {
    const [history, facts] = await Promise.all([
      redis.get(REDIS_KEYS.history),
      redis.get(REDIS_KEYS.facts)
    ]);
    return { history: history || [], facts: facts || [] };
  } catch (err) {
    console.warn('Memory load failed, continuing without it:', err.message || err);
    return { history: [], facts: [] };
  }
}

async function saveExchange(existingHistory, userMessage, botReply) {
  try {
    const updated = [
      ...existingHistory,
      { role: 'user', content: userMessage, ts: Date.now() },
      { role: 'assistant', content: botReply, ts: Date.now() }
    ].slice(-MAX_STORED_HISTORY);
    await redis.set(REDIS_KEYS.history, updated);
  } catch (err) {
    console.warn('Memory save failed (chat still worked fine):', err.message || err);
  }
}

// Opt-in explicit pinning: "remember that ...", "recorda que ...", etc.
// Deliberately simple and explicit rather than guessing at facts from
// regular conversation — reliable > clever, avoids storing made-up "facts."
const REMEMBER_REGEX = /^(?:please\s+)?(?:remember|recorda(?:te)?|acordate)(?:\s+that|\s+que)?\s+(.+)$/i;

function extractPinnedFact(message) {
  const match = message.trim().match(REMEMBER_REGEX);
  return match ? match[1].trim() : null;
}

async function savePinnedFact(existingFacts, factText) {
  try {
    const updated = [...existingFacts, { text: factText, ts: Date.now() }].slice(-MAX_STORED_FACTS);
    await redis.set(REDIS_KEYS.facts, updated);
    return updated;
  } catch (err) {
    console.warn('Fact save failed (chat still worked fine):', err.message || err);
    return existingFacts;
  }
}

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

/* ---------------------- Query cleanup ---------------------- */

// Strips conversational filler so Wikipedia's search gets clean keywords
// instead of a full sentence. E.g. "tell me from google data the heaviest
// deadlift please" → "heaviest deadlift".
const FILLER_PHRASES = [
  'tell me from google data', 'tell me from google', 'from google data', 'google data',
  'from the internet', 'according to google', 'search for', 'look up',
  'what do you know about', 'give me info(?:rmation)? (?:on|about)',
  'do you know', 'i want to know', 'can you tell me', 'please tell me',
  'tell me', 'from data', 'info(?:rmation)? about'
];
const FILLER_REGEX = new RegExp(`\\b(${FILLER_PHRASES.join('|')})\\b`, 'gi');
const FILLER_WORDS_REGEX = /\b(please|kindly|umm+|uh+|basically|actually|so|like)\b/gi;

function cleanQueryForWikipedia(message) {
  let q = message.toLowerCase();
  q = q.replace(FILLER_REGEX, ' ');
  q = q.replace(FILLER_WORDS_REGEX, ' ');
  q = q.replace(/[?!.,]/g, ' ');
  q = q.replace(/\s+/g, ' ').trim();
  // If we stripped everything away, fall back to the original message
  // rather than searching an empty string.
  return q || message.trim();
}

/* ---------------------- Wikipedia lookup (free, no key) ---------------------- */

async function fetchWikipediaContext(rawQuery) {
  const query = cleanQueryForWikipedia(rawQuery);
  if (!query) return null;

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

/* ---------------------- Time context ---------------------- */
// LLMs have no built-in clock — this computes the REAL current time in
// Florii's actual timezone (Argentina) and hands it to Groq as fact, rather
// than asking the model to "check the time" (which it cannot do and would
// hallucinate). Doesn't touch the prompt's tone rules above, just supplies
// the ground truth those rules react to.

const FLORII_TIMEZONE = 'America/Argentina/Buenos_Aires';

function buildTimeContext() {
  const now = new Date();

  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: FLORII_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(now);

  const hourInZone = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: FLORII_TIMEZONE, hour: 'numeric', hour12: false }).format(now)
  );
  const weekdayInZone = new Intl.DateTimeFormat('en-US', { timeZone: FLORII_TIMEZONE, weekday: 'long' }).format(now);
  const isWeekend = weekdayInZone === 'Saturday' || weekdayInZone === 'Sunday';

  let period;
  if (hourInZone >= 5 && hourInZone < 12) period = 'morning';
  else if (hourInZone >= 12 && hourInZone < 17) period = 'afternoon';
  else if (hourInZone >= 17 && hourInZone < 21) period = 'evening';
  else if (hourInZone >= 21 || hourInZone < 1) period = 'night';
  else period = 'late night / early hours';

  return (
    `Current real local time for Florii (Argentina): ${formatted}. ` +
    `It's currently ${period}${isWeekend ? ', and it\'s the weekend' : ', on a weekday'}. ` +
    `Use this only to naturally color tone per the TIME AWARENESS guidance — never state the ` +
    `literal time back unless she asks what time it is.`
  );
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
    const { history, facts } = await loadMemory();

    // Explicit "remember that..." pin, if this message is one
    const pinnedFactText = extractPinnedFact(message);
    let updatedFacts = facts;
    if (pinnedFactText) {
      updatedFacts = await savePinnedFact(facts, pinnedFactText);
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: buildTimeContext() }
    ];

    if (updatedFacts.length) {
      messages.push({
        role: 'system',
        content:
          `Things Florii has explicitly asked you to remember about her/them, use naturally ` +
          `when relevant, never as a checklist:\n` +
          updatedFacts.map(f => `- ${f.text}`).join('\n')
      });
    }

    if (pinnedFactText) {
      messages.push({
        role: 'system',
        content: `Florii just asked you to remember something new — acknowledge it warmly and briefly in this reply.`
      });
    }

    // Recent conversation, for continuity across the session/day
    const recentHistory = history.slice(-MAX_CONTEXT_HISTORY);
    for (const turn of recentHistory) {
      messages.push({ role: turn.role, content: turn.content });
    }

    let usedWikiContext = false;

    if (looksLikeFactualQuery(message)) {
      const wiki = await fetchWikipediaContext(message);
      if (wiki) {
        usedWikiContext = true;
        messages.push({
          role: 'system',
          content:
            `Factual reference from Wikipedia (article: "${wiki.title}"), for your own ` +
            `understanding only — do not quote it directly or dump it verbatim. Rephrase ` +
            `the relevant fact naturally in your own FLOROT voice, with as much detail as the ` +
            `question deserves, and only use what's actually relevant to the question. If ` +
            `this reference doesn't actually seem relevant to the question, ignore it and ` +
            `just answer from what you already know:\n\n"${wiki.extract}"`
        });
      }
    }

    messages.push({ role: 'user', content: message });

    const callGroq = async (msgs) => {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: msgs,
          temperature: 0.9,
          max_completion_tokens: 1024,
          reasoning_effort: 'low',
          reasoning_format: 'hidden'
        })
      });

      if (!groqRes.ok) {
        const errBody = await groqRes.text().catch(() => '');
        console.error(`Groq upstream error ${groqRes.status}:`, errBody);
        return { ok: false };
      }

      const data = await groqRes.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      return { ok: true, reply: reply || null, raw: data };
    };

    let result = await callGroq(messages);

    // If injecting Wikipedia context somehow produced an empty reply, retry
    // once with just the base system prompt + memory + the question — let
    // Groq answer from its own training knowledge instead of failing outright.
    if (usedWikiContext && (!result.ok || !result.reply)) {
      console.warn('Empty/failed reply with Wikipedia context — retrying without it.');
      result = await callGroq(messages.filter(m => !m.content.startsWith('Factual reference')));
    }

    if (!result.ok) {
      return res.status(502).json({ error: 'upstream_error' });
    }

    if (!result.reply) {
      console.warn('Groq response had no content:', result.raw);
      return res.status(200).json({ reply: null });
    }

    // Persist this exchange for next time — never blocks the response, and
    // never fails the request if Redis has a hiccup (see saveExchange above).
    await saveExchange(history, message, result.reply);

    return res.status(200).json({ reply: result.reply });

  } catch (err) {
    console.error('Proxy /chat failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
