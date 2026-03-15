# sugoroku-life プロジェクト概要

## 技術スタック

| 技術 | 役割 |
|---|---|
| **Next.js 15** (App Router) | フロントエンド + APIサーバー |
| **Supabase** | データベース・認証・リアルタイム通信 |
| **Tailwind CSS** | スタイリング |
| **Vercel** | デプロイ先（予定） |

---

## フォルダ構成

```
sugoroku-life/
├── src/
│   ├── middleware.ts               ← 認証ガード（全ページ共通）
│   ├── lib/
│   │   ├── phases.ts               ← フェーズ定義・型定義
│   │   └── supabase/
│   │       ├── client.ts           ← ブラウザ用Supabaseクライアント
│   │       └── server.ts           ← サーバー用Supabaseクライアント
│   ├── components/
│   │   └── ChatPanel.tsx           ← チャットUI（再利用可能）
│   └── app/
│       ├── page.tsx                ← ホーム（ダッシュボード）
│       ├── auth/
│       │   ├── login/              ← ログイン・新規登録
│       │   ├── callback/           ← メール認証後のリダイレクト
│       │   └── signout/            ← ログアウト
│       ├── profile/setup/          ← ニックネーム設定
│       ├── board/
│       │   ├── create/             ← ボード作成・編集
│       │   └── [boardId]/complete/ ← 完成画面・招待リンク
│       ├── invite/[boardId]/       ← 招待リンク受付
│       ├── game/[sessionId]/
│       │   ├── (ゲーム本体)
│       │   ├── result/             ← 結果画面
│       │   └── chat/               ← 振り返りチャット
│       └── api/
│           ├── board/              ← ボード保存
│           ├── session/            ← セッション（マッチング）作成
│           ├── turn/               ← ターン記録・正解チェック
│           ├── message/            ← チャット送信
│           └── game/[sessionId]/   ← ゲームデータ取得
└── supabase/migrations/            ← DB定義（011ファイル）
```

---

## ユーザーの流れ（画面遷移）

```
[ログイン/新規登録]
       ↓
[ニックネーム設定]
       ↓
[ホーム画面]
   ↓ ボードがない        ↓ ボードがある
[ボード作成]         [完成画面・招待リンク]
       ↓
[完成画面・招待リンク] ← リンクを相手に送る
       ↓（相手が参加したら自動遷移）
[ゲーム画面・ターン制プレイ]
       ↓
[結果画面]
       ↓
[振り返りチャット]
       ↓
[ホーム画面]
```

---

## データベース構成

```
auth.users（Supabase組み込み）
  └── profiles（ニックネーム）
        └── boards（人生ボード）
              └── squares（各マス：分岐/効果）
              └── sessions（2ボードのマッチング）
                    └── turns（各プレイヤーのターン記録）
                    └── messages（チャット）
```

### テーブル詳細

#### `profiles`
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | auth.users の id と同一 |
| nickname | text | 表示名 |

#### `boards`
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | 作成者（UNIQUE：1ユーザー1ボード） |
| title | text | ボードタイトル |

#### `squares`
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | PK |
| board_id | uuid | 所属ボード |
| index | int | マス番号（1〜10） |
| phase | text | フェーズ名（幼少期など） |
| age_range | text | 年齢帯（0〜6歳など） |
| event | text | 出来事テキスト |
| square_type | text | `'branch'`（分岐）または `'effect'`（効果） |
| choice_a | text \| null | 選択肢A（分岐マスのみ） |
| choice_b | text \| null | 選択肢B（分岐マスのみ） |
| answer_index | int \| null | 正解インデックス（0=A, 1=B、分岐マスのみ） |
| effect | int \| null | 効果値（`1`=1マス進む、`-1`=1マス戻る、効果マスのみ） |

#### `sessions`
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | PK |
| board_a_id | uuid | プレイヤーAのボード |
| board_b_id | uuid | プレイヤーBのボード |
| status | text | ゲーム状態 |

