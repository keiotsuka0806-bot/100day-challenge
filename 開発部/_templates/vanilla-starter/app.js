// Firebase設定 — Firebaseコンソールから取得してここに貼る
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// --- 状態 ---
let currentUser = null;

// --- 認証 ---
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    showScreen('main');
    document.getElementById('userAvatar').src = user.photoURL || '';
    onUserLoggedIn(user);
  } else {
    showScreen('login');
  }
});

document.getElementById('loginBtn').addEventListener('click', () => {
  auth.signInWithPopup(provider).catch(err => console.error(err));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut();
});

// --- 画面切替 ---
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(`screen-${name}`).classList.remove('hidden');
}

// --- ログイン後の初期化 ---
function onUserLoggedIn(user) {
  // ここにFirestoreリスナーや初期化処理を追加
}

// --- Service Worker ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
