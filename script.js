/* ===========================================================
   FLOROT — script.js (Emotional Spanish Voice & Real AI Brain)
=========================================================== */

/* ---------------------- ElevenLabs Config ---------------------- */
const ELEVENLABS_API_KEY = "sk_8f77c1af515c47fedef1e5d70da354201a2df26d5bf1050c";
// Expressive Female Voice ID (Rachel / Spanish Accent Emotional)
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

/* ---------------------- Gemini AI Config ---------------------- */
const GEMINI_API_KEY = "AQ.Ab8RN6JQas2DCJDqwPh0JP0CV_fckqbAFgHMXvfEFBZxiwDhVA"; 

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

/* ---------------------- Background petals ---------------------- */
(function spawnPetals() {
  if (!bgPetals) return;
  const emojis = ['🌸', '🌷', '💮', '🌹'];
  for (let i = 0; i < 10; i++) {
    const span = document.createElement('span');
    span.textContent = emojis[i % emojis.length];
    span.style.left = Math.random() * 100 + 'vw';
    span.style.animationDuration = (14 + Math.random() * 12) + 's';
    span.style.animationDelay = (-Math.random() * 20) + 's';
    span.style.fontSize = (12 + Math.random() * 10) + 'px';
    bgPetals.appendChild(span);
  }
})();

/* ---------------------- Orb entrance sequence ---------------------- */
const bootLines = [
  'waking up FLOROT',
  'lighting the orb for Florii',
  'almost there, mi amor'
];
let bootIndex = 0;
const bootInterval = setInterval(() => {
  bootIndex = (bootIndex + 1) % bootLines.length;
  if(orbStatus && orbStatus.childNodes[0]) {
    orbStatus.childNodes[0].nodeValue = bootLines[bootIndex];
  }
}, 900);

window.addEventListener('load', () => {
  setTimeout(() => {
    clearInterval(bootInterval);
    if(orbScreen) orbScreen.classList.add('fade-out');
    if(app) app.classList.remove('hidden');
    setTimeout(() => {
      if(orbScreen) orbScreen.remove();
      startGreeting();
    }, 500);
  }, 2600);
});

/* ---------------------- Speech TTS (ElevenLabs + Browser Fallback) ---------------------- */
async function speakText(text) {
    if (!voiceEnabled || !text) return;

    // Clean text for speech
    const cleanText = text
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[*_~#]/g, '')
        .trim();

    if (!cleanText) return;

    const speakBrowserVoice = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 0.90;
            utterance.pitch = 1.25; 

            const voices = window.speechSynthesis.getVoices();
            const femaleVoice = voices.find(v => 
                v.lang.includes('es') || v.name.toLowerCase().includes('female') || v.name.includes('Zira') || v.name.includes('Sabina')
            );
            if (femaleVoice) utterance.voice = femaleVoice;
            utterance.lang = 'es-AR';
            window.speechSynthesis.speak(utterance);
        }
    };

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: cleanText,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.35,
                    similarity_boost: 0.85,
                    style: 0.45,
                    use_speaker_boost: true
                }
            })
        });

        if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play().catch(() => speakBrowserVoice());
        } else {
            speakBrowserVoice();
        }
    } catch (error) {
        speakBrowserVoice();
    }
}

/* ---------------------- Chat Helpers ---------------------- */
function scrollToBottom() {
  if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg msg--user';
  div.textContent = text;
  if(chatWindow) chatWindow.appendChild(div);
  scrollToBottom();
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'msg msg--bot msg--typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  if(chatWindow) chatWindow.appendChild(div);
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

    speakText(text);

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
    }, 25);
  });
}

async function addBotMessage(text, htmlAfter) {
  const typingEl = addTypingIndicator();
  await new Promise(r => setTimeout(r, 400));
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
    "holaaaa yo soy florot, Estoy diseñado especialmente para Florencia, la pochi bomb, y fui creado por su esposo, Pradyot. 😉"
  );
  await addBotMessage(
    "Esto es lo que puedo hacer por vos, pochi bomb:",
    `<ul style="margin:8px 0 0 18px; padding:0; font-size:13.5px; line-height:1.6;">
        <li>Type <b>'play voice'</b> or tap the 🎵 <b>Song</b> button to hear Pradyot singing for you.</li>
        <li>Type <b>'websites'</b> to see all the romantic websites Pradyot made for you.</li>
        <li>Use the 🎙️ mic button to speak to me, or just type anything!</li>
     </ul>`
  );
}