#### `turns`
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | 所属セッション |
| player_id | uuid | プレイヤー |
| square_index | int | 対象マス番号 |
| chosen_index | int | 選んだ選択肢（0 or 1） |
| is_correct | bool | 正解かどうか |

#### `messages`
| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | 所属セッション |
| sender_id | uuid | 送信者 |
| content | text | メッセージ本文 |

---

## 各ファイルの役割

### `middleware.ts` — 認証ガード
全ページへのアクセス時に実行。未ログイン→ログインページ、ニックネーム未設定→設定ページ、へ自動リダイレクト。ログインページ・コールバックは除外。

### `lib/phases.ts` — ゲームの設計図
マスの型定義（`SquareInput`）とフェーズ（幼少期・小学生・中学生・高校生・18〜20歳）を管理。`squareType`（`"branch"` / `"effect"`）と `effect`（`1` / `-1`）も含む。

### `board/create/BoardCreateForm.tsx` — ボード作成フォーム
10マスをフェーズごとにタブで入力。各マスで「🔀 分岐マス（A/B選択）」か「⚡ 効果マス（進む/戻る）」かを切り替え可能。

### `board/[boardId]/complete/InviteLinkBox.tsx` — 招待リンク
招待URLをコピーできるUI。Supabase Realtime で `sessions` テーブルを監視し、相手がゲームに参加した瞬間に自動でゲーム画面へ遷移。

### `game/[sessionId]/GameBoard.tsx` — ゲーム本体
ゲームのメインコンポーネント。以下を管理：
- **`position`**: 現在のマス位置（1〜10、11を超えたら終了）
- **`skippedIndices`**: 効果マスで飛ばされたマスの記録
- **分岐マス**: A/B選択 → APIで正解チェック → 結果表示
- **効果マス**: 内容表示 → 確認 → 位置を調整（+2 または -1）
- **Realtime**: 相手のターンをリアルタイムで受信して進捗バーを更新

### `api/turn/route.ts` — ターン記録
分岐マスでの選択を受け取り、ボード作成者の `answer_index` と比較して正解か判定し、`turns` テーブルに保存。

---

## マイグレーション履歴（DBの変更ログ）

| # | ファイル名 | 内容 |
|---|---|---|
| 001 | `001_create_profiles.sql` | `profiles` テーブル作成 + RLSポリシー |
| 002 | `002_create_boards.sql` | `boards`・`squares` テーブル作成 + RLSポリシー |
| 003 | `003_create_sessions.sql` | `sessions` テーブル作成（マッチング） |
| 004 | `004_create_turns.sql` | `turns` テーブル作成（ターン記録） |
| 005 | `005_enable_realtime.sql` | `turns` のリアルタイム有効化 |
| 006 | `006_create_messages.sql` | `messages` テーブル作成（チャット） |
| 007 | `007_fix_profiles_policy.sql` | プロフィールを全認証ユーザーが参照できるよう修正 |
| 008 | `008_fix_squares_policy.sql` | セッション参加者が相手のマスを参照できるよう修正 |
| 009 | `009_sessions_realtime.sql` | `sessions` のリアルタイム有効化 |
| 010 | `010_board_unique.sql` | ボードを1ユーザー1つに制限（UNIQUE制約） |
| 011 | `011_add_square_type.sql` | `square_type`・`effect` カラム追加、`choice_a/b/answer_index` をNULL許容に変更 |

---

## ゲームのマス種別

### 分岐マス（`square_type = 'branch'`）
プレイヤーはA/Bの選択肢からどちらかを選び、ボード作成者の実際の選択（`answer_index`）と一致すれば「共感」としてスコアが加算される。

### 効果マス（`square_type = 'effect'`）
選択肢なし。出来事の内容と効果を確認して「確認」を押すと、以下の移動が発生する：
- `effect = 1`：次のマスをスキップして2マス先へ
- `effect = -1`：1つ前のマスを再プレイ
