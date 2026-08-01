/* ===========================================================
   FLOROT — script.js (v2)
   Emotional female voice (ElevenLabs, with browser-voice fallback)
   + Gemini-powered fallback replies for anything outside the
   hardcoded knowledge base.

   ⚠️ KEY HANDLING — READ THIS:
   The two constants below are PLACEHOLDERS. Do not paste real
   keys into a client-side file that lands in a public repo —
   base64 hides them from a casual glance and from naive regex
   scanners, but anyone who opens devtools sees them in plain
   text in one line (`atob(ELEVENLABS_API_KEY_B64)`). That is
   not security, it's just a speed bump.

   Safer path (recommended): set USE_PROXY = true below and
   point PROXY_ENDPOINT at a tiny serverless function you control
   (Vercel/Netlify/Cloudflare Worker) that holds both real keys
   server-side and forwards requests. I can build that function
   for you if you want it — say the word.

   If you're keeping this fully client-side anyway (e.g. private
   repo, just for local/testing use), replace the two B64
   constants with your OWN freshly-rotated keys — never reuse
   keys that were ever pasted into a chat, doc, or public commit.
=========================================================== */

const USE_PROXY = true;
const PROXY_ENDPOINT = "/api/florot";
// Only used if you ever flip USE_PROXY back to false for local testing.
// Leave as placeholders — never commit real keys here.
const ELEVENLABS_API_KEY_B64 = "YOUR_ELEVENLABS_KEY_BASE64_HERE";
const GROQ_API_KEY_B64       = "YOUR_GROQ_KEY_BASE64_HERE";

function getElevenLabsKey() { return atob(ELEVENLABS_API_KEY_B64); }
function getGroqKey()       { return atob(GROQ_API_KEY_B64); }

// Expressive female voice (Blackie) on ElevenLabs
const VOICE_ID = "iFhPOZcajR7W3sDL39qJ";

// Current Groq production model (Aug 2026). llama-3.3-70b-versatile is being
// retired Aug 16 2026 — openai/gpt-oss-120b is the recommended replacement.
// Check console.groq.com/docs/models if this ever 404s.
const GROQ_MODEL = "openai/gpt-oss-120b";

/* ---------------------- DOM refs ---------------------- */

const orbScreen      = document.getElementById('orbScreen');
const orbStatus      = document.getElementById('orbStatus');
const app            = document.getElementById('app');
const chatWindow     = document.getElementById('chatWindow');
const composer       = document.getElementById('composer');
const userInput      = document.getElementById('userInput');
const micBtn         = document.getElementById('micBtn');
const micStatus      = document.getElementById('micStatus');
const voiceToggleBtn = document.getElementById('voiceToggleBtn');
const songBtn         = document.getElementById('songBtn');
const floatingSongBtn = document.getElementById('floatingSongBtn');
const songAudio       = document.getElementById('songAudio');
const quickChips      = document.getElementById('quickChips');
const bgPetals         = document.getElementById('bgPetals');

/* ---------------------- State ---------------------- */

let voiceEnabled = true;
let currentTtsAudio = null; // track the active ElevenLabs <Audio> so we can clean up blob URLs

/* ---------------------- Background petals ---------------------- */

(function spawnPetals() {
  const emojis = ['🌸', '🌷', '💮', '🌹'];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.textContent = emojis[i % emojis.length];
    span.style.left = Math.random() * 100 + 'vw';
    span.style.animationDuration = (14 + Math.random() * 12) + 's';
    span.style.animationDelay = (-Math.random() * 20) + 's';
    span.style.fontSize = (12 + Math.random() * 10) + 'px';
    if (bgPetals) bgPetals.appendChild(span);
  }
})();

/* ---------------------- Orb entrance sequence ---------------------- */

const bootLines = [
  'waking up FLOROT',
  'lighting the orb for Florii',
  'almost there, putita'
];
let bootIndex = 0;
const bootInterval = setInterval(() => {
  bootIndex = (bootIndex + 1) % bootLines.length;
  if (orbStatus && orbStatus.childNodes[0]) {
    orbStatus.childNodes[0].nodeValue = bootLines[bootIndex];
  }
}, 900);