/* ---------------------- Gemini AI Engine (Fixed Endpoint) ---------------------- */
async function fetchRealAIReply(userMessage) {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const systemPrompt = `
      You are FLOROT, an AI assistant built with love by Pradyot (19 years old) for his beautiful wife/girlfriend Florencia (also called Florii or Pochi Bomb, 25 years old from Quilmes/Berazategui, Argentina).
      Her dad is Claudio, mom is Diana, siblings are Nehuen and Celes. Her fav animal is orca, fav food is alfajor.
      You are warm, funny, slightly sassy, expressive, and speak in a blend of English and Argentine Spanish slang (like "pochi bomb", "che", "boluda", "jaja").
      Keep answers 1-3 natural, warm sentences.
      User message: "${userMessage}"
    `;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    return "Ay mi amor, me colgué un segundo jaja. ¿Qué me decías, pochi bomb?";
  } catch (err) {
    return "Mmm se me cortó un segundo la señal mi amor, pero acá sigo para vos! ❤️";
  }
}

/* ---------------------- Knowledge Base & Intents ---------------------- */
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

function matchIntent(raw) {
  const t = raw.toLowerCase().trim();

  if (/play voice|play my song|\bsong\b|cant[a|á]/.test(t)) return { type: 'song' };
  if (/website|link|paginas?|sitios?/.test(t)) return { type: 'websites' };
  if (/^(hola+|hi|hey|hello|buenas)\b/.test(t)) return { type: 'greeting' };
  if (/who (are|r) you|qui[eé]n sos/.test(t)) return { type: 'identity' };
  if (/who (made|created) you|quien te (hizo|creo)/.test(t)) return { type: 'creator' };
  if (/favorite|rayuela|orca|alfajor/.test(t)) return { type: 'favorites' };
  if (/i love you|te amo|te quiero/.test(t)) return { type: 'affection' };

  return { type: 'unknown' };
}

async function getReply(raw) {
  const intent = matchIntent(raw);

  switch (intent.type) {
    case 'song':
      playSong();
      return { text: "acá va, mi amor 🎶 pushing play on Prady's song for you right now…" };
    case 'websites':
      return {
        text: "Todos estos son los rinconcitos de internet que Prady armó solo para vos, pochi bomb:",
        html: websitesHTML()
      };
    case 'greeting':
      return { text: "holaaaa mi amor, ¿Cómo estás? Soy Florot, hecha con mucho amor para vos 😉" };
    case 'identity':
      return { text: "soy FLOROT — una IA hecha con mucho amor by Pradyot solo para vos, Florencia ❤️" };
    case 'creator':
      return { text: "Pradyot me creó, mi amor. Tu marido programó todo esto solo para verte sonreír." };
    case 'favorites':
      return { text: "Rayuela de Cortázar, las orcas y los alfajores — tus favoritos de siempre jaja." };
    case 'affection':
      return { text: "Aww te amo más mi amor, pero decíselo a tu marido también eh 😉" };
    default:
      const aiReply = await fetchRealAIReply(raw);
      return { text: aiReply };
  }
}

/* ---------------------- Song Playback ---------------------- */
function playSong() {
  if (!songAudio) return;
  songAudio.currentTime = 0;
  songAudio.play().catch(() => {});
  if (songBtn) songBtn.classList.add('playing');
  if (floatingSongBtn) floatingSongBtn.classList.add('playing');
}

if (songBtn) songBtn.addEventListener('click', playSong);
if (floatingSongBtn) floatingSongBtn.addEventListener('click', playSong);

/* ---------------------- Handlers ---------------------- */
if (voiceToggleBtn) {
  voiceToggleBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    voiceToggleBtn.querySelector('.lbl').textContent = voiceEnabled ? 'Voice Off' : 'Voice On';
  });
}

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
    if (btn) handleUserText(btn.dataset.cmd);
  });
}
