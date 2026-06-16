import { db, auth, storage } from "./firebase";
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";


export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) await ensureProfile(user);
    callback(user || null);
  });
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  const { user } = await signInWithPopup(auth, provider);
  await ensureProfile(user);
  return user;
}

export function signOutUser() { return signOut(auth); }

export function currentUid() { return auth.currentUser?.uid || null; }

// Checagem confiável de admin: lê a custom claim do token decodificado.
// Chame uma vez após o login e guarde o booleano no estado do app.
// (Logo após conceder o claim, peça à pessoa para sair e entrar para o token recarregar.)
export async function isAdminAsync() {
  const u = auth.currentUser;
  if (!u) return false;
  const t = await u.getIdTokenResult();
  return t.claims.admin === true;
}

// (Opcional) Magic link por e-mail. Requer habilitar "Email link" no console
// e configurar o domínio. Deixe Google sign-in como caminho principal.
export async function sendMagicLink(email) {
  const actionCodeSettings = { url: window.location.origin + "/finishSignIn", handleCodeInApp: true };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem("emailForSignIn", email);
}
export async function completeMagicLinkIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  let email = window.localStorage.getItem("emailForSignIn");
  if (!email) email = window.prompt("Confirme seu e-mail para entrar:");
  const { user } = await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem("emailForSignIn");
  await ensureProfile(user);
  return user;
}

// ──────────────────────── PERFIS ────────────────────────

async function ensureProfile(user) {
  const refp = doc(db, "profiles", user.uid);
  const snap = await getDoc(refp);
  const base = {
    uid: user.uid,
    name: user.displayName || (user.email ? user.email.split("@")[0] : "Sem nome"),
    email: user.email || "",
    photoURL: user.photoURL || "",
  };
  if (!snap.exists()) {
    // role só é definida na criação; NUNCA pelo cliente depois (regras bloqueiam).
    await setDoc(refp, { ...base, role: "member", createdAt: serverTimestamp() });
  } else {
    // Mantém nome/email/foto atualizados, sem tocar em role.
    await updateDoc(refp, base);
  }
}

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? snap.data() : null;
}

export async function listProfiles() {
  const qs = await getDocs(query(collection(db, "profiles"), orderBy("name")));
  return qs.docs.map((d) => d.data());
}

// ────────────────────── EXPERIMENTOS ──────────────────────

const expCol = () => collection(db, "experiments");

// Lista resumida para a tabela compartilhada (todos os usuários autenticados leem tudo).
function expSummary(d) {
  const x = d.data();
  return {
    id: d.id, title: x.title, modo: x.modo, kind: x.kind,
    ownerId: x.ownerId, ownerName: x.ownerName, editors: x.editors || [],
    createdAt: x.createdAt, updatedAt: x.updatedAt,
  };
}

export async function listExperiments() {
  const qs = await getDocs(query(expCol(), orderBy("updatedAt", "desc")));
  return qs.docs.map(expSummary);
}

// Versão em tempo real (a lista se atualiza sozinha quando alguém salva).
export function watchExperiments(callback) {
  return onSnapshot(query(expCol(), orderBy("updatedAt", "desc")),
    (qs) => callback(qs.docs.map(expSummary)));
}

// Carrega o experimento completo e devolve o bundle já parseado.
export async function getExperiment(id) {
  const snap = await getDoc(doc(db, "experiments", id));
  if (!snap.exists()) return null;
  const x = snap.data();
  let bundle = null;
  try { bundle = x.bundleJson ? JSON.parse(x.bundleJson) : null; } catch { bundle = null; }
  return { id: snap.id, ...x, bundle };
}

// Cria (sem id) ou atualiza (com id). `bundle` é o objeto de estado do app.
// title/modo/kind ficam no topo do doc para alimentar a lista sem baixar o bundle inteiro.
export async function saveExperiment({ id, title, modo, kind, bundle }) {
  const bundleJson = JSON.stringify(bundle ?? {});
  if (id) {
    await updateDoc(doc(db, "experiments", id), {
      title, modo, kind, bundleJson, updatedAt: serverTimestamp(),
    });
    return id;
  }
  const u = auth.currentUser;
  const profile = u ? await getProfile(u.uid) : null;
  const refd = await addDoc(expCol(), {
    ownerId: u.uid,
    ownerName: profile?.name || u.displayName || "Sem nome",
    title, modo, kind, bundleJson,
    editors: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return refd.id;
}

export function deleteExperiment(id) { return deleteDoc(doc(db, "experiments", id)); }

// Conceder / revogar permissão de edição a outro usuário (só owner/admin pelas regras).
export function grantEditor(expId, uid) {
  return updateDoc(doc(db, "experiments", expId), { editors: arrayUnion(uid) });
}
export function revokeEditor(expId, uid) {
  return updateDoc(doc(db, "experiments", expId), { editors: arrayRemove(uid) });
}

// Helper de UI: a pessoa pode editar este experimento?
export function canEdit(exp, uid, admin) {
  if (!uid) return false;
  if (admin) return true;
  return exp.ownerId === uid || (exp.editors || []).includes(uid);
}

// ──────────────────────── ANEXOS ────────────────────────
// Fotos e logs ligados a um experimento (e, opcionalmente, a um item de checklist via itemId).
// Caminho no Storage: attachments/{uid}/{expId}/{timestamp}-{arquivo}
// As regras de Storage só permitem escrever dentro do próprio uid; a permissão de
// "editor do experimento" é validada na criação do doc de metadados (regras de Firestore).

function inferKind(file) {
  const n = (file.name || "").toLowerCase();
  if (file.type?.startsWith("image/")) return "photo";
  if (n.endsWith(".bin") || n.endsWith(".tlog") || n.endsWith(".log")) return "log";
  return "outro";
}

export async function uploadAttachment(expId, file, { itemId = null } = {}) {
  const u = auth.currentUser;
  if (!u) throw new Error("Não autenticado.");
  const kind = inferKind(file);
  const safe = (file.name || "arquivo").replace(/[^\w.\-]+/g, "_");
  const path = `attachments/${u.uid}/${expId}/${Date.now()}-${safe}`;
  const sref = ref(storage, path);
  await uploadBytes(sref, file, { contentType: file.type || "application/octet-stream" });
  const url = await getDownloadURL(sref);
  const refd = await addDoc(collection(db, "experiments", expId, "attachments"), {
    type: file.type?.startsWith("image/") ? "photo" : "file",
    kind, itemId,
    fileName: file.name || safe,
    contentType: file.type || "application/octet-stream",
    size: file.size || 0,
    storagePath: path,
    url,
    uploadedBy: u.uid,
    createdAt: serverTimestamp(),
  });
  return { id: refd.id, kind, fileName: file.name, url, storagePath: path };
}

export async function listAttachments(expId) {
  const qs = await getDocs(query(
    collection(db, "experiments", expId, "attachments"), orderBy("createdAt", "asc")));
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchAttachments(expId, callback) {
  return onSnapshot(query(
    collection(db, "experiments", expId, "attachments"), orderBy("createdAt", "asc")),
    (qs) => callback(qs.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function deleteAttachment(expId, att) {
  if (att.storagePath) {
    try { await deleteObject(ref(storage, att.storagePath)); } catch { /* arquivo já removido */ }
  }
  await deleteDoc(doc(db, "experiments", expId, "attachments", att.id));
}