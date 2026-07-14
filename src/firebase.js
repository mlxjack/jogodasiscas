// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Adicione as chaves do seu projeto Firebase aqui
// Vá em console.firebase.google.com -> Configurações do Projeto -> Seus Aplicativos (Web)
const firebaseConfig = {
  apiKey: "AIzaSyDZZgm_eNnQPFSqCRvQo0AW2dCDyIDbeBE",
  authDomain: "jogo-das-iscas.firebaseapp.com",
  projectId: "jogo-das-iscas",
  storageBucket: "jogo-das-iscas.firebasestorage.app",
  messagingSenderId: "469375054365",
  appId: "1:469375054365:web:d77fe77c620cf0fdb3ccf4"
};

// Se apiKey for a de mock, não inicializa para evitar erros
let db = null;

try {
  if (firebaseConfig.apiKey !== "COLE_SUA_API_KEY_AQUI") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
}

export { db };