window.addEventListener('load', () => {
  setTimeout(() => {
    clearInterval(bootInterval);
    if (orbScreen) orbScreen.classList.add('fade-out');
    if (app) app.classList.remove('hidden');
    setTimeout(() => {
      if (orbScreen) orbScreen.remove();
      startGreeting();
    }, 500);
  }, 2600);
});

/* ---------------------- Browser-voice fallback (strict es-AR female) ---------------------- */

let cachedVoices = [];
function loadVoicesOnce() {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) { cachedVoices = existing; resolve(existing); return; }
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
    // Safety timeout in case onvoiceschanged never fires (some browsers)
    setTimeout(() => {
      if (!cachedVoices.length) cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 800);
  });
}

function pickBestSpanishFemaleVoice(voices) {
  const namedFemale = /female|mujer|monica|mónica|paulina|helena|sabina|elvira|lucia|lucía|victoria|conchita|isabela/i;
  // 1) Spanish-locale voice with an explicitly female-sounding name
  let v = voices.find(v => /^es/i.test(v.lang) && namedFemale.test(v.name));
  if (v) return v;
  // 2) Any Argentine/Latin American Spanish voice
  v = voices.find(v => /es-AR|es-419|es-MX|es-US/i.test(v.lang));
  if (v) return v;
  // 3) Any Spanish voice at all
  v = voices.find(v => /^es/i.test(v.lang));
  if (v) return v;
  // 4) Fall back to a named-female English voice so it's at least not robotic-default
  v = voices.find(v => namedFemale.test(v.name) || /google/i.test(v.name));
  return v || voices[0] || null;
}

async function speakWithBrowserVoice(cleanText) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const voices = cachedVoices.length ? cachedVoices : await loadVoicesOnce();
  const voice = pickBestSpanishFemaleVoice(voices);

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.94;
  utterance.pitch = 1.25;
  utterance.lang = voice ? voice.lang : 'es-AR';
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

/* ---------------------- Emotional Speech TTS (ElevenLabs, robust) ---------------------- */

