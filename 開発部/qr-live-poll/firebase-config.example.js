// 複数スマホでのリアルタイム同期を有効にするには、
// このファイルを firebase-config.js にコピーして自分のFirebase設定を入れてください。
// （Firestoreを有効化し、テスト用ルールまたは下記の限定ルールを設定）
//
// firestore ルール例（qrpolls だけ読み書き可・他は不可）:
//   match /qrpolls/{id} {
//     allow read: if true;
//     allow create, update: if true;  // MVP用。必要なら投票数の検証を足す
//   }

window.QRPOLL_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
