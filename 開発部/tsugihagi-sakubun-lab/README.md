# つぎはぎ大喜利（TsugihagiOgiri）

合言葉＋QRで集まって、**各自のスマホ**でお題にボケる。みんなで投票して一番ウケた人が優勝する、オンライン大喜利パーティー。離れた友達ともリアルタイムで遊べる。

- 企画書: `企画部/specs/2026-06-22-tsugihagi-sakubun-lab.md`
- スタック: Vanilla JS / CDNなし / PWA / **Firestore（共有倉庫 tatsuro-kei-2026）でリアルタイム同期**。AI不使用・コストゼロ
- お題: 110問超（王道〜尖り〜シュール〜パロディ）

## 遊び方
1. ホストが「部屋を作る」→ **合言葉（4文字）＋QR** が出る
2. 他の人は自分のスマホで「参加」→ 合言葉/QRで入室＋名前登録（3人以上で開始可）
3. お題が全員の画面に → **各自が自分のスマホでボケを送信**
4. 全員出そろうと投票画面 → **一番面白いボケに投票**（自分のには入れられない）
5. 票で得点 → 次のお題 → 全問終了で**優勝者＋順位表**

## 進行の仕組み
- ホストが進行の主。全員の回答／投票が揃うと自動で次フェーズへ（待機画面でホストは「待たずに進む」も可）
- 同期は Firestore の `ogiriRooms/{合言葉}` ドキュメント＋ `answers` / `votes` サブコレクション

## ⚠️ 公開前に必須：Firestore ルールの追加
`ogiriRooms` コレクションのルールを **Firebaseコンソールで追加**しないと通信が拒否される（`permission-denied`）。
共有倉庫 `tatsuro-kei-2026` の既存ルール（qrpolls 等）は**消さずに、次のブロックを追記**する：

共有倉庫は **ログイン必須**（`request.auth != null`）の方針なので、アプリ側は**匿名ログイン**を行う（`firebase.auth().signInAnonymously()`、uid を端末IDに使う）。`ogiriRooms` ブロックを既存ルールに追記する：

```
match /ogiriRooms/{code} {
  allow get: if true;
  allow list: if false;
  allow create: if request.auth != null;
  allow update: if request.auth != null;   // 参加(players追加)・進行・得点更新に必要
  allow delete: if false;
  match /answers/{aid} {
    allow get, list: if true;
    allow create, update: if request.auth != null
                          && request.resource.data.text is string
                          && request.resource.data.text.size() > 0
                          && request.resource.data.text.size() <= 40;
    allow delete: if false;
  }
  match /votes/{vid} {
    allow get, list: if true;
    allow create, update: if request.auth != null;
    allow delete: if false;
  }
}
```

手順（コンソール）: Firebase Console → `tatsuro-kei-2026` → Firestore Database → 「ルール」→ 既存ルールの `match /{document=**}` の**手前**に上のブロックを追記 → 「公開」。
前提: Authentication で「匿名」ログインが有効（qrpolls が auth 必須で動いている＝既に有効のはず）。
※ `allow update: if request.auth != null` は join/進行/得点更新に必要。本格運用前は room ごとの所有権チェックでさらに絞れる。

## firebase-config.js
共有倉庫の接続情報。Git管理外（`.gitignore`）。Vercelには `.vercelignore` で同梱。`firebase-config.example.js` がテンプレート。

## ローカル確認
```bash
cd 開発部/tsugihagi-sakubun-lab
python3 -m http.server 8000
# http://localhost:8000 （localhostからでも共有倉庫に接続できる。要：上記ルール）
```

## デプロイ
本番公開は本社ルールのデプロイ前3ゲート（Genius Council → QA → セキュリティ）通過後。Vercel（静的配信）。