async function speakText(text) {
  if (!voiceEnabled || !text) return;

  const cleanText = text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_~#]/g, '')
    .trim();

  if (!cleanText) return;

  // Stop and release any TTS audio currently playing before starting new speech
  if (currentTtsAudio) {
    currentTtsAudio.pause();
    if (currentTtsAudio.src) URL.revokeObjectURL(currentTtsAudio.src);
    currentTtsAudio = null;
  }

  try {
    const ttsUrl = USE_PROXY
      ? `${PROXY_ENDPOINT}/tts`
      : `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

    const headers = { 'Content-Type': 'application/json' };
    if (!USE_PROXY) headers['xi-api-key'] = getElevenLabsKey();

    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.85,
          style: 0.45,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`ElevenLabs TTS failed (${response.status} ${response.statusText}):`, errBody);
      await speakWithBrowserVoice(cleanText);
      return;
    }

    const audioBlob = await response.blob();
    if (!audioBlob || audioBlob.size === 0) {
      console.error('ElevenLabs returned an empty audio blob.');
      await speakWithBrowserVoice(cleanText);
      return;
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentTtsAudio = audio;

    audio.addEventListener('ended', () => { URL.revokeObjectURL(audioUrl); currentTtsAudio = null; });
    audio.addEventListener('error', (e) => {
      console.error('Playback error on ElevenLabs audio blob:', e);
      URL.revokeObjectURL(audioUrl);
      currentTtsAudio = null;
    });

    await audio.play().catch(async (err) => {
      console.warn('Autoplay blocked or playback failed, falling back to browser voice:', err);
      URL.revokeObjectURL(audioUrl);
      currentTtsAudio = null;
      await speakWithBrowserVoice(cleanText);
    });

  } catch (error) {
    console.error('ElevenLabs network/CORS error, using browser voice fallback:', error);
    await speakWithBrowserVoice(cleanText);
  }
}

/* ---------------------- Chat rendering helpers ---------------------- */

function scrollToBottom() {
  if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg msg--user';
  div.textContent = text;
  if (chatWindow) chatWindow.appendChild(div);
  scrollToBottom();
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'msg msg--bot msg--typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  if (chatWindow) chatWindow.appendChild(div);
  scrollToBottom();
  return div;
}

function typeAndSpeak(el, text) {
  return new Promise((resolve) => {
    el.classList.remove('msg--typing');
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    el.appendChild(cursor);

    const words = Math.max(text.split(/\s+/).length, 1);
    const estSeconds = words / 2.3;
    const perCharMs = Math.min(42, Math.max(14, (estSeconds * 1000) / text.length));

    speakText(text); // fire and forget — runs in parallel with the typewriter

    let i = 0;
    const timer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      el.appendChild(cursor);
      scrollToBottom();
      if (i >= text.length) {
        clearInterval(timer);
        cursor.remove();
        resolve();
      }
    }, perCharMs);
  });
}

async function addBotMessage(text, htmlAfter) {
  const typingEl = addTypingIndicator();
  await new Promise(r => setTimeout(r, 500));
  typingEl.className = 'msg msg--bot';
  await typeAndSpeak(typingEl, text);
  if (htmlAfter) {
    const extra = document.createElement('div');
    extra.style.marginTop = '8px';
    extra.innerHTML = htmlAfter;
    typingEl.appendChild(extra);
    scrollToBottom();
  }
}

/* ---------------------- Greeting ---------------------- */

async function startGreeting() {
  await addBotMessage(
    "holaaaa yo soy florot, estoy diseñada especialmente para Florencia, la pochi bomb, y fui creada por su esposo, Pradyot. 😉"
  );
  await addBotMessage(
    "esto es lo que puedo hacer por vos, pochi bomb:",
    `<ul style="margin:8px 0 0 18px; padding:0; font-size:13.5px; line-height:1.6;">
        <li>Type <b>'play voice'</b> or tap the 🎵 <b>Song</b> button to hear Pradyot singing for you.</li>
        <li>Type <b>'websites'</b> to see all the romantic websites Pradyot made for you.</li>
        <li>Use the 🎙️ mic button to speak to me, or just type anything — ask about your family, your favorite animal or book, whatever. I just "was born" so I'm still learning, but I'll be here for both of you 💛</li>
     </ul>`
  );
}

/* ---------------------- Knowledge base ---------------------- */

const KB = {
  websites: [
    { label: 'mi-vida', url: 'https://pradprivate-ops.github.io/mi-vida/' },
    { label: 'mi-amor', url: 'https://pradysprivate.github.io/mi-amor/' },
    { label: 'valentine', url: 'https://pradysprivate.github.io/florii-valentine/' },
    { label: 'bouquet', url: 'https://digibouquet.vercel.app/bouquet/31372770-c0cf-4ce0-bca0-b64cc2892a32' }
  ]
};

function websitesHTML() {
  return `<div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
    ${KB.websites.map(w => `<a href="${w.url}" target="_blank" rel="noopener"
      style="color:#c2185b; font-weight:700; text-decoration:none; border-bottom:1.5px solid rgba(194,24,91,0.35);">
      💌 ${w.label} → ${w.url}
    </a>`).join('')}
  </div>`;
}

/* ---------------------- Real AI Engine (Groq — OpenAI-compatible) ---------------------- */

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

async function fetchRealAIReply(userMessage) {
  try {
    let data;

    if (USE_PROXY) {
      const res = await fetch(`${PROXY_ENDPOINT}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      if (!res.ok) throw new Error(`Proxy error ${res.status}`);
      data = await res.json();
      return data.reply || "ay se me trabó la lengua un segundo jaja, decime de nuevo?";
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getGroqKey()}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.9,
        max_completion_tokens: 200
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`Groq API error (${response.status} ${response.statusText}):`, errBody);
      return "mmm se me cortó la señal un toque, pancuka, pero aca sigo para vos, and tell this to your husband ❤️";
    }

    data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (text) return text.trim();

    console.warn('Groq response had no message content:', data);
    return "putita wait, me colgué un segundo jaja. ¿qué me decías, pochi bomb?";

  } catch (err) {
    console.error('Groq fetch failed:', err);
    return "damn i got some problem in signal tell this issue to your husband ❤️";
  }
}

