// Efeitos sonoros sintetizados (sem arquivos de áudio). Liga/desliga fica salvo no navegador.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('chumbada_som') === 'off'; } catch { /* sem armazenamento */ }

function ac() {
  if (muted) return null;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq, start, dur, { type = 'sine', vol = 0.18, slide = 0 } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  isMuted: () => muted,
  setMuted(v) {
    muted = v;
    try { localStorage.setItem('chumbada_som', v ? 'off' : 'on'); } catch { /* ok */ }
  },
  unlock() { ac(); },
  click() { tone(660, 0, 0.06, { type: 'triangle', vol: 0.08 }); },
  tick() { tone(1200, 0, 0.05, { type: 'square', vol: 0.05 }); },
  count() { tone(520, 0, 0.16, { type: 'triangle', vol: 0.16 }); },
  go() { tone(880, 0, 0.12, { type: 'triangle' }); tone(1320, 0.1, 0.22, { type: 'triangle' }); },
  correct() { tone(660, 0, 0.1, { type: 'triangle' }); tone(990, 0.08, 0.18, { type: 'triangle' }); },
  bonus() { tone(1320, 0, 0.08, { type: 'sine', vol: 0.1 }); tone(1760, 0.06, 0.12, { type: 'sine', vol: 0.1 }); },
  wrong() { tone(220, 0, 0.28, { type: 'sawtooth', vol: 0.08, slide: -90 }); },
  timeout() { tone(330, 0, 0.18, { type: 'square', vol: 0.06 }); tone(247, 0.16, 0.3, { type: 'square', vol: 0.06 }); },
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.3, { type: 'triangle', vol: 0.14 })); },
};
