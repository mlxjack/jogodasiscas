import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';

const TOTAL_QUESTIONS = 15;
const TIME_PER_QUESTION = 10;
const OPTIONS_COUNT = 5;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function App() {
  const [lures, setLures] = useState([]);
  const [gameState, setGameState] = useState('loading'); // loading, login, playing, gameover, leaderboard
  
  // Player Data
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  
  // Game Play State
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  
  // End Game State
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  
  const timerRef = useRef(null);

  useEffect(() => {
    fetch('lures_data.json')
      .then(res => res.json())
      .then(data => {
        setLures(data);
        setGameState('login');
      })
      .catch(err => {
        console.error("Error loading lures:", err);
      });
  }, []);

  const startGame = (e) => {
    e.preventDefault();
    if (!playerName.trim() || !playerEmail.trim() || !playerPhone.trim()) return;
    
    // Pick 15 random lures for questions
    let shuffledLures = [...lures].sort(() => 0.5 - Math.random());
    let selectedLures = shuffledLures.slice(0, TOTAL_QUESTIONS);
    
    // Generate options for each question
    let generatedQuestions = selectedLures.map(correctLure => {
      let wrongLures = shuffledLures.filter(l => l.name !== correctLure.name);
      wrongLures = wrongLures.sort(() => 0.5 - Math.random()).slice(0, OPTIONS_COUNT - 1);
      
      let options = [correctLure, ...wrongLures].sort(() => 0.5 - Math.random());
      
      return {
        correct: correctLure,
        options: options
      };
    });
    
    setQuestions(generatedQuestions);
    setCurrentIndex(0);
    setScore(0);
    setIsNewRecord(false);
    setIsFirstTime(false);
    setGameState('playing');
    startTimer();
  };

  const startTimer = () => {
    setTimeLeft(TIME_PER_QUESTION);
    setIsAnswerRevealed(false);
    setSelectedOption(null);
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeOut = () => {
    setIsAnswerRevealed(true);
    setTimeout(() => {
      nextQuestion();
    }, 2000);
  };

  const handleOptionClick = (option) => {
    if (isAnswerRevealed) return;
    
    clearInterval(timerRef.current);
    setSelectedOption(option);
    setIsAnswerRevealed(true);
    
    const currentQ = questions[currentIndex];
    if (option.name === currentQ.correct.name) {
      // Calculate score: 100 base + 10 per remaining second
      setScore(prev => prev + 100 + (timeLeft * 10));
    }
    
    setTimeout(() => {
      nextQuestion();
    }, 2000);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 >= TOTAL_QUESTIONS) {
      endGame();
    } else {
      setCurrentIndex(prev => prev + 1);
      startTimer();
    }
  };

  const endGame = async () => {
    setGameState('gameover');
    await saveScore(score);
  };

  const saveScore = async (finalScore) => {
    setIsSaving(true);
    const dateStr = new Date().toISOString();
    
    if (db) {
      // Firebase Logic
      try {
        const rankingRef = collection(db, "ranking");
        const q = query(rankingRef, where("email", "==", playerEmail.toLowerCase()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // User exists
          setIsFirstTime(false);
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          
          if (finalScore > userData.score) {
            await updateDoc(doc(db, "ranking", userDoc.id), {
              score: finalScore,
              name: playerName,
              phone: playerPhone,
              date: dateStr
            });
            setIsNewRecord(true);
          } else {
            setIsNewRecord(false);
          }
        } else {
          // New User
          setIsFirstTime(true);
          setIsNewRecord(false); // We show a welcome message instead of "new record" for the first time
          await setDoc(doc(rankingRef), {
            name: playerName,
            email: playerEmail.toLowerCase(),
            phone: playerPhone,
            score: finalScore,
            date: dateStr
          });
        }
      } catch (error) {
        console.error("Erro ao salvar no Firebase: ", error);
        alert("Erro ao conectar no banco de dados. Salvando localmente como fallback.");
        fallbackSaveLocal(finalScore);
      }
    } else {
      // LocalStorage fallback se não houver Firebase configurado
      fallbackSaveLocal(finalScore);
    }
    setIsSaving(false);
  };

  const fallbackSaveLocal = (finalScore) => {
    const currentLeaderboard = JSON.parse(localStorage.getItem('chumbada_leaderboard') || '[]');
    const existingIndex = currentLeaderboard.findIndex(p => p.email.toLowerCase() === playerEmail.toLowerCase());
    
    if (existingIndex >= 0) {
      setIsFirstTime(false);
      if (finalScore > currentLeaderboard[existingIndex].score) {
        currentLeaderboard[existingIndex].score = finalScore;
        currentLeaderboard[existingIndex].name = playerName;
        currentLeaderboard[existingIndex].phone = playerPhone;
        currentLeaderboard[existingIndex].date = new Date().toISOString();
        setIsNewRecord(true);
      } else {
        setIsNewRecord(false);
      }
    } else {
      setIsFirstTime(true);
      setIsNewRecord(false);
      currentLeaderboard.push({ 
        name: playerName, 
        email: playerEmail.toLowerCase(),
        phone: playerPhone,
        score: finalScore, 
        date: new Date().toISOString() 
      });
    }
    
    currentLeaderboard.sort((a, b) => b.score - a.score);
    localStorage.setItem('chumbada_leaderboard', JSON.stringify(currentLeaderboard));
  };

  const loadLeaderboard = async () => {
    setGameState('leaderboard');
    if (db) {
      try {
        const rankingRef = collection(db, "ranking");
        const querySnapshot = await getDocs(rankingRef);
        const lbData = [];
        querySnapshot.forEach((doc) => {
          lbData.push(doc.data());
        });
        lbData.sort((a, b) => b.score - a.score);
        setLeaderboardData(lbData.slice(0, 10)); // Top 10
      } catch (error) {
        console.error("Erro ao carregar ranking do Firebase", error);
        setLeaderboardData(JSON.parse(localStorage.getItem('chumbada_leaderboard') || '[]').slice(0, 10));
      }
    } else {
      setLeaderboardData(JSON.parse(localStorage.getItem('chumbada_leaderboard') || '[]').slice(0, 10));
    }
  };

  const exportData = () => {
    const user = window.prompt("Usuário Admin:");
    if (user !== "juninho") {
      alert("Usuário incorreto.");
      return;
    }
    const pass = window.prompt("Senha:");
    if (pass !== "180385") {
      alert("Senha incorreta.");
      return;
    }

    // Admin autenticado
    let dataToExport = [];
    if (db) {
      alert("Com o Firebase ativo, o ideal é ver todos os e-mails e contatos diretamente no painel do Firebase Console (Firestore) de forma mais segura. Baixando fallback local apenas como backup...");
    }
    const localData = localStorage.getItem('chumbada_leaderboard') || '[]';
    
    const blob = new Blob([localData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chumbada_ranking_dados.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderLogin = () => (
    <div className="card">
      <img src="images/CHUMBADA-OFICIAL.png" alt="Chumbada Oficial" className="logo" />
      <h2>Desafio das Iscas</h2>
      <p style={{marginBottom: '2rem', color: '#a1a1aa', marginTop: '10px'}}>
        Mostre que você conhece o arsenal da Chumbada Oficial.
      </p>
      
      {!db && (
        <div style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.8rem'}}>
          <strong>Aviso de Configuração:</strong> O Firebase não está configurado. O ranking funcionará apenas localmente no seu computador atual.
        </div>
      )}

      <form onSubmit={startGame}>
        <div className="input-group">
          <label>Seu Nome Completo</label>
          <input 
            type="text" 
            placeholder="Ex: João da Silva" 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label>E-mail (Para contato do prêmio)</label>
          <input 
            type="email" 
            placeholder="Ex: joao@email.com" 
            value={playerEmail}
            onChange={(e) => setPlayerEmail(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label>WhatsApp / Telefone</label>
          <input 
            type="tel" 
            placeholder="(00) 00000-0000" 
            value={playerPhone}
            onChange={(e) => setPlayerPhone(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary">
          <span>Iniciar Desafio</span>
        </button>
      </form>
      <button 
        className="btn-secondary" 
        style={{marginTop: '1rem', background: 'transparent', borderColor: 'transparent', color: 'var(--orange)'}} 
        onClick={loadLeaderboard}
      >
        Ver Ranking Atual
      </button>
    </div>
  );

  const renderPlaying = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return null;
    
    return (
      <div className="card">
        <div className="game-stats">
          <div>Isca <span className="highlight">{currentIndex + 1}</span> / {TOTAL_QUESTIONS}</div>
          <div>Tempo: <span className="highlight" style={{color: timeLeft <= 3 ? '#ef4444' : 'var(--orange)'}}>{timeLeft}s</span></div>
          <div>Pontos: <span className="highlight">{score}</span></div>
        </div>
        
        <div className="lure-image-container">
          <img 
            src={`images/${currentQ.correct.image.replace('assets/images/', '')}`} 
            alt="Qual é a isca?" 
            className="lure-image" 
          />
        </div>
        
        <div className="options-grid">
          {currentQ.options.map((opt, i) => {
            let btnClass = "option-btn";
            if (isAnswerRevealed) {
              if (opt.name === currentQ.correct.name) {
                btnClass += " correct";
              } else if (selectedOption && opt.name === selectedOption.name) {
                btnClass += " wrong";
              }
            }
            
            return (
              <button 
                key={i} 
                className={btnClass}
                onClick={() => handleOptionClick(opt)}
                disabled={isAnswerRevealed}
              >
                <div className="option-letter">{OPTION_LETTERS[i]}</div>
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGameOver = () => (
    <div className="card">
      <h2>Fim de Jogo!</h2>
      <div style={{margin: '2rem 0'}}>
        <p style={{fontSize: '1.2rem', color: '#a1a1aa'}}>Sua pontuação final:</p>
        <div style={{fontSize: '4rem', color: 'var(--orange)', fontFamily: 'Montserrat', fontWeight: 900, lineHeight: 1, margin: '10px 0'}}>
          {score}
        </div>
        
        {isSaving ? (
          <div style={{color: '#a1a1aa', fontSize: '0.9rem'}}>Salvando pontuação...</div>
        ) : isFirstTime ? (
          <div style={{color: '#10b981', fontWeight: 'bold', animation: 'fadeIn 0.5s'}}>🎉 Obrigado por participar! 🎉</div>
        ) : isNewRecord ? (
          <div style={{color: '#10b981', fontWeight: 'bold', animation: 'fadeIn 0.5s'}}>🎉 Novo Recorde Pessoal! 🎉</div>
        ) : (
          <div style={{color: '#ef4444', fontSize: '0.9rem'}}>Você não superou seu recorde anterior.</div>
        )}
      </div>
      
      <button className="btn-primary" onClick={loadLeaderboard} disabled={isSaving}>
        <span>Ver Ranking</span>
      </button>
      <button className="btn-secondary" onClick={() => setGameState('login')} disabled={isSaving}>
        Jogar Novamente
      </button>
    </div>
  );

  const renderLeaderboard = () => {
    return (
      <div className="card">
        <h2>Ranking Oficial</h2>
        
        <div className="prize-notice">
          🏆 O 1º colocado no ranking oficial ganhará um Kit de Iscas da sua escolha!*
          <div style={{fontSize: '0.75rem', margin: '6px 0'}}>*De acordo com a disponibilidade em estoque.</div>
        </div>
        
        {leaderboardData.length === 0 ? (
          <p style={{color: '#71717a', margin: '2rem 0'}}>Nenhum jogador registrado ainda. Seja o primeiro!</p>
        ) : (
          <ul className="leaderboard-list">
            {leaderboardData.map((item, i) => (
              <li key={i} className="leaderboard-item">
                <span className="rank">#{i + 1}</span>
                <span className="lb-name">{item.name}</span>
                <span className="lb-score">{item.score} pts</span>
              </li>
            ))}
          </ul>
        )}
        
        <button className="btn-primary" onClick={() => setGameState('login')}>
          <span>Voltar ao Início</span>
        </button>

        {/* Admin Secret Feature */}
        <div style={{marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem'}}>
          <button 
            onClick={exportData} 
            style={{background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline'}}
          >
            Área do Admin: Exportar Dados Locais
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header>
        {gameState !== 'login' && <img src="images/CHUMBADA-OFICIAL.png" alt="Chumbada Oficial" className="logo" style={{height: '40px', cursor: 'pointer'}} onClick={() => setGameState('login')} />}
      </header>
      
      {gameState === 'loading' && <div className="card">Carregando arsenal...</div>}
      {gameState === 'login' && renderLogin()}
      {gameState === 'playing' && renderPlaying()}
      {gameState === 'gameover' && renderGameOver()}
      {gameState === 'leaderboard' && renderLeaderboard()}
    </div>
  );
}

export default App;
