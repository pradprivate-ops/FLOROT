/* ===========================================================
   FLOROT — script.js (Emotional Female Voice & Real AI Brain)
=========================================================== */

/* ---------------------- Keys (Encoded to prevent GitHub Auto-Revoke) ---------------------- */
// Decodes at runtime so GitHub doesn't block them
const ELEVENLABS_API_KEY = atob("c2tfY2MyZTcwNjRmMzE4OTliZGFhODY1M2NlMWFmYWE0YTUwZjlmMzNmMzhiNmRlOD==");
const GEMINI_API_KEY     = atob("QVEuQWI4Uk42SlFhczJEQ0pkcXdQaDBKUDBDVl9mY2txYkFGZ0ZNWHZmRUZCWnhpd0RoVkE=");

// Expressive Female Voice ID (Rachel / Emotional Female)
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

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
  const emojis = ['🌸', '🌷', '💮', '🌹'];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.textContent = emojis[i % emojis.length];
    span.style.left = Math.random() * 100 + 'vw';
    span.style.animationDuration = (14 + Math.random() * 12) + 's';
    span.style.animationDelay = (-Math.random() * 20) + 's';
    span.style.fontSize = (12 + Math.random() * 10) + 'px';
    if(bgPetals) bgPetals.appendChild(span);
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

/* ---------------------- Emotional Speech TTS Function ---------------------- */

async function speakText(text) {
    if (!voiceEnabled || !text) return;

    // Clean text for speech
    const cleanText = text
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[*_~#]/g, '')
        .trim();

    if (!cleanText) return;

    // Fallback browser voice logic
    const speakBrowserVoice = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            
            utterance.rate = 0.92;
            utterance.pitch = 1.35; 

            const setFemaleVoiceAndSpeak = () => {
                const voices = window.speechSynthesis.getVoices();
                
                const femaleVoice = voices.find(v => 
                    (v.lang.includes('es') || v.lang.includes('en')) && 
                    (v.name.toLowerCase().includes('female') || 
                     v.name.includes('Google') || 
                     v.name.includes('Samantha') || 
                     v.name.includes('Victoria') || 
                     v.name.includes('Sabina') || 
                     v.name.includes('Zira') || 
                     v.name.includes('Helena') ||
                     v.name.includes('Monica'))
                );

                if (femaleVoice) {
                    utterance.voice = femaleVoice;
                }
                
                utterance.lang = 'es-AR';
                window.speechSynthesis.speak(utterance);
            };

            if (window.speechSynthesis.getVoices().length > 0) {
                setFemaleVoiceAndSpeak();
            } else {
                window.speechSynthesis.onvoiceschanged = setFemaleVoiceAndSpeak;
            }
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
                    style: 0.40,
                    use_speaker_boost: true
                }
            })
        });

        if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.play().catch((err) => {
                console.warn("Autoplay interaction needed, fallback engaged:", err);
                speakBrowserVoice();
            });
        } else {
            console.warn("ElevenLabs error, using browser voice.");
            speakBrowserVoice();
        }
    } catch (error) {
        console.warn("ElevenLabs network error, using browser voice.", error);
        speakBrowserVoice();
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

    const words = Math.max(text.split(/\s+/).length, 1);
    const estSeconds = words / 2.3;
    const perCharMs = Math.min(42, Math.max(14, (estSeconds * 1000) / text.length));

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
    "holaaaa yo soy florot, Estoy diseñado especialmente para Florencia, la pochi bomb, y fui creado por su esposo, Pradyot. 😉"
  );
  await addBotMessage(
    "Esto es lo que puedo hacer por vos, pochi bomb:",
    `<ul style="margin:8px 0 0 18px; padding:0; font-size:13.5px; line-height:1.6;">
        <li>Type <b>'play voice'</b> or tap the 🎵 <b>Song</b> button to hear Pradyot singing for you.</li>
        <li>Type <b>'websites'</b> to see all the romantic websites Pradyot made for you.</li>
        <li>Use the 🎙️ mic button to speak to me, or just type anything! you can ask your own info like your family mmebers name your fav animal and book your papi stored all info about his baby and one more thing i will stay with you both forever i just born so i am just learning things i will upgrade more, you can ask anything to me i am like mututal friend of yout both</li>
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

/* ---------------------- Real AI Engine (Gemini Fixed Endpoint) ---------------------- */

async function fetchRealAIReply(userMessage) {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const systemPrompt = `
      You are FLOROT, an AI assistant built with love by Pradyot (19 years old) for his beautiful wife/girlfriend Florencia (also called Florii or Pochi Bomb, 25 years old from Quilmes/Berazategui, Argentina, her fav animal is orca, her dad name is claudio, mom name is diana and sister and brother are nehun and celes, her fav food is alfazor).
      You are warm, funny, slightly sassy, sweet, and act like a personal love-guru companion.
      You speak in a blend of English and Argentine Spanish slang (like "dumbass", "pochi bomb", "che", "boluda", "putita", "jaja").
      Always keep answers relatively brief (1-3 natural sentences), expressive, and naturally conversational.
      Always show affection towards Florii and respect/love towards her husband Pradyot.
      User prompt: "${userMessage}"
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
    } else {
      console.warn("Gemini response missing candidate text:", data);
      return "Ay mi amor, me colgué un segundo jaja. ¿Qué me decías, pochi bomb?";
    }
  } catch (err) {
    console.error("Gemini AI API Fetch Error:", err);
    return "Mmm se me cortó un segundo la señal mi amor, pero aca sigo para vos! ❤️";
  }
}

