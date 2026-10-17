import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, onValue, set, push, runTransaction, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHr0eemIkfHNFDUkSaFDklp_c1OgmSnl8",
  authDomain: "mybro-9ba5f.firebaseapp.com",
  databaseURL: "https://mybro-9ba5f-default-rtdb.firebaseio.com",
  projectId: "mybro-9ba5f",
  storageBucket: "mybro-9ba5f.firebasestorage.app",
  messagingSenderId: "820948893264",
  appId: "1:820948893264:web:e564509a8fdc4c56335b55"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const state = { user: null, settings: {}, products: {}, shops: {}, dataLoaded: false };
export const QRIS_IMG = "https://i.ibb.co.com/FLF6Wz07/IMG-20261012-160202.jpg";
export const DEFAULT_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%" role="img"><title>KodinganKita</title><rect x="4" y="4" width="120" height="120" rx="30" fill="#0b1220"/><circle cx="64" cy="70" r="50" fill="#4f46e5" opacity=".28"/><g transform="rotate(-5 64 66)"><path d="M48 52V42Q48 26 64 26Q80 26 80 42V52" fill="none" stroke="#a5b4fc" stroke-width="6" stroke-linecap="round"/><path d="M35 48H93L98 99Q99 106 92 106H36Q29 106 30 99Z" fill="#34d399" stroke="#34d399" stroke-width="2" stroke-linejoin="round"/><path d="M35 48H93L93.7 57H34.3Z" fill="#10b981"/><circle cx="50" cy="52.5" r="3" fill="#0b1220"/><circle cx="78" cy="52.5" r="3" fill="#0b1220"/><g fill="none" stroke="#0b1220" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M53 69L43 80L53 91"/><path d="M75 69L85 80L75 91"/><path d="M68 67L60 93"/></g></g><path transform="translate(99 33) scale(.8)" fill="#ffe14d" d="M0-12L3.5-3.5L12 0L3.5 3.5L0 12L-3.5 3.5L-12 0L-3.5-3.5Z"/></svg>`;

// --- UTILS ---
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];
export const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const rupiah = n => "Rp" + Number(n||0).toLocaleString("id-ID");

export function toast(msg, type="info") {
  const el = document.createElement("div");
  el.className = `toast`;
  if(type === 'error') el.style.background = 'var(--danger)';
  if(type === 'success') el.style.background = 'var(--success)';
  el.innerHTML = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => { el.style.opacity="0"; setTimeout(()=>el.remove(),300); }, 3000);
}

export function closeModal() { document.getElementById("modal-root").innerHTML = ""; }
export function createIframe(code, isRound = false) {
  const iframe = document.createElement("iframe");
  if (isRound) iframe.style.borderRadius = "50%";
  // PENTING: pointer-events: none agar parent <a> bisa diklik
  iframe.srcdoc = `<html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;background:transparent;pointer-events:none;}*{box-sizing:border-box;}</style></head><body>${code}</body></html>`;
  return iframe;
}

// --- LOGIKA PRODUK (FIX BUG) ---
export function checkAvailability(p) {
  if (p.status === 'sold' || p.availability === 'sold') return false;
  if (p.status === 'reserved' && p.reservedUntil && p.reservedUntil > Date.now()) return false;
  return true;
}

// --- AUTHENTICATION ---
export async function handleAuth() {
  if (state.user) {
    if(confirm("Keluar dari akun?")) await signOut(auth);
  } else {
    try { await signInWithPopup(auth, provider); } 
    catch(e) { toast("Gagal login: " + e.message, "error"); }
  }
}
window.handleAuth = handleAuth; // Ekspos ke global

onAuthStateChanged(auth, async user => {
  state.user = user;
  const btn = $("#authBtn");
  if(btn) {
    if(user) {
      btn.innerHTML = `<img src="${user.photoURL}" style="width:18px;height:18px;border-radius:50%"> <span>${user.displayName.split(' ')[0]}</span>`;
      const userRef = ref(db, `users/${user.uid}`);
      if(!(await get(userRef)).exists()) {
        await set(userRef, { displayName: user.displayName, email: user.email, photoURL: user.photoURL, createdAt: serverTimestamp() });
      }
    } else {
      btn.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"> <span>Masuk</span>`;
    }
  }
  if(state.dataLoaded) renderNav();
});