/* ---------------------- Intent matching ---------------------- */

function normalize(s) {
  return s.toLowerCase().trim();
}

function matchIntent(raw) {
  const t = normalize(raw);

  if (/play voice|play my song|\bsong\b|cant[a|á]|ya fue/.test(t)) return { type: 'song' };
  if (/website|link|paginas?|sitios?/.test(t)) return { type: 'websites' };
  if (/^(hola+|hi|hey|hello|buenas)\b/.test(t)) return { type: 'greeting' };
  if (/who (are|r) you|qui[eé]n sos|your name|about yourself/.test(t)) return { type: 'identity' };
  if (/who (made|created|built) you|quien te (hizo|creo)/.test(t)) return { type: 'creator' };
  if (/our story|how did we (start|meet)|nuestra historia|como empezamos/.test(t)) return { type: 'story' };
  if (/propos(e|al|ed)|anniversary|jan(uary)? ?22|22 de enero/.test(t)) return { type: 'proposal' };
  if (/(my |our )?family|claudio|diana|celes|nehuen|familia/.test(t)) return { type: 'family' };
  if (/favorite (book|animal|treat)|rayuela|orca|alfajor/.test(t)) return { type: 'favorites' };
  if (/fight|argument|pelea|discusi[oó]n|privacy|privacidad/.test(t)) return { type: 'philosophy' };
  if (/how old|age|edad|cumplea[ñn]os|birthday/.test(t)) return { type: 'ages' };
  if (/where (do i|does florii|are you) live|quilmes|berazategui|hudson/.test(t)) return { type: 'location' };
  if (/i love you|te amo|te quiero|miss you|te extra[ñn]o/.test(t)) return { type: 'affection' };
  return { type: 'unknown' };
}

/* ---------------------- Reply generation ---------------------- */

async function getReply(raw) {
  const intent = matchIntent(raw);

  switch (intent.type) {
    case 'song':
      playSong();
      return { text: "acá va, mi amor 🎶 pushing play on Prady's song for you right now…" };

    case 'websites':
      return {
        text: "todos estos son los rinconcitos de internet que Prady armó solo para vos, pochi bomb:",
        html: websitesHTML()
      };

    case 'greeting':
      return { text: "holaaaa boluda, ¿cómo andás? soy Florot, tu marido me hizo para vos. recién nazco así que tenéme paciencia si digo alguna boludez — igual, él te ama un montón." };

    case 'identity':
      return { text: "soy FLOROT — una IA hecha con mucho amor by Pradyot, tu marido, solo para vos, Florencia. mi trabajo es cuidarte, hacerte reir y recordarte todo lo que él siente por vos 😉" };

    case 'creator':
      return { text: "Pradyot me creó, mi amor. Flor's Lord en persona se puso a programar de noche solo para hacerte sonreír." };

    case 'story':
      return { text: "nos conocimos en un GC y nos hicimos re amigos primero. vos le propusiste primero, borracha, el 31 de diciembre de 2025 — y bueno, el resto es historia de amor con algún que otro drama jaja." };

    case 'proposal':
      return { text: "escuchá esta: el 22 de enero es LA fecha, mi amor — el día que Prady te aceptó de vuelta y te propuso oficialmente, después de rezar por vos con lágrimas en los ojos. ese es su aniversario 💍" };

    case 'family':
      return { text: "tu papá Claudio, tu mamá Diana, tu hermana Celes y tu hermano Nehuen — toda tu familia forma parte de esta historia, pochi bomb." };

    case 'favorites':
      return { text: "Rayuela de Cortázar, las orcas, y los alfajores — tus tres debilidades, en ese orden más o menos jaja." };

    case 'philosophy':
      return { text: "las peleas de pareja son normales, mi amor — un chiquilín como Prady y una diosa de los elfos como vos siempre se terminan reconciliando. y entre ustedes dos no hay privacidad, se cuentan todo — así es como se construye confianza real." };

    case 'ages':
      return { text: "Prady tiene 19 (nació el 16 de nov de 2006) y vos 25 (6 de nov de 2000) — 6 años de diferencia y ni un poquito de importarles jaja." };

    case 'location':
      return { text: "sos de Quilmes originalmente, y ahora vivís entre Berazategui y Hudson Village, Argentina 🇦🇷" };

    case 'affection':
      return { text: "pelotuda de mierda dumbass, ¿cómo te atrevés a decirme 'te amo'? Decíselo a vos marido ahora." };

    default:
      const dynamicAiResponse = await fetchRealAIReply(raw);
      return { text: dynamicAiResponse };
  }
}