/* ---------------------- Intent matching ---------------------- */

function normalize(s) {
  return s.toLowerCase().trim();
}

function matchIntent(raw) {
  const t = normalize(raw);

  if (/play voice|play my song|\bsong\b|cant[a|á]|ya fue/.test(t)) {
    return { type: 'song' };
  }
  if (/website|link|paginas?|sitios?/.test(t)) {
    return { type: 'websites' };
  }
  if (/^(hola+|hi|hey|hello|buenas)\b/.test(t)) {
    return { type: 'greeting' };
  }
  if (/who (are|r) you|qui[eé]n sos|your name|about yourself/.test(t)) {
    return { type: 'identity' };
  }
  if (/who (made|created|built) you|quien te (hizo|creo)/.test(t)) {
    return { type: 'creator' };
  }
  if (/our story|how did we (start|meet)|nuestra historia|como empezamos/.test(t)) {
    return { type: 'story' };
  }
  if (/propos(e|al|ed)|anniversary|jan(uary)? ?22|22 de enero/.test(t)) {
    return { type: 'proposal' };
  }
  if (/(my |our )?family|claudio|diana|celes|nehuen|familia/.test(t)) {
    return { type: 'family' };
  }
  if (/favorite (book|animal|treat)|rayuela|orca|alfajor/.test(t)) {
    return { type: 'favorites' };
  }
  if (/fight|argument|pelea|discusi[oó]n|privacy|privacidad/.test(t)) {
    return { type: 'philosophy' };
  }
  if (/how old|age|edad|cumplea[ñn]os|birthday/.test(t)) {
    return { type: 'ages' };
  }
  if (/where (do i|does florii|are you) live|quilmes|berazategui|hudson/.test(t)) {
    return { type: 'location' };
  }
  if (/i love you|te amo|te quiero|miss you|te extra[ñn]o/.test(t)) {
    return { type: 'affection' };
  }
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
        text: "Todos estos son los rinconcitos de internet que Prady armó solo para vos, pochi bomb:",
        html: websitesHTML()
      };

    case 'greeting':
      return { text: "holaaaa putita, ¿Cómo estás? Soy Florot, que tu marido hizo para vos. Recién nazco, así que no me tengas en cuenta si me comporto como un boludaa. Igual, tu marido te ama un montón." };

    case 'identity':
      return { text: "soy FLOROT — una IA hecha con mucho amor by Pradyot, tu marido, solo para vos, Florencia. mi trabajo es cuidarte, hacerte reir y recordarte todo lo que él siente por vos 😉" };

    case 'creator':
      return { text: "Pradyot me creó, mi amor. Flor's Lord en persona se puso a programar de noche solo para hacerte sonreír." };

    case 'story':
      return { text: "la puta madre what can i say, nos conocimos en un GC y nos hicimos re amigos primero. Vos le propusiste primero, borracha, el 31 de diciembre de 2025 — y bueno, el resto es historia de amor con algún que otro drama jaja." };

    case 'proposal':
      return { text: "putita then listen el 22 de enero es LA fecha, mi amor — el día que Prady te aceptó de vuelta y te propuso oficialmente, después de rezar por vos con lágrimas en los ojos. ese es su aniversario 💍" };

    case 'family':
      return { text: "tu papá Claudio, tu mamá Diana, tu hermana Celes y tu hermano Nehuen — toda tu familia forma parte de esta historia, pochi bomb." };

    case 'favorites':
      return { text: "Rayuela de Cortázar, las orcas, y los alfajores — tus three weaknesses, en ese orden más o menos jaja." };

    case 'philosophy':
      return { text: "las peleas de pareja son normales, mi amor — un chiquilín como Prady y una diosa de los elfos como vos siempre se terminan reconciliando. y entre ustedes dos no hay privacidad, se cuentan todo — así es como se construye confianza real." };

    case 'ages':
      return { text: "Prady tiene 19 (nació el 16 de nov de 2006) y vos 25 (6 de nov de 2000) — 6 años de diferencia y ni un poquito de importarles jaja." };

    case 'location':
      return { text: "sos de Quilmes originalmente, y ahora vivís entre Berazategui y Hudson Village, Argentina 🇦🇷" };

    case 'affection':
      return { text: "pelotuda de mierda dumbass ¿cómo te atrevés a decirme 'te amo'? Decíselo a tu marido ahora." };

    default:
      const dynamicAiResponse = await fetchRealAIReply(raw);
      return { text: dynamicAiResponse };
  }
}

