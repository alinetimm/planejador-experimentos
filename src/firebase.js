// Inicialização do Firebase — fonte única de db / auth / storage.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDMRKdyGGhstaDQSerf5yFYVWFEsFZ1LDw",
  authDomain: "hydrone-6ca76.firebaseapp.com",
  projectId: "hydrone-6ca76",
  storageBucket: "hydrone-6ca76.firebasestorage.app",
  messagingSenderId: "672435053760",
  appId: "1:672435053760:web:deefb7682ff1d670edf925",
  measurementId: "G-PFMDZ3GHXS",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Analytics é opcional e quebra em ambientes sem suporte (SSR, alguns navegadores).
// Carrega só quando suportado, sem travar o resto do app.
isSupported().then((ok) => { if (ok) getAnalytics(app); }).catch(() => {});

export { app, db, auth, storage };