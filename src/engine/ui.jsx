import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GAMES, GAME_ORDER, HUB_URL } from './games.js';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- fundo do mar animado
export function Ocean({ glow = '26, 160, 166' }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || prefersReducedMotion()) return undefined;
    const c = canvas.getContext('2d');
    let w = 0, h = 0, raf = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    const bubbles = [];
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (anywhere) => ({
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 20,
      r: 1 + Math.random() * 3.5, s: 0.25 + Math.random() * 0.7, ph: Math.random() * 6.28, a: 0.15 + Math.random() * 0.35,
    });
    resize();
    const count = Math.round(Math.min(46, (w * h) / 26000));
    for (let i = 0; i < count; i++) bubbles.push(spawn(true));
    let last = performance.now();
    const frame = (t) => {
      const dt = Math.min(50, t - last) / 16.7; last = t;
      c.clearRect(0, 0, w, h);
      for (const b of bubbles) {
        b.y -= b.s * dt; b.ph += 0.02 * dt;
        const x = b.x + Math.sin(b.ph) * 6;
        if (b.y < -10) Object.assign(b, spawn(false));
        c.beginPath();
        c.arc(x, b.y, b.r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(200, 240, 255, ${b.a})`;
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = `rgba(${glow}, ${b.a * 0.18})`;
        c.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
  }, [glow]);
  return (
    <div className="ocean" aria-hidden="true">
      <div className="ocean-rays" />
      <div className="ocean-caustics" />
      <canvas ref={ref} className="ocean-bubbles" />
      <svg className="ocean-waves" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path d="M0,64 C240,112 480,16 720,56 C960,96 1200,24 1440,60 L1440,120 L0,120 Z" />
        <path d="M0,84 C260,40 520,110 780,74 C1040,38 1240,96 1440,70 L1440,120 L0,120 Z" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- número que "rola" até o valor
export function AnimatedNumber({ value, duration = 700, format = (n) => n.toLocaleString('pt-BR') }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); from.current = value; return undefined; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, duration]);
  return <>{format(shown)}</>;
}

// ---------------------------------------------------------------- cronômetro circular
export function TimerRing({ total, left }) {
  const r = 26;
  const C = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, left / total));
  const secs = Math.ceil(left);
  const danger = left <= 3;
  return (
    <div className={`timer-ring ${danger ? 'danger' : ''}`} role="timer" aria-label={`${secs} segundos`}>
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} className="timer-track" />
        <circle cx="32" cy="32" r={r} className="timer-bar" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <span key={secs} className="timer-num">{secs}</span>
    </div>
  );
}

// ---------------------------------------------------------------- confete
export function fireConfetti(colors = ['#ff7a1a', '#22d3ee', '#f5c451', '#ffffff', '#34d399']) {
  if (prefersReducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  document.body.appendChild(canvas);
  const c = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = (canvas.width = innerWidth * dpr), h = (canvas.height = innerHeight * dpr);
  // dois "canhões" nos cantos de baixo, atirando em direção ao centro
  const parts = Array.from({ length: 160 }, (_, i) => {
    const left = i % 2 === 0;
    return {
      x: left ? w * 0.08 : w * 0.92, y: h * 0.8,
      vx: (left ? 1 : -1) * (4 + Math.random() * 11) * dpr,
      vy: -(14 + Math.random() * 12) * dpr, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      s: (5 + Math.random() * 7) * dpr, col: colors[i % colors.length], shape: i % 3,
    };
  });
  const start = performance.now();
  const frame = (t) => {
    const el = t - start;
    c.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.38 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
      c.globalAlpha = Math.max(0, 1 - el / 3200);
      c.fillStyle = p.col;
      if (p.shape === 0) c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else if (p.shape === 1) { c.beginPath(); c.arc(0, 0, p.s / 3, 0, 6.28); c.fill(); }
      else { c.beginPath(); c.moveTo(0, -p.s / 2); c.lineTo(p.s / 2, p.s / 2); c.lineTo(-p.s / 2, p.s / 2); c.fill(); }
      c.restore();
    }
    if (el < 3300) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- explosão de partículas no acerto
export function Burst({ color }) {
  const pieces = Array.from({ length: 14 }, (_, i) => i);
  if (prefersReducedMotion()) return null;
  return (
    <div className="burst" aria-hidden="true">
      {pieces.map((i) => {
        const ang = (i / pieces.length) * Math.PI * 2;
        const dist = 90 + (i % 3) * 30;
        return (
          <motion.span
            key={i}
            className="burst-dot"
            style={{ background: i % 2 ? color : '#ffffff' }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, scale: 0, opacity: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- modal
export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="modal" role="dialog" aria-modal="true" aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="modal-head">
              <h3>{title}</h3>
              <button className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button>
            </div>
            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- contagem regressiva até uma data
export function useCountdown(iso, serverOffset = 0) {
  const target = iso ? Date.parse(iso) : null;
  const [left, setLeft] = useState(() => (target ? target - (Date.now() + serverOffset) : null));
  useEffect(() => {
    if (!target) { setLeft(null); return undefined; }
    const tick = () => setLeft(target - (Date.now() + serverOffset));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, serverOffset]);
  if (left === null) return null;
  const s = Math.max(0, Math.floor(left / 1000));
  return { done: left <= 0, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function CountdownBlocks({ cd }) {
  const seg = (v, l) => (
    <div className="cd-seg">
      <motion.span key={v} className="cd-num" initial={{ y: -8, opacity: 0.2 }} animate={{ y: 0, opacity: 1 }}>{String(v).padStart(2, '0')}</motion.span>
      <span className="cd-lbl">{l}</span>
    </div>
  );
  return (
    <div className="cd-blocks">
      {seg(cd.d, 'dias')}{seg(cd.h, 'horas')}{seg(cd.m, 'min')}{seg(cd.s, 'seg')}
    </div>
  );
}

export const formatDateBR = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------------- regulamento (gerado a partir da configuração)
export function RulesList({ config, only }) {
  const camp = config?.campaign || {};
  const ids = only ? [only] : GAME_ORDER;
  const games = config?.games || {};
  return (
    <ol className="rules">
      <li>
        {camp.endAt
          ? <>O ranking encerra em <b>{formatDateBR(camp.endAt)}</b> (horário de Brasília).</>
          : <>A data de encerramento do ranking e da premiação <b>será divulgada em breve</b> nos canais oficiais da Chumbada Oficial.</>}
      </li>
      <li>
        Ganha o brinde quem estiver no topo do ranking de cada jogo no encerramento:
        <ul className="rules-prizes">
          {ids.map((g) => games[g] && (
            <li key={g}>
              <b>{GAMES[g].title}</b> — {games[g].winners > 1 ? `os ${games[g].winners} primeiros colocados` : '1º colocado'}: {games[g].prize}
              {games[g].prizeNote ? <em> ({games[g].prizeNote})</em> : null}
            </li>
          ))}
        </ul>
      </li>
      <li>Jogue quantas vezes quiser: vale a sua <b>melhor pontuação</b>. Em caso de empate, fica na frente quem chegou primeiro àquela pontuação.</li>
      <li>Cada acerto vale <b>100 pontos</b> + <b>bônus de tempo</b> (10 pontos por segundo que sobrar). O tempo é medido pelo nosso servidor.</li>
      <li>Use <b>nome, e-mail e WhatsApp verdadeiros</b>: é por eles que entramos em contato com quem ganhar. Um cadastro por pessoa.</li>
      <li>No ranking público aparece só o seu primeiro nome e a inicial do sobrenome. Seus contatos são usados apenas para a premiação.</li>
      <li>Pontuações obtidas com programas automáticos, múltiplos cadastros ou qualquer tipo de fraude são desclassificadas.</li>
    </ol>
  );
}

// ---------------------------------------------------------------- links para os outros jogos
export function OtherGames({ current }) {
  return (
    <nav className="other-games" aria-label="Outros jogos">
      <div className="other-title">Mais desafios Chumbada</div>
      <div className="other-grid">
        {GAME_ORDER.filter((g) => g !== current).map((g) => (
          <a key={g} href={GAMES[g].url} className="other-card" style={{ '--c': GAMES[g].accent }}>
            <span className="other-dot" />
            <span>{GAMES[g].title}</span>
            <span className="other-arrow">→</span>
          </a>
        ))}
        <a href={HUB_URL} className="other-card hub" style={{ '--c': '#ffffff' }}>
          <span className="other-dot" />
          <span>Todos os rankings</span>
          <span className="other-arrow">→</span>
        </a>
      </div>
    </nav>
  );
}

export function Podium({ top, accent }) {
  if (!top.length) return null;
  return (
    <div className="podium">
      {[1, 0, 2].map((i, k) => {
        const p = top[i];
        if (!p) return <div key={k} className="podium-col empty" />;
        return (
          <motion.div
            key={p.pos + p.name}
            className={`podium-col pos-${p.pos}`}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 + k * 0.12, type: 'spring', damping: 18 }}
          >
            <div className="podium-medal">{p.pos === 1 ? '🥇' : p.pos === 2 ? '🥈' : '🥉'}</div>
            <div className="podium-name">{p.name}</div>
            <div className="podium-score" style={{ color: p.pos === 1 ? accent : undefined }}>{p.score.toLocaleString('pt-BR')}</div>
            <div className="podium-base"><span>{p.pos}º</span></div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function RankingList({ top, from = 3 }) {
  const rest = top.slice(from);
  if (!rest.length) return null;
  return (
    <ol className="rank-list">
      {rest.map((p, i) => (
        <motion.li key={p.pos + p.name} className="rank-row" initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 + i * 0.05 }}>
          <span className="rank-pos">{p.pos}º</span>
          <span className="rank-name">{p.name}<small>{p.plays} {p.plays === 1 ? 'partida' : 'partidas'}</small></span>
          <span className="rank-score">{p.score.toLocaleString('pt-BR')}</span>
        </motion.li>
      ))}
    </ol>
  );
}