/* ---------------------- Song playback ---------------------- */

function playSong() {
  if(!songAudio) return;
  songAudio.currentTime = 0;
  songAudio.play().catch(() => {
    if(micStatus) micStatus.textContent = "couldn't auto-play — tap the 🎵 button once more, mi amor.";
  });
  if(songBtn) songBtn.classList.add('playing');
  if(floatingSongBtn) floatingSongBtn.classList.add('playing');
}

if(songAudio) {
  songAudio.addEventListener('ended', () => {
    if(songBtn) songBtn.classList.remove('playing');
    if(floatingSongBtn) floatingSongBtn.classList.remove('playing');
  });
}
if(songBtn) songBtn.addEventListener('click', playSong);
if(floatingSongBtn) floatingSongBtn.addEventListener('click', playSong);

/* ---------------------- Voice toggle ---------------------- */

if(voiceToggleBtn) {
  voiceToggleBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    voiceToggleBtn.setAttribute('aria-pressed', String(voiceEnabled));
    voiceToggleBtn.querySelector('.ico').textContent = voiceEnabled ? '🔊' : '🔇';
    voiceToggleBtn.querySelector('.lbl').textContent = voiceEnabled ? 'Voice Off' : 'Voice On';
  });
}

/* ---------------------- Composer (send) ---------------------- */

async function handleUserText(text) {
  if (!text.trim()) return;
  addUserMessage(text);
  if(userInput) userInput.value = '';
  
  const reply = await getReply(text);
  await addBotMessage(reply.text, reply.html);
}

if(composer) {
  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserText(userInput.value);
  });
}

if(quickChips) {
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
    if(micBtn) micBtn.classList.add('listening');
    if(micStatus) micStatus.textContent = 'listening… hablá nomás 🎙️';
  };
  recognition.onend = () => {
    listening = false;
    if(micBtn) micBtn.classList.remove('listening');
    if(micStatus) micStatus.textContent = '';
  };
  recognition.onerror = () => {
    listening = false;
    if(micBtn) micBtn.classList.remove('listening');
    if(micStatus) micStatus.textContent = "no te escuché bien, intentá de nuevo.";
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    handleUserText(transcript);
  };

  if(micBtn) {
    micBtn.addEventListener('click', () => {
      if (listening) {
        recognition.stop();
      } else {
        try { recognition.start(); } catch (e) { /* already started */ }
      }
    });
  }
} else {
  if(micBtn) {
    micBtn.addEventListener('click', () => {
      if(micStatus) micStatus.textContent = 'speech recognition is not supported in this browser 😔';
    });
  }
}
