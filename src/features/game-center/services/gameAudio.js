/**
 * Efectos de sonido sintetizados con Web Audio API: no hay archivos de audio,
 * ni música de terceros, ni nada que descargar.
 *
 * El AudioContext se crea en el primer `play()`, que siempre ocurre tras una
 * interacción (pulsar «Jugar», mover una pieza), así que el navegador lo permite.
 * Si Web Audio no existe o falla, todo sigue funcionando en silencio.
 *
 * Un efecto ("receta") es: { wave, from, to, dur, gain, noise?, delay? }
 *   wave: sine | square | triangle | sawtooth     from/to: Hz (barrido)
 *   noise: true → ruido blanco filtrado (salpicaduras, golpes)
 * Una receta puede ser una lista de notas para tocarlas en secuencia.
 */

export function createGameAudio({ volume = 0.6, muted = false } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let state = { volume, muted };
  let closed = false;

  const ensure = () => {
    if (closed || state.muted) return null;
    if (ctx) return ctx;
    const AudioCtx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AudioCtx) return null;
    try {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = state.volume;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const getNoise = () => {
    if (noiseBuffer) return noiseBuffer;
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  };

  const voice = (note, at) => {
    const { wave = 'sine', from = 440, to = from, dur = 0.12, gain = 0.25, noise = false, delay = 0 } = note;
    const start = at + delay;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    env.connect(master);

    let source;
    if (noise) {
      source = ctx.createBufferSource();
      source.buffer = getNoise();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(from, start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), start + dur);
      source.connect(filter).connect(env);
    } else {
      source = ctx.createOscillator();
      source.type = wave;
      source.frequency.setValueAtTime(from, start);
      source.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
      source.connect(env);
    }
    source.start(start);
    source.stop(start + dur + 0.05);
  };

  return {
    play(recipe) {
      if (!recipe || !ensure()) return;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        const notes = Array.isArray(recipe) ? recipe : [recipe];
        const now = ctx.currentTime;
        notes.forEach((note) => voice(note, now));
      } catch {
        // Un fallo de audio nunca interrumpe la partida.
      }
    },
    setVolume(value) {
      state = { ...state, volume: value };
      if (master) master.gain.setTargetAtTime(value, ctx.currentTime, 0.05);
    },
    setMuted(value) {
      state = { ...state, muted: value };
      if (value && ctx?.state === 'running') ctx.suspend();
      if (!value && ctx?.state === 'suspended') ctx.resume();
    },
    /** Pausa: silencia los efectos que suenan. */
    suspend() {
      if (ctx?.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx?.state === 'suspended' && !state.muted) ctx.resume().catch(() => {});
    },
    /** Libera el dispositivo de audio al salir del juego. */
    close() {
      closed = true;
      if (ctx) ctx.close().catch(() => {});
      ctx = null;
      master = null;
    },
  };
}
