import { useCallback, useEffect, useState } from 'react';
import { SPEECH_LANGS } from '../engine/markdown.js';

/**
 * Lectura en voz alta con las voces instaladas en el dispositivo (Web Speech API).
 * Se prefieren voces locales (`localService`) porque funcionan sin conexión; si el
 * dispositivo no tiene ninguna voz para un idioma, el botón no se muestra.
 */
const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

function voicesFor(lang) {
  const list = synth()?.getVoices?.() ?? [];
  const prefix = SPEECH_LANGS[lang]?.slice(0, 2);
  return list.filter((voice) => voice.lang?.toLowerCase().startsWith(prefix));
}

export function useSpeech(lang) {
  const [available, setAvailable] = useState(() => voicesFor(lang).length > 0);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const engine = synth();
    if (!engine?.addEventListener) return undefined;
    const update = () => setAvailable(voicesFor(lang).length > 0);
    update();
    engine.addEventListener('voiceschanged', update);
    return () => engine.removeEventListener('voiceschanged', update);
  }, [lang]);

  const speak = useCallback(
    (text) => {
      const engine = synth();
      if (!engine || typeof window.SpeechSynthesisUtterance !== 'function') return;
      engine.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      const voices = voicesFor(lang);
      utterance.voice = voices.find((v) => v.localService && v.lang === SPEECH_LANGS[lang]) ?? voices.find((v) => v.localService) ?? voices[0] ?? null;
      utterance.lang = utterance.voice?.lang ?? SPEECH_LANGS[lang];
      utterance.rate = 0.88;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = utterance.onerror = () => setSpeaking(false);
      engine.speak(utterance);
    },
    [lang],
  );

  return { available, speaking, speak };
}
