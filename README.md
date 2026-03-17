# KabuTrade - デモトレードプラットフォーム

日本株・米国株のデモトレードプラットフォーム。現物取引・信用取引に対応し、AI/Bot からの自動売買 API も提供。

---

## 目次

- [アーキテクチャ概要](#アーキテクチャ概要)
- [技術スタック](#技術スタック)
- [機能一覧](#機能一覧)
- [データベーススキーマ](#データベーススキーマ)
- [API エンドポイント](#api-エンドポイント)
- [フロントエンド画面構成](#フロントエンド画面構成)
- [セットアップ](#セットアップ)
- [環境変数](#環境変数)
- [開発コマンド](#開発コマンド)
- [コントリビューション](#コントリビューション)

---

## アーキテクチャ概要

### システム全体構成

```mermaid
graph TB
    subgraph クライアント
        FE[Frontend<br/>Next.js :3000]
        AD[Admin<br/>Next.js :3001]
        BOT[AI / Bot]
    end

    subgraph バックエンド
        API[Express.js API<br/>:4000]
        MW[ミドルウェア<br/>認証 / レート制限 / Helmet]
    end

    subgraph 外部サービス
        JQ[J-Quants API<br/>日本株]
        FH[Finnhub API<br/>米国株]
        EVEX[evex-accounts<br/>外部認証]
    end

    subgraph データストア
        DB[(PostgreSQL<br/>:5432)]
    end

    subgraph インフラ
        CF[Cloudflare Tunnel<br/>公開アクセス]
    end

    FE -->|Cookie認証<br/>Next.js rewrite| API
    AD -->|Cookie認証<br/>Next.js rewrite| API
    BOT -->|APIキー認証<br/>Bearer Token| API
    API --- MW
    API --> JQ
    API --> FH
    API --> EVEX
    API --> DB
    CF -.->|オプション| API
```

### リクエスト処理フロー

```mermaid
flowchart LR
    REQ[リクエスト] --> HELM[Helmet<br/>ヘッダー設定]
    HELM --> RATE[レート制限]
    RATE --> CORS[CORS チェック]
    CORS --> SIZE[ペイロード<br/>サイズ制限]
    SIZE --> AUTH{認証方式}
    AUTH -->|Cookie| JWT[JWT検証<br/>+ セッション照合]
    AUTH -->|Bearer| AKEY[APIキー検証<br/>+ パーミッション]
    JWT --> RBAC[RBAC<br/>ロール確認]
    AKEY --> RBAC
    RBAC --> VALID[Zodバリデーション]
    VALID --> HANDLER[ルートハンドラ]
    HANDLER --> AUDIT[監査ログ記録]
    HANDLER --> RES[レスポンス]
```

### Docker コンテナ構成

```mermaid
graph LR
    subgraph docker-compose
        DB[(db<br/>PostgreSQL 16<br/>:5432)]
        BE[backend<br/>Express.js<br/>:4000]
        FE[frontend<br/>Next.js<br/>:3000]
        AD[admin<br/>Next.js<br/>:3001]
        CF[cloudflared<br/>Tunnel]
    end

    DB --- BE
    BE --- FE
    BE --- AD
    BE -..- CF
```

| サービス | ポート | 説明 |
|---|---|---|
| `db` | 5432 | PostgreSQL 16 (ヘルスチェック付き) |
| `backend` | 4000 | Express.js API サーバー |
| `frontend` | 3000 | Next.js ユーザー向け UI |
| `admin` | 3001 | Next.js 管理画面 |
| `cloudflared` | - | Cloudflare Tunnel (オプション) |

---

## 技術スタック

| レイヤー | 技術 | バージョン |
|---|---|---|
| **バックエンド** | Express.js + TypeScript | 4.21 |
| **フロントエンド** | Next.js (App Router) | 14.2 |
| **管理画面** | Next.js (App Router) | 14.2 |
| **UI** | TailwindCSS | 3.4 |
| **DB** | PostgreSQL + Prisma ORM | 16 / 5.22 |
| **認証** | JWT (jsonwebtoken) + bcryptjs | - |
| **バリデーション** | Zod | 4.3 |
| **チャート** | Lightweight Charts | 4.2 |
| **状態管理** | Zustand | 5.0 |
| **セキュリティ** | Helmet + express-rate-limit | - |
| **日本株データ** | Nikkei Smart Chart (スクレイピング) + J-Quants API | v2 |
| **米国株データ** | Finnhub API + Stooq CSV | v1 |
| **外部認証** | evex-accounts (OAuth 2.0 + PKCE) | - |
| **インフラ** | Docker Compose + Cloudflare Tunnel | - |

---

## 機能一覧

### 取引機能

| 機能 | 説明 |
|---|---|
| 現物取引 | 成行 / 指値注文。日本株 (JP) ・米国株 (US) 対応 |
| 信用取引 | 買建 (ロング) / 売建 (ショート)。証拠金率は管理者が設定可能 |
| S株 (単元未満株) | 日本株100株未満の注文。成行・現物のみ、前日終値で約定 (SBI証券ルール準拠) |
| スリッページ | 成行注文に±0.05〜0.5%のランダム変動を適用。ディレイ価格でのカンニング防止 |
| ストップ高/ストップ安 | 東証ルールに基づく値幅制限チェック。制限価格到達時は注文をブロック |
| ポートフォリオ管理 | 保有銘柄・平均取得単価・損益の確認 |
| 注文履歴 | 全注文のステータス追跡 (PENDING / FILLED / CANCELLED) |
| 複数通貨 | JPY / USD の残高管理 |
| キーボードショートカット | B=買い, S=売り, M=成行/指値, T=現物/信用, Q=数量フォーカス |
| 売り注文時の保有残高表示 | 売り注文画面で保有数量を表示、全数量ボタンで即入力 |
| ランキング | 総資産評価額・損益率ランキング (全ユーザー閲覧可) |
| モバイル対応 | レスポンシブデザイン、ハンバーガーメニュー、タブ切り替え |

### 株価データ

| 機能 | 説明 |
|---|---|
| リアルタイム株価 | Nikkei Smart Chart (日本株) / Finnhub (米国株) からリアルタイム取得 |
| ローソク足チャート | 日足 (最大365日) + 日中足 (1分〜4時間) の OHLCV データ |
| 銘柄検索 | 銘柄コード・企業名で検索。未登録コードもNikkeiから動的取得 |
| 複数銘柄一括取得 | 最大20銘柄を一括でクォート取得 (Bot API) |
| ウォッチリスト | お気に入り銘柄の登録・クイック切り替え |
| 株価キャッシュ | JP: 30秒 / US: 10秒のキャッシュ |

### AI / Bot API

| 機能 | 説明 |
|---|---|
| APIキー認証 | パーミッションベース (`read`, `trade`, `margin`, `*`) |
| 全取引操作 | プログラムから現物・信用の全操作が可能 |
| バッチクォート | 複数銘柄の一括株価取得 |
| キー管理 | 作成・更新・無効化・削除。ユーザーあたり最大10個 |

### 管理機能

| 機能 | 説明 |
|---|---|
| ユーザー管理 | 検索・一覧表示 (ページネーション)、認証方式 (evex/local) 表示 |
| 残高調整 | JPY / USD の残高を管理者が調整 (監査ログに記録) |
| ロール変更 | USER ↔ ADMIN の切り替え (CRITICAL ログに記録) |
| アカウント有効化/無効化 | ユーザーのアクセスを制御 |
| 取引履歴閲覧 | 全ユーザーの取引を横断的に閲覧 |
| 監査ログ | セキュリティイベントの閲覧 (重大度・操作種別フィルタ) |
| ランキング | 全ユーザーの総資産・損益ランキング (メール・ロール情報付き) |
| ポートフォリオ閲覧 | 各ユーザーの保有銘柄を現在価格・含み損益付きで閲覧 |
| 認証情報 | evex-accounts 認証ユーザーの Discord ID・ロール表示 |

### セキュリティ

| 機能 | 説明 |
|---|---|
| アカウントロック | 5回ログイン失敗で15分ロック |
| パスワードポリシー | 12文字以上、大小英数字+特殊文字必須 |
| 監査ログ | 全操作を永続記録 (削除なし) |
| セッション管理 | サーバーサイドセッション + 全セッション無効化 |
| セキュリティヘッダー | Helmet.js によるヘッダー保護 |
| レート制限 | エンドポイント別のリクエスト制限 |

> セキュリティの詳細は [docs/SECURITY.md](docs/SECURITY.md) を参照。

---

## データベーススキーマ

### ER図

```mermaid
erDiagram
    users ||--o{ sessions : "has"
    users ||--o{ api_keys : "has"
    users ||--o{ audit_logs : "generates"
    users ||--o{ orders : "places"
    users ||--o{ holdings : "owns"
    users ||--o{ margin_positions : "opens"
    users ||--o{ transactions : "has"

    users {
        string id PK "CUID"
        string externalId UK "evex-accounts ID"
        string email UK
        string name
        string passwordHash
        string authProvider "local / evex"
        string discordId "Discord ID (evex)"
        string[] discordRoles "Discord ロール (evex)"
        float balance "JPY残高"
        float balanceUsd "USD残高"
        float marginRate "証拠金率 (default: 3.0)"
        enum role "USER / ADMIN"
        boolean isActive
        int failedLoginAttempts
        datetime lockedUntil
        datetime passwordChangedAt
        datetime lastLoginAt
        string lastLoginIp
    }

    sessions {
        string id PK
        string userId FK
        string tokenHash "SHA-256"
        string ipAddress
        string userAgent
        datetime expiresAt "7日間"
    }

    api_keys {
        string id PK
        string userId FK
        string name
        string keyHash "SHA-256"
        string keyPrefix "先頭4文字"
        string[] permissions "read, trade, margin, *"
        boolean isActive
        datetime lastUsedAt
        string lastUsedIp
        datetime expiresAt
    }

    audit_logs {
        string id PK
        string userId FK "nullable"
        string action
        string resource
        string detail "JSON"
        string ipAddress
        string userAgent
        string severity "INFO / WARNING / CRITICAL"
        datetime createdAt
    }

    orders {
        string id PK
        string userId FK
        string symbol
        enum market "JP / US"
        enum side "BUY / SELL"
        enum type "MARKET / LIMIT"
        enum tradeType "SPOT / MARGIN"
        int quantity
        float price
        float filledPrice
        int filledQty
        enum status "PENDING / FILLED / PARTIALLY_FILLED / CANCELLED"
    }

    holdings {
        string id PK
        string userId FK
        string symbol
        enum market "JP / US"
        int quantity
        float avgCost
    }

    margin_positions {
        string id PK
        string userId FK
        string symbol
        enum market "JP / US"
        enum side "LONG / SHORT"
        int quantity
        float entryPrice
        float exitPrice
        float margin
        enum status "OPEN / CLOSED / LIQUIDATED"
        datetime closedAt
    }

    transactions {
        string id PK
        string userId FK
        string type
        float amount
        string currency "JPY / USD"
        string description
    }

    stock_cache {
        string id PK
        string symbol
        enum market "JP / US"
        string data
        datetime updatedAt
    }
```

### Enum 定義

| Enum | 値 |
|---|---|
| `Role` | `USER`, `ADMIN` |
| `OrderSide` | `BUY`, `SELL` |
| `OrderType` | `MARKET`, `LIMIT` |
| `OrderStatus` | `PENDING`, `FILLED`, `PARTIALLY_FILLED`, `CANCELLED` |
| `TradeType` | `SPOT`, `MARGIN` |
| `MarginSide` | `LONG`, `SHORT` |
| `MarginPositionStatus` | `OPEN`, `CLOSED`, `LIQUIDATED` |
| `Market` | `JP`, `US` |

---

## API エンドポイント

### 認証 API

| メソッド | パス | 認証 | レート制限 | 説明 |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | なし | 10/min | ログイン |
| `POST` | `/api/auth/register` | なし | 10/min | ユーザー登録 |
| `POST` | `/api/auth/logout` | Cookie | - | ログアウト (セッション無効化) |
| `GET` | `/api/auth/me` | Cookie | - | 現在のユーザー情報 |
| `POST` | `/api/auth/revoke-all-sessions` | Cookie | - | 全セッション無効化 |
| `GET` | `/api/auth/evex` | なし | - | evex-accounts OAuth 認可開始 |
| `GET` | `/api/auth/evex/callback` | なし | - | OAuth コールバック |
| `GET` | `/api/auth/evex/status` | なし | - | evex-accounts 有効状態 |

### Web API (Cookie 認証)

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/stocks/quote?symbol=7203&market=JP` | 株価取得 |
| `GET` | `/api/stocks/search?q=toyota&market=JP` | 銘柄検索 (最大20件) |
| `GET` | `/api/stocks/candles?symbol=AAPL&market=US&days=90` | 日足ローソク足データ |
| `GET` | `/api/stocks/candles?symbol=7203&market=JP&interval=5m` | 日中足ローソク足データ (1m/5m/10m/15m/30m/1h/2h/4h) |
| `POST` | `/api/trade/order` | 注文発注 (30/min) |
| `GET` | `/api/trade/orders?status=FILLED&limit=100` | 注文履歴 |
| `GET` | `/api/trade/holdings` | 保有銘柄 |
| `GET` | `/api/margin/positions?status=OPEN` | 信用ポジション |
| `POST` | `/api/margin/close` | 信用ポジション決済 |
| `GET` | `/api/account` | アカウント情報 |
| `GET` | `/api/account/rankings` | ユーザーランキング (全認証ユーザー閲覧可) |

### APIキー管理 (Cookie 認証)

| メソッド | パス | レート制限 | 説明 |
|---|---|---|---|
| `GET` | `/api/apikeys` | - | キー一覧 |
| `POST` | `/api/apikeys` | 5/hour | キー作成 |
| `PATCH` | `/api/apikeys/:id` | - | キー更新 |
| `DELETE` | `/api/apikeys/:id` | - | キー削除 |

### 管理 API (Cookie 認証 + ADMIN ロール)

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/admin/users?page=1&search=...` | ユーザー一覧 |
| `GET` | `/api/admin/users/:id` | ユーザー詳細 (保有銘柄・注文・取引含む) |
| `PATCH` | `/api/admin/users/:id` | ユーザー編集 (残高調整・ロール変更等) |
| `GET` | `/api/admin/transactions?page=1&userId=...` | 全取引履歴 |
| `GET` | `/api/admin/rankings` | ランキング (メール・ロール情報付き) |
| `GET` | `/api/admin/users/:id/portfolio` | ユーザーポートフォリオ (現在価格付き) |
| `GET` | `/api/admin/audit-logs?severity=...&action=...` | 監査ログ |

### Bot API (APIキー認証)

| メソッド | パス | パーミッション | 説明 |
|---|---|---|---|
| `GET` | `/api/v1/account` | `read` | 残高・保有状況 |
| `GET` | `/api/v1/quote` | `read` | 株価取得 |
| `GET` | `/api/v1/quotes` | `read` | 複数銘柄一括取得 (最大20) |
| `GET` | `/api/v1/candles` | `read` | ローソク足データ |
| `GET` | `/api/v1/search` | `read` | 銘柄検索 |
| `POST` | `/api/v1/order` | `trade` | 注文発注 |
| `GET` | `/api/v1/orders` | `read` | 注文履歴 |
| `GET` | `/api/v1/margin/positions` | `read` | 信用ポジション |
| `POST` | `/api/v1/margin/close` | `margin` | 信用ポジション決済 |

### ヘルスチェック

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| `GET` | `/api/health` | なし | `{status: "ok", timestamp: ...}` |

> Bot API の詳細な使用例は [docs/API.md](docs/API.md) を参照。

---

## フロントエンド画面構成

### ユーザー向け UI (Frontend :3000)

```mermaid
graph TD
    subgraph 認証
        LOGIN["/login<br/>ログイン画面"]
    end

    subgraph ダッシュボード
        TRADE["/trade<br/>取引画面"]
        PORTFOLIO["/portfolio<br/>ポートフォリオ"]
        MARGIN["/margin<br/>信用取引"]
        HISTORY["/history<br/>注文履歴"]
        RANKINGS["/rankings<br/>ランキング"]
        APIKEYS["/apikeys<br/>APIキー管理"]
        HELP["/help<br/>ヘルプ"]
    end

    LOGIN -->|認証成功| TRADE
    TRADE --- PORTFOLIO
    TRADE --- MARGIN
    TRADE --- HISTORY
    TRADE --- RANKINGS
    TRADE --- APIKEYS
    TRADE --- HELP
```

| パス | 画面 | 主要コンポーネント |
|---|---|---|
| `/login` | ログイン | メール・パスワード入力 |
| `/trade` | 取引 | `StockSearch`, `QuoteDisplay`, `OrderForm`, `PriceChart`, `Watchlist` |
| `/portfolio` | ポートフォリオ | 保有銘柄一覧、評価額、総資産 |
| `/margin` | 信用取引 | 建玉一覧、決済ボタン |
| `/history` | 注文履歴 | 注文一覧 (ステータスフィルタ) |
| `/rankings` | ランキング | 総資産・損益額・損益率ランキング、トップ3カード |
| `/apikeys` | APIキー管理 | キー作成・一覧・削除 |
| `/help` | ヘルプ | 用語集、ショートカット一覧、S株ルール、ページ説明、ソースコード |

### 管理画面 (Admin :3001)

```mermaid
graph TD
    subgraph 認証
        ALOGIN["/login<br/>管理者ログイン"]
    end

    subgraph 管理ダッシュボード
        USERS["/users<br/>ユーザー管理"]
        UDETAIL["/users/:id<br/>ユーザー詳細"]
        TRANS["/transactions<br/>取引履歴"]
        ARANKING["/rankings<br/>ランキング"]
        SETTINGS["/settings<br/>設定・監査ログ"]
    end

    ALOGIN -->|ADMIN認証| USERS
    USERS --> UDETAIL
    USERS --- TRANS
    USERS --- ARANKING
    USERS --- SETTINGS
```

| パス | 画面 | 機能 |
|---|---|---|
| `/login` | 管理者ログイン | ADMIN ロール必須 |
| `/users` | ユーザー一覧 | 検索・ページネーション・認証方式表示 |
| `/users/:id` | ユーザー詳細 | 残高調整、ロール変更、有効化/無効化、認証情報・Discord情報 |
| `/transactions` | 取引履歴 | 全ユーザーの取引を横断閲覧 |
| `/rankings` | ランキング | 総資産・損益ランキング (メール・ロール付き) |
| `/settings` | 設定 | 監査ログ閲覧 (重大度・操作フィルタ) |

### 主要コンポーネント

| コンポーネント | 場所 | 説明 |
|---|---|---|
| `AuthGuard` | `components/layout/` | 未認証ユーザーをログインにリダイレクト |
| `Sidebar` | `components/layout/` | ナビゲーション (デスクトップ: ホバー展開サイドバー / モバイル: ハンバーガーメニュー) |
| `StockSearch` | `components/trade/` | 銘柄コード検索 (デバウンス付き、未登録コード動的取得対応) |
| `QuoteDisplay` | `components/trade/` | リアルタイム株価表示 (ストップ高/安価格・バッジ表示) |
| `OrderForm` | `components/trade/` | 注文フォーム (成行/指値/現物/信用、S株対応、キーボードショートカット) |
| `PriceChart` | `components/charts/` | Lightweight Charts によるローソク足チャート (日足+日中足、描画ツール) |
| `Watchlist` | `components/trade/` | お気に入り銘柄リスト |

---

## セットアップ

### 前提条件

- **Node.js** 20 以上
- **Docker** & **Docker Compose** (Docker 起動の場合)
- **PostgreSQL** 16 (ローカル開発の場合)

### Docker 起動 (推奨)

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd kabu-trade

# 2. 環境変数を設定
cp .env.example .env
# .env を編集 (下記「環境変数」セクション参照)

# 3. コンテナ起動 (初回は自動ビルド)
docker compose up -d --build
```

起動後のアクセス先:
- http://localhost:3000 — 取引画面
- http://localhost:3001 — 管理画面
- http://localhost:4000 — API

### ローカル開発

```bash
# 1. 依存関係インストール
npm install

# 2. データベースセットアップ
npm run db:push     # スキーマを反映
npm run db:seed     # テストデータ投入

# 3. 各サービスを起動 (別ターミナル推奨)
npm run dev:backend    # localhost:4000
npm run dev:frontend   # localhost:3000
npm run dev:admin      # localhost:3001
```

### テストアカウント

`npm run db:seed` 実行後に利用可能:

| ロール | メール | パスワード | 初期残高 |
|---|---|---|---|
| 管理者 | `admin@kabutrade.local` | `Admin@2026!Secure` | ¥100,000,000 / $100,000 |
| ユーザー | `user@kabutrade.local` | `User@2026!Trade` | ¥10,000,000 / $10,000 |

---

## 環境変数

`.env.example` をコピーして `.env` を作成してください。

### 必須

| 変数 | 説明 | 例 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql://kabu:kabu_password@localhost:5432/kabu_trade?schema=public` |
| `JWT_SECRET` | JWT署名シークレット (ランダムな長い文字列) | `your-secure-random-string` |

### 株価 API (最低1つ設定)

| 変数 | 説明 | 取得先 |
|---|---|---|
| `JQUANTS_API_KEY` | J-Quants API キー (日本株) | [J-Quants](https://jpx-jquants.com/) |
| `FINNHUB_API_KEY` | Finnhub API キー (米国株) | [Finnhub](https://finnhub.io/) (無料プランあり) |

### evex-accounts (OAuth 2.0 / オプション)

| 変数 | 説明 | 例 |
|---|---|---|
| `EVEX_ACCOUNTS_URL` | evex-accounts サーバーURL | `https://accounts.evex.land` |
| `EVEX_CLIENT_ID` | OAuth Client ID | (evex-accounts Developer で取得) |
| `EVEX_CLIENT_SECRET` | OAuth Client Secret | (evex-accounts Developer で取得) |
| `EVEX_REDIRECT_URI` | OAuth Callback URL | `http://localhost:4000/api/auth/evex/callback` |

> 4つ全てを設定するとログイン画面に「Evex アカウントでログイン」ボタンが表示されます。未設定時はローカル認証のみ。

### その他 (オプション)

| 変数 | 説明 | デフォルト |
|---|---|---|
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare Tunnel トークン | (未設定で無効) |
| `NEXT_PUBLIC_APP_URL` | フロントエンドURL | `http://localhost:3000` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:3001` |

---

## 開発コマンド

### ルート

| コマンド | 説明 |
|---|---|
| `npm run dev` | 全サービスを開発モードで起動 |
| `npm run dev:backend` | バックエンドのみ起動 (tsx watch) |
| `npm run dev:frontend` | フロントエンドのみ起動 |
| `npm run dev:admin` | 管理画面のみ起動 |
| `npm run build` | 全パッケージをビルド |

### データベース

| コマンド | 説明 |
|---|---|
| `npm run db:push` | Prisma スキーマをDBに反映 |
| `npm run db:seed` | テストデータ投入 |
| `npm run db:studio` | Prisma Studio (DB GUI) を起動 |

### Docker

| コマンド | 説明 |
|---|---|
| `docker compose up -d --build` | 全コンテナをビルド＆バックグラウンド起動 |
| `docker compose up -d` | 既存イメージで起動（コード変更なし時） |
| `docker compose down` | 全コンテナ停止・削除 |
| `docker compose logs -f backend` | バックエンドのログをリアルタイム表示 |

---

## コントリビューション

### プロジェクト構成

```
kabu-trade/
├── docker-compose.yml          # コンテナオーケストレーション
├── .env.example                # 環境変数テンプレート
├── docs/
│   ├── API.md                  # Bot API 詳細ドキュメント
│   └── SECURITY.md             # セキュリティドキュメント
└── packages/
    ├── shared/                 # 共通ライブラリ
    │   ├── prisma/             #   DBスキーマ + seed
    │   │   ├── schema.prisma
    │   │   └── seed.ts
    │   └── src/                #   Prisma client, JWT, 型定義
    │       ├── auth.ts
    │       ├── prisma.ts
    │       └── types.ts
    ├── backend/                # Express API サーバー
    │   └── src/
    │       ├── index.ts        #   エントリーポイント
    │       ├── middleware/      #   認証・セキュリティ
    │       ├── routes/         #   ルートハンドラ
    │       ├── services/       #   ビジネスロジック・外部API
    │       └── lib/            #   セキュリティユーティリティ
    ├── frontend/               # ユーザー向け Next.js
    │   └── src/
    │       ├── app/            #   ページ (App Router)
    │       ├── hooks/          #   カスタムフック
    │       └── types/          #   TypeScript型定義
    └── admin/                  # 管理画面 Next.js
        └── src/
            ├── app/            #   管理ページ (App Router)
            ├── hooks/          #   カスタムフック
            └── types/          #   TypeScript型定義
```

### 開発の流れ

1. リポジトリをフォーク / クローン
2. ブランチを作成: `git checkout -b feature/your-feature`
3. 環境をセットアップ (`npm install` → `npm run db:push` → `npm run db:seed`)
4. 変更を実装
5. 動作確認
6. コミット & プッシュ
7. Pull Request を作成

### コーディング規約

- **言語:** TypeScript (strict mode)
- **バリデーション:** API入力は必ず Zod スキーマで検証
- **認証:** 新しいエンドポイントには適切な認証ミドルウェアを適用
- **監査ログ:** セキュリティに関わる操作は `createAuditLog()` で記録
- **エラーハンドリング:** 統一されたエラーレスポンス形式 `{ error: "message" }` を使用