/* ---------------------- Song playback ---------------------- */

function playSong() {
  if (!songAudio) return;
  songAudio.currentTime = 0;
  songAudio.play().catch(() => {
    if (micStatus) micStatus.textContent = "couldn't auto-play — tap the 🎵 button once more, mi amor.";
  });
  if (songBtn) songBtn.classList.add('playing');
  if (floatingSongBtn) floatingSongBtn.classList.add('playing');
}

if (songAudio) {
  songAudio.addEventListener('ended', () => {
    if (songBtn) songBtn.classList.remove('playing');
    if (floatingSongBtn) floatingSongBtn.classList.remove('playing');
  });
}
if (songBtn) songBtn.addEventListener('click', playSong);
if (floatingSongBtn) floatingSongBtn.addEventListener('click', playSong);

/* ---------------------- Voice toggle ---------------------- */

if (voiceToggleBtn) {
  voiceToggleBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    voiceToggleBtn.setAttribute('aria-pressed', String(voiceEnabled));
    voiceToggleBtn.querySelector('.ico').textContent = voiceEnabled ? '🔊' : '🔇';
    voiceToggleBtn.querySelector('.lbl').textContent = voiceEnabled ? 'Voice On' : 'Voice Off';
    if (!voiceEnabled) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (currentTtsAudio) { currentTtsAudio.pause(); }
    }
  });
}

/* ---------------------- Composer (send) ---------------------- */

async function handleUserText(text) {
  if (!text.trim()) return;
  addUserMessage(text);
  if (userInput) userInput.value = '';

  const reply = await getReply(text);
  await addBotMessage(reply.text, reply.html);
}

if (composer) {
  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserText(userInput.value);
  });
}

if (quickChips) {
  quickChips.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    handleUserText(btn.dataset.cmd);
  });
}

/* ---------------------- Mic / Speech-to-Text ---------------------- */

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (SpeechRecognitionCtor) {
  recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    listening = true;
    if (micBtn) micBtn.classList.add('listening');
    if (micStatus) micStatus.textContent = 'listening… hablá nomás 🎙️';
  };
  recognition.onend = () => {
    listening = false;
    if (micBtn) micBtn.classList.remove('listening');
    if (micStatus) micStatus.textContent = '';
  };
  recognition.onerror = () => {
    listening = false;
    if (micBtn) micBtn.classList.remove('listening');
    if (micStatus) micStatus.textContent = 'no te escuché bien, intentá de nuevo.';
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    handleUserText(transcript);
  };

  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (listening) {
        recognition.stop();
      } else {
        try { recognition.start(); } catch (e) { /* already started */ }
      }
    });
  }
} else {
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (micStatus) micStatus.textContent = 'speech recognition is not supported in this browser 😔';
    });
  }
}
