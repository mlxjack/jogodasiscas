import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from './api.js';
import { GAMES } from './games.js';
import { sfx } from './sound.js';
import {
  AnimatedNumber, Burst, CountdownBlocks, Modal, Ocean, OtherGames, Podium, RankingList, RulesList, TimerRing,
  fireConfetti, prefersReducedMotion, useCountdown,
} from './ui.jsx';
import './engine.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PLAYER_KEY = 'chumbada_jogador';

const loadPlayer = () => {
  try { return JSON.parse(localStorage.getItem(PLAYER_KEY)) || null; } catch { return null; }
};
const savePlayer = (p) => {
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(p)); } catch { /* ok */ }
};
const maskPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const screenAnim = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 24, stiffness: 220 } },
  exit: { opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.18 } },
};

function preload(urls, onProgress) {
  let done = 0;
  return Promise.all(urls.map((u) => new Promise((resolve) => {
    const img = new Image();
    const fin = () => { done += 1; onProgress(done / urls.length); resolve(); };
    const t = setTimeout(fin, 8000);
    img.onload = img.onerror = () => { clearTimeout(t); fin(); };
    img.src = u;
  })));
}

export default function GameApp({ gameId, logo }) {
  const game = GAMES[gameId];
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [serverOffset, setServerOffset] = useState(0);
  const [screen, setScreen] = useState('home'); // home | loading | countdown | playing | result | ranking
  const [player, setPlayer] = useState(() => loadPlayer());
  const [editing, setEditing] = useState(() => !loadPlayer());
  const [form, setForm] = useState(() => ({ name: '', email: '', phone: '', consent: false, ...(loadPlayer() || {}) }));
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());

  // partida
  const [session, setSession] = useState(null);
  const [loadPct, setLoadPct] = useState(0);
  const [count, setCount] = useState(3);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState('ask'); // ask | wait | reveal
  const [picked, setPicked] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hits, setHits] = useState(0);
  const [pops, setPops] = useState([]);
  const [timeLeft, setTimeLeft] = useState(10);
  const [final, setFinal] = useState(null);
  const [playError, setPlayError] = useState('');

  // ranking
  const [ranking, setRanking] = useState(null);

  const deadlineRef = useRef(0);
  const lockRef = useRef(false);
  const timersRef = useRef([]);
  const lastTickRef = useRef(99);
  const reduced = useMemo(() => prefersReducedMotion(), []);

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); return id; };
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  useEffect(() => () => clearTimers(), []);

  // tema do jogo nas variáveis CSS
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--accent', game.accent);
    r.setProperty('--accent2', game.accent2);
    r.setProperty('--glow', game.glow);
  }, [game]);

  const loadConfig = useCallback(() => {
    setConfigError('');
    api('/api/config', { retries: 2 })
      .then((c) => { setConfig(c); setServerOffset(c.serverNow - Date.now()); })
      .catch((e) => setConfigError(e.message));
  }, []);
  useEffect(loadConfig, [loadConfig]);

  const gcfg = config?.games?.[gameId];
  const status = gcfg?.status || 'open';
  const cd = useCountdown(config?.campaign?.endAt, serverOffset);

  const loadRanking = useCallback(() => {
    api(`/api/ranking?game=${gameId}&limit=20`).then(setRanking).catch(() => setRanking((r) => r || { top: [], players: 0 }));
  }, [gameId]);
  useEffect(loadRanking, [loadRanking]);

  // ------------------------------------------------------------ início
  async function start(e) {
    e?.preventDefault();
    sfx.unlock();
    setFormError('');
    const p = editing ? form : { ...player, consent: form.consent || player?.consent };
    if (editing) {
      if (p.name.trim().split(/\s+/).length < 2) return setFormError('Digite nome e sobrenome.');
      if (!/^\S+@\S+\.\S+$/.test(p.email)) return setFormError('Digite um e-mail válido.');
      if (p.phone.replace(/\D/g, '').length < 10) return setFormError('Digite seu WhatsApp com DDD.');
    }
    if (!p.consent) return setFormError('Marque que você leu e aceita o regulamento.');
    setBusy(true);
    try {
      const s = await api('/api/play/start', {
        method: 'POST',
        body: { game: gameId, name: p.name.trim(), email: p.email.trim(), phone: p.phone, consent: true },
      });
      const saved = { name: p.name.trim(), email: p.email.trim(), phone: p.phone, consent: true };
      savePlayer(saved); setPlayer(saved); setForm(saved); setEditing(false);
      clearTimers();
      setSession(s); setQi(0); setScore(0); setStreak(0); setHits(0); setFinal(null); setReveal(null); setPicked(null);
      setPlayError(''); setPops([]); setLoadPct(0);
      setScreen('loading');
      await preload(s.questions.map((q) => q.image), setLoadPct);
      runCountdown(s);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function runCountdown(s) {
    setScreen('countdown');
    setCount(3); sfx.count();
    later(() => { setCount(2); sfx.count(); }, 800);
    later(() => { setCount(1); sfx.count(); }, 1600);
    later(async () => {
      setCount(0); sfx.go();
      try {
        await api('/api/play/begin', { method: 'POST', body: { id: s.id }, retries: 2 });
        showQuestion(0, s);
      } catch (err) {
        setPlayError(err.message);
      }
    }, 2400);
  }

  function showQuestion(i, s = session) {
    setQi(i); setPhase('ask'); setPicked(null); setReveal(null); setPops([]);
    setScreen('playing');
    lockRef.current = false;
    lastTickRef.current = 99;
    deadlineRef.current = performance.now() + s.seconds * 1000;
    setTimeLeft(s.seconds);
  }

  // relógio da pergunta
  useEffect(() => {
    if (screen !== 'playing' || phase !== 'ask' || !session) return undefined;
    let raf = 0;
    const loop = () => {
      const left = Math.max(0, (deadlineRef.current - performance.now()) / 1000);
      setTimeLeft(left);
      const whole = Math.ceil(left);
      if (whole <= 3 && whole > 0 && whole < lastTickRef.current) { lastTickRef.current = whole; sfx.tick(); }
      if (left <= 0) { answer(-1); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, phase, qi, session]);

  // atalhos de teclado: A–F ou 1–6
  useEffect(() => {
    if (screen !== 'playing') return undefined;
    const onKey = (e) => {
      if (phase !== 'ask' || !session) return;
      const k = e.key.toUpperCase();
      let idx = LETTERS.indexOf(k);
      if (idx < 0 && /^[1-6]$/.test(k)) idx = Number(k) - 1;
      if (idx >= 0 && idx < session.questions[qi].options.length) answer(idx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function answer(choice) {
    if (lockRef.current || !session) return;
    lockRef.current = true;
    setPicked(choice);
    setPhase('wait');
    const sent = performance.now();
    let res;
    try {
      res = await api('/api/play/answer', { method: 'POST', body: { id: session.id, index: qi, choice }, retries: 2 });
    } catch (err) {
      if (err.status === 409 && err.data?.expected !== undefined && err.data.expected > qi) {
        // a resposta chegou ao servidor mas a confirmação se perdeu: segue em frente
        res = { ok: false, correctIndex: -1, points: 0, bonus: 0, base: 0, score, timedOut: false };
      } else {
        setPlayError(err.message);
        return;
      }
    }
    const rtt = performance.now() - sent;
    setReveal(res);
    setPhase('reveal');
    setScore(res.score);
    if (res.ok) {
      sfx.correct();
      setHits((h) => h + 1);
      setStreak((s) => s + 1);
      const p = [{ id: `b${qi}`, text: `+${res.base}`, kind: 'base' }];
      setPops(p);
      if (res.bonus > 0) later(() => { sfx.bonus(); setPops([...p, { id: `t${qi}`, text: `+${res.bonus} bônus de tempo`, kind: 'bonus' }]); }, 380);
    } else {
      if (choice === -1) sfx.timeout(); else sfx.wrong();
      setStreak(0);
      if (navigator.vibrate && choice !== -1) navigator.vibrate(120);
    }
    if (res.final) {
      later(() => finish(res.final), 1500);
    } else {
      // o servidor começa a contar a próxima pergunta revealMs depois de responder
      later(() => showQuestion(qi + 1), Math.max(600, session.revealMs - rtt / 2));
    }
  }

  function finish(f) {
    setFinal(f);
    setScreen('result');
    loadRanking();
    if (f.isNewRecord || f.isFirstTime || f.rank <= 3) {
      later(() => { sfx.fanfare(); fireConfetti([game.accent, game.accent2, '#ffffff', '#34d399']); }, 700);
    }
  }

  function toggleSound() {
    const v = !muted;
    sfx.setMuted(v); setMuted(v);
    if (!v) sfx.click();
  }

  async function share() {
    const text = `Fiz ${score.toLocaleString('pt-BR')} pontos no ${game.title} da Chumbada Oficial! Duvido você me passar 🎣`;
    const url = game.url;
    try {
      if (navigator.share) await navigator.share({ title: game.title, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setPops([{ id: 'copied', text: 'Link copiado!', kind: 'bonus' }]);
      }
    } catch { /* cancelado */ }
  }

  const goHome = () => { clearTimers(); setScreen('home'); loadRanking(); };

  // ------------------------------------------------------------ telas
  const q = session?.questions?.[qi];
  const total = session?.questions?.length || gcfg?.questions || 0;

  const statusBanner = status !== 'open' && (
    <div className={`status-banner ${status}`}>
      {status === 'soon' ? '⏳ Este jogo abre em breve. Fique de olho nas nossas redes!' : '🏁 Competição encerrada! Confira o ranking final.'}
    </div>
  );

  const prizeCard = gcfg && (
    <motion.div className="prize-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <div className="prize-trophy" aria-hidden="true">🏆</div>
      <div className="prize-info">
        <div className="prize-label">{gcfg.winners > 1 ? `Prêmio para os ${gcfg.winners} primeiros` : 'Prêmio para o 1º lugar'}</div>
        <div className="prize-name">{gcfg.prize}</div>
        {gcfg.prizeNote && <div className="prize-note">{gcfg.prizeNote}</div>}
      </div>
      <div className="prize-when">
        {cd && !cd.done ? (<><div className="prize-label">Ranking encerra em</div><CountdownBlocks cd={cd} /></>)
          : cd && cd.done ? <div className="prize-date">Ranking encerrado</div>
            : <div className="prize-date"><span className="pulse-dot" />{config.campaign.prizeDateText}</div>}
      </div>
    </motion.div>
  );

  const renderHome = () => (
    <motion.section key="home" className="screen home" {...screenAnim}>
      <div className="home-hero">
        <motion.img src={logo} alt="Chumbada Oficial" className="hero-logo" initial={{ y: -30, opacity: 0, rotate: -6 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12 }} />
        <motion.div className="hero-kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          {config?.campaign?.title || 'Desafio Chumbada Oficial'}
        </motion.div>
        <h1 className="hero-title">
          {game.title.split(' ').map((w, i) => (
            <motion.span key={i} className={i === game.title.split(' ').length - 1 ? 'accent' : ''} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 + i * 0.08, type: 'spring', damping: 14 }}>
              {w}{' '}
            </motion.span>
          ))}
        </h1>
        <motion.p className="hero-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>{game.tagline}</motion.p>
        {gcfg && (
          <motion.div className="hero-chips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
            <span className="chip">{gcfg.questions} {game.items}</span>
            <span className="chip">{gcfg.seconds}s por resposta</span>
            <span className="chip">{ranking?.players ? `${ranking.players} ${ranking.players === 1 ? 'jogador' : 'jogadores'}` : 'Seja o primeiro!'}</span>
          </motion.div>
        )}
      </div>

      {config?.campaign?.announcement && <div className="announcement">📣 {config.campaign.announcement}</div>}
      {statusBanner}
      {prizeCard}

      {status === 'open' && (
        <motion.div className="card form-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          {!editing && player ? (
            <div className="player-row">
              <div className="player-avatar">{player.name.charAt(0).toUpperCase()}</div>
              <div className="player-info">
                <div className="player-hello">Jogando como</div>
                <div className="player-name">{player.name}</div>
              </div>
              <button type="button" className="link-btn" onClick={() => setEditing(true)}>Trocar</button>
            </div>
          ) : (
            <form className="player-form" onSubmit={start} noValidate>
              <label className="field">
                <span>Nome e sobrenome</span>
                <input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: João da Silva" maxLength={60} />
              </label>
              <label className="field">
                <span>E-mail</span>
                <input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" maxLength={120} />
              </label>
              <label className="field">
                <span>WhatsApp</span>
                <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" />
              </label>
            </form>
          )}
          {(editing || !player?.consent) && (
            <label className="consent">
              <input type="checkbox" checked={!!form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              <span>Li e aceito o <button type="button" className="link-btn inline" onClick={() => setRulesOpen(true)}>regulamento</button> e autorizo o contato da Chumbada Oficial sobre a premiação.</span>
            </label>
          )}
          <AnimatePresence>{formError && <motion.div className="form-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{formError}</motion.div>}</AnimatePresence>
          <button className="btn-primary big" onClick={start} disabled={busy}>
            <span>{busy ? 'Preparando…' : 'Começar desafio'}</span>
            {!busy && <span className="btn-arrow">→</span>}
          </button>
          {session === null && gcfg && ranking?.top?.length > 0 && (
            <div className="mini-record">Recorde atual: <b>{ranking.top[0].score.toLocaleString('pt-BR')}</b> pts — {ranking.top[0].name}</div>
          )}
        </motion.div>
      )}

      <div className="home-actions">
        <button className="btn-ghost" onClick={() => { setScreen('ranking'); loadRanking(); }}>🏆 Ver ranking</button>
        <button className="btn-ghost" onClick={() => setRulesOpen(true)}>📜 Regulamento</button>
      </div>
      <OtherGames current={gameId} />
    </motion.section>
  );

  const renderLoading = () => (
    <motion.section key="loading" className="screen center" {...screenAnim}>
      <div className="loader-hook" aria-hidden="true">🎣</div>
      <div className="loader-text">Preparando as {game.items}…</div>
      <div className="loader-bar"><motion.div className="loader-fill" animate={{ width: `${Math.round(loadPct * 100)}%` }} /></div>
    </motion.section>
  );

  const renderCountdown = () => (
    <motion.section key="countdown" className="screen center" {...screenAnim}>
      {playError ? (
        <div className="card error-card">
          <p>{playError}</p>
          <button className="btn-primary" onClick={goHome}>Voltar</button>
        </div>
      ) : (
        <>
          <div className="count-hint">Prepare-se!</div>
          <div className="count-stack">
            <AnimatePresence>
              <motion.div key={count} className="count-num" initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.15 } }} transition={{ type: 'spring', damping: 12, stiffness: 200 }}>
                {count > 0 ? count : 'Vai!'}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="count-tip">Dica: responda rápido — cada segundo que sobra vale 10 pontos.</div>
        </>
      )}
    </motion.section>
  );

  const renderPlaying = () => {
    if (!q) return null;
    const correctIdx = reveal?.correctIndex;
    return (
      <motion.section key="playing" className="screen playing" {...screenAnim}>
        <div className="hud">
          <div className="hud-left">
            <div className="hud-label">{game.item.charAt(0).toUpperCase() + game.item.slice(1)}</div>
            <div className="hud-value">{qi + 1}<small>/{total}</small></div>
          </div>
          <TimerRing total={session.seconds} left={phase === 'ask' ? timeLeft : Math.max(0, timeLeft)} />
          <div className="hud-right">
            <div className="hud-label">Pontos</div>
            <div className="hud-value score"><AnimatedNumber value={score} /></div>
          </div>
        </div>
        <div className="progress-dots" aria-hidden="true">
          {session.questions.map((_, i) => <span key={i} className={i < qi ? 'done' : i === qi ? 'now' : ''} />)}
        </div>

        <div className="play-grid">
          <div className="question-side">
            <AnimatePresence mode="wait">
              <motion.div
                key={qi}
                className={`image-card ${phase === 'reveal' ? (reveal?.ok ? 'is-ok' : 'is-bad') : ''}`}
                initial={reduced ? { opacity: 0 } : { opacity: 0, rotateY: -70, scale: 0.85 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, rotateY: 0, scale: 1, x: phase === 'reveal' && !reveal?.ok && picked !== -1 ? [0, -12, 12, -8, 8, 0] : 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, rotateY: 70, scale: 0.85 }}
                transition={{ type: 'spring', damping: 18, stiffness: 160 }}
              >
                <img src={q.image} alt={game.question} draggable="false" />
                {phase === 'reveal' && reveal?.ok && <Burst color={game.accent} />}
                <AnimatePresence>
                  {pops.map((p, i) => (
                    <motion.div key={p.id} className={`pop pop-${p.kind}`} style={{ top: `${38 + i * 16}%` }}
                      initial={{ y: 20, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      transition={{ type: 'spring', damping: 11, stiffness: 260 }}>
                      {p.text}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {phase === 'reveal' && reveal?.timedOut && <div className="stamp">Tempo esgotado!</div>}
              </motion.div>
            </AnimatePresence>
            <AnimatePresence>
              {streak >= 3 && phase === 'reveal' && reveal?.ok && (
                <motion.div className="streak" initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }}>
                  🔥 {streak} seguidas!
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="answer-side">
            <h2 className="question-title">{game.question}</h2>
            <div className="options" key={qi}>
              {q.options.map((opt, i) => {
                let cls = 'option';
                if (phase === 'wait' && picked === i) cls += ' pending';
                if (phase === 'reveal') {
                  if (i === correctIdx) cls += ' correct';
                  else if (i === picked) cls += ' wrong';
                  else cls += ' dim';
                }
                return (
                  <motion.button
                    key={i} className={cls} onClick={() => answer(i)} disabled={phase !== 'ask'}
                    initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.06, type: 'spring', damping: 20 }}
                    whileTap={phase === 'ask' ? { scale: 0.97 } : undefined}
                  >
                    <span className="opt-letter">{LETTERS[i]}</span>
                    <span className="opt-text">{opt}</span>
                    {phase === 'reveal' && i === correctIdx && <span className="opt-mark">✓</span>}
                    {phase === 'reveal' && i === picked && i !== correctIdx && <span className="opt-mark">✕</span>}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
        {playError && (
          <div className="card error-card">
            <p>{playError}</p>
            <button className="btn-primary" onClick={goHome}>Voltar ao início</button>
          </div>
        )}
      </motion.section>
    );
  };

  const renderResult = () => {
    const f = final;
    const msg = f.isFirstTime ? { t: 'Bem-vindo ao ranking!', c: 'good' }
      : f.isNewRecord ? { t: 'Novo recorde pessoal!', c: 'good' }
        : { t: `Seu recorde continua ${f.bestScore.toLocaleString('pt-BR')} pts. Bora bater?`, c: 'meh' };
    const pct = Math.round((hits / total) * 100);
    return (
      <motion.section key="result" className="screen result" {...screenAnim}>
        <div className="card result-card">
          <div className="result-kicker">Fim de jogo</div>
          <div className="result-score"><AnimatedNumber value={f.score} duration={1400} /></div>
          <div className="result-unit">pontos</div>
          <motion.div className={`result-msg ${msg.c}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2 }}>{msg.t}</motion.div>
          <div className="result-stats">
            <div><b>{hits}/{total}</b><span>acertos</span></div>
            <div><b>{pct}%</b><span>precisão</span></div>
            <div><b>{f.rank}º</b><span>de {f.totalPlayers}</span></div>
          </div>
          {f.rank <= (gcfg?.winners || 1) && (
            <motion.div className="result-lead" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}>
              🏆 Você está na zona de premiação! Segure a posição até o encerramento.
            </motion.div>
          )}
          <div className="result-buttons">
            <button className="btn-primary big" onClick={() => start()}><span>Jogar de novo</span><span className="btn-arrow">↻</span></button>
            <div className="row">
              <button className="btn-ghost" onClick={() => setScreen('ranking')}>🏆 Ranking</button>
              <button className="btn-ghost" onClick={share}>📣 Desafiar amigos</button>
            </div>
          </div>
          {pops.some((p) => p.id === 'copied') && <div className="mini-record">Link copiado para a área de transferência!</div>}
        </div>
        <OtherGames current={gameId} />
      </motion.section>
    );
  };

  const renderRanking = () => (
    <motion.section key="ranking" className="screen ranking" {...screenAnim}>
      <div className="card ranking-card">
        <div className="ranking-head">
          <h2>{status === 'closed' ? 'Ranking final' : 'Ranking ao vivo'}</h2>
          <span className={`live ${status === 'closed' ? 'off' : ''}`}>{status === 'closed' ? 'encerrado' : 'ao vivo'}</span>
        </div>
        {gcfg && <div className="ranking-prize">🏆 {gcfg.winners > 1 ? `Top ${gcfg.winners}` : '1º lugar'} ganha: <b>{gcfg.prize}</b></div>}
        {!ranking ? <div className="spinner" /> : ranking.top.length === 0 ? (
          <div className="empty">Ninguém pontuou ainda. O topo está esperando por você!</div>
        ) : (
          <>
            <Podium top={ranking.top} accent={game.accent} />
            <RankingList top={ranking.top} />
            <div className="ranking-foot">{ranking.players} {ranking.players === 1 ? 'jogador' : 'jogadores'} · {ranking.plays} {ranking.plays === 1 ? 'partida' : 'partidas'}</div>
          </>
        )}
        <button className="btn-primary" onClick={goHome}><span>{status === 'open' ? 'Jogar' : 'Voltar'}</span></button>
      </div>
      <OtherGames current={gameId} />
    </motion.section>
  );

  return (
    <div className={`game-root game-${gameId}`}>
      <Ocean glow={game.glow} />
      <header className="topbar">
        <button className="brand" onClick={screen === 'playing' || screen === 'countdown' ? undefined : goHome} aria-label="Início">
          <img src={logo} alt="" />
          <span>Chumbada <b>Games</b></span>
        </button>
        <button className="icon-btn" onClick={toggleSound} aria-label={muted ? 'Ligar som' : 'Desligar som'} title={muted ? 'Ligar som' : 'Desligar som'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      <main className="stage">
        {!config && !configError && <div className="spinner big" />}
        {configError && (
          <div className="card error-card">
            <p>{configError}</p>
            <button className="btn-primary" onClick={loadConfig}>Tentar de novo</button>
          </div>
        )}
        {config && (
          <AnimatePresence mode="wait">
            {screen === 'home' && renderHome()}
            {screen === 'loading' && renderLoading()}
            {screen === 'countdown' && renderCountdown()}
            {screen === 'playing' && renderPlaying()}
            {screen === 'result' && final && renderResult()}
            {screen === 'ranking' && renderRanking()}
          </AnimatePresence>
        )}
      </main>

      <footer className="foot">© {new Date().getFullYear()} Chumbada Oficial · <button className="link-btn inline" onClick={() => setRulesOpen(true)}>Regulamento</button></footer>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Regulamento">
        <RulesList config={config} only={gameId} />
      </Modal>
    </div>
  );
}