// --- INIT DATA & SPLASH SCREEN ---
let settingsLoaded = false, productsLoaded = false, shopsLoaded = false;

function checkAllLoaded() {
  if(settingsLoaded && productsLoaded && shopsLoaded) {
    state.dataLoaded = true;
    if(typeof window.onDataReady === 'function') window.onDataReady();
    // Sembunyikan splash screen
    const splash = $("#splash-screen");
    if(splash) {
      setTimeout(() => {
        splash.classList.add("hidden");
        setTimeout(() => splash.remove(), 500); // Hapus dari DOM
      }, 800); // Delay sedikit agar transisi mulus
    }
  }
}

onValue(ref(db, "settings/marketplace"), snap => {
  state.settings = snap.val() || {};
  applySplashSettings(); // Perbarui splash screen jika admin mengubahnya
  settingsLoaded = true; checkAllLoaded();
});
onValue(ref(db, "products"), snap => { state.products = snap.val() || {}; productsLoaded = true; checkAllLoaded(); });
onValue(ref(db, "shops"), snap => { state.shops = snap.val() || {}; shopsLoaded = true; checkAllLoaded(); });

// --- LOGIKA SPLASH SCREEN DARI ADMIN ---
export function applySplashSettings() {
  const splash = $("#splash-screen");
  if(!splash) return;
  const loadingConf = state.settings.loadingScreen || {};
  
  if(loadingConf.type === 'image' && loadingConf.value) {
    splash.innerHTML = `<img src="${loadingConf.value}" class="splash-custom"><div class="loading-bar"><div class="loading-bar-inner"></div></div>`;
  } else if(loadingConf.type === 'html' && loadingConf.value) {
    splash.innerHTML = loadingConf.value;
  } else {
    // Default (Logo SVG)
    splash.innerHTML = `<div style="width:100px;height:100px;">${DEFAULT_LOGO}</div><div class="loading-bar"><div class="loading-bar-inner"></div></div>`;
  }
}

// --- NAVIGASI BAWAH (RENDER DINAMIS) ---
export function renderNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  const s = state.settings;
  
  const defaultMenus = [
    { id: "home", label: "Beranda", href: "index.html", code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>` },
    { id: "catalog", label: "Katalog", href: "katalog.html", code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>` },
    { id: "history", label: "Riwayat", href: "riwayat.html", code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 01-8 0"></path></svg>` },
    { id: "profile", label: "Profil", href: "profil.html", code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>` }
  ];

  const navs = (s.bottomMenus && s.bottomMenus.length > 0) ? s.bottomMenus : defaultMenus;
  const navContainer = $("#bottomNav");
  if(!navContainer) return;
  
  navContainer.innerHTML = navs.map(n => {
    const isActive = path === n.href || (path === '' && n.href === 'index.html');
    return `
      <a href="${n.href}" class="nav-item ${isActive ? 'active' : ''}">
        <div class="icon-wrap" id="nav-icon-${n.id}">${n.code || ''}</div>
        <span>${n.label}</span>
      </a>
    `;
  }).join("");

  // Jika kode berupa iframe, ganti
  navs.forEach(n => {
    if(n.code && n.code.includes('<iframe') || (n.code && n.code.includes('<style>'))) {
       // Cek apakah admin memberikan kode mentah yg butuh iframe
       const wrap = $(`#nav-icon-${n.id}`);
       if(wrap) { wrap.innerHTML = ""; wrap.appendChild(createIframe(n.code, false)); }
    }
  });
}

// PANGGIL RENDER NAV SAAT DOM SIAP
document.addEventListener("DOMContentLoaded", () => {
  applySplashSettings();
  if(state.dataLoaded) renderNav();
});
