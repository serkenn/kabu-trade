# KabuTrade API ドキュメント

## 概要

KabuTrade は日本株・米国株のデモトレードAPI を提供します。AI/Bot からプログラム経由で取引を行えます。

**Base URL:** `http://localhost:4000` (ローカル) / Cloudflare Tunnel経由のURL

---

## 認証

### APIキー認証 (Bot/AI用)

全てのBot APIリクエストに `Authorization` ヘッダーが必要です。

```
Authorization: Bearer kt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

APIキーはWebUIにログイン後、`POST /api/apikeys` で作成できます。

### パーミッション

| パーミッション | 説明 |
|---|---|
| `read` | 株価取得、残高確認、注文履歴閲覧 |
| `trade` | 現物注文の発注 |
| `margin` | 信用取引（買建・売建・決済） |
| `*` | 全権限 |

---

## APIキー管理

> これらのエンドポイントはCookie認証（WebUIログイン）が必要です

### APIキー一覧
```
GET /api/apikeys
```

**Response:**
```json
[
  {
    "id": "clxxx...",
    "name": "my-trading-bot",
    "key": "kt_abc1234...ef56",
    "permissions": ["read", "trade"],
    "isActive": true,
    "lastUsedAt": "2026-03-15T10:00:00.000Z",
    "createdAt": "2026-03-15T09:00:00.000Z"
  }
]
```

### APIキー作成
```
POST /api/apikeys
Content-Type: application/json

{
  "name": "my-trading-bot",
  "permissions": ["read", "trade", "margin"]
}
```

**Response (201):**
```json
{
  "id": "clxxx...",
  "name": "my-trading-bot",
  "key": "kt_a1b2c3d4e5f6...",
  "permissions": ["read", "trade", "margin"],
  "createdAt": "2026-03-15T09:00:00.000Z",
  "warning": "This is the only time the full API key will be shown. Save it securely."
}
```

### APIキー削除
```
DELETE /api/apikeys/:id
```

### APIキー更新
```
PATCH /api/apikeys/:id
Content-Type: application/json

{
  "isActive": false,
  "name": "renamed-bot",
  "permissions": ["read"]
}
```

---

## Bot API (v1)

> 全エンドポイント: `Authorization: Bearer <api_key>` 必須

### アカウント

#### 残高・ポートフォリオ取得
```
GET /api/v1/account
```
**パーミッション:** `read`

**Response:**
```json
{
  "balance": {
    "jpy": 10000000,
    "usd": 0
  },
  "margin": {
    "rate": 3.0,
    "used": 500000
  },
  "holdings": [
    {
      "symbol": "7203",
      "market": "JP",
      "quantity": 100,
      "avgCost": 2500
    }
  ],
  "marginPositions": [
    {
      "id": "clxxx...",
      "symbol": "AAPL",
      "market": "US",
      "side": "LONG",
      "quantity": 10,
      "entryPrice": 185.50,
      "margin": 618.33,
      "createdAt": "2026-03-15T10:00:00.000Z"
    }
  ]
}
```

---

### 株価データ

#### リアルタイム株価取得
```
GET /api/v1/quote?symbol=7203&market=JP
```
**パーミッション:** `read`

| パラメータ | 必須 | 説明 |
|---|---|---|
| `symbol` | Yes | 銘柄コード (JP: `7203`, US: `AAPL`) |
| `market` | No | `JP` (default) or `US` |

**Response:**
```json
{
  "symbol": "7203",
  "market": "JP",
  "price": 2580,
  "change": 30,
  "changePercent": 1.18,
  "high": 2600,
  "low": 2540,
  "open": 2550,
  "previousClose": 2550,
  "volume": 5230000,
  "timestamp": 1710500000000
}
```

#### 複数銘柄一括取得
```
GET /api/v1/quotes?symbols=AAPL,MSFT,GOOG&market=US
```
**パーミッション:** `read`

最大20銘柄まで。

**Response:**
```json
{
  "quotes": [
    { "symbol": "AAPL", "data": { "price": 185.50, "change": 2.30, ... } },
    { "symbol": "MSFT", "data": { "price": 420.10, "change": -1.20, ... } },
    { "symbol": "GOOG", "error": "Finnhub API error: 429" }
  ]
}
```

#### ローソク足データ取得 (日足)
```
GET /api/v1/candles?symbol=AAPL&market=US&days=90
```
**パーミッション:** `read`

| パラメータ | 必須 | 説明 |
|---|---|---|
| `symbol` | Yes | 銘柄コード |
| `market` | No | `JP` or `US` (default: `JP`) |
| `days` | No | 取得日数 1-365 (default: `90`) |

**Response:**
```json
{
  "symbol": "AAPL",
  "market": "US",
  "days": 90,
  "candles": [
    { "time": "2026-02-07", "open": 182.0, "high": 185.5, "low": 181.2, "close": 184.8, "volume": 52300000 },
    ...
  ]
}
```

#### ローソク足データ取得 (日中足)
```
GET /api/v1/candles?symbol=7203&market=JP&interval=5m
```
**パーミッション:** `read`

| パラメータ | 必須 | 説明 |
|---|---|---|
| `symbol` | Yes | 銘柄コード |
| `market` | No | `JP` or `US` (default: `JP`) |
| `interval` | Yes | 時間足: `1m`, `5m`, `10m`, `15m`, `30m`, `1h`, `2h`, `4h` |

> 日中足は現在 JP (日本株) のみ対応。Nikkei Smart Chart から1分足データを取得し、指定間隔に集約します。

**Response:**
```json
{
  "symbol": "7203",
  "market": "JP",
  "interval": "5m",
  "candles": [
    { "time": 1710486300, "open": 2580, "high": 2585, "low": 2575, "close": 2582 },
    ...
  ]
}
```

#### 銘柄検索
```
GET /api/v1/search?q=toyota&market=JP
```
**パーミッション:** `read`

**Response:**
```json
{
  "results": [
    { "symbol": "7203", "name": "トヨタ自動車" },
    { "symbol": "7211", "name": "三菱自動車工業" }
  ]
}
```

---

### 注文

#### 注文発注
```
POST /api/v1/order
Content-Type: application/json

{
  "symbol": "7203",
  "market": "JP",
  "side": "BUY",
  "type": "MARKET",
  "tradeType": "SPOT",
  "quantity": 100
}
```
**パーミッション:** `trade` (現物), `margin` (信用取引の場合は `trade` + `margin`)

| フィールド | 必須 | 説明 |
|---|---|---|
| `symbol` | Yes | 銘柄コード |
| `market` | No | `JP` (default) or `US` |
| `side` | Yes | `BUY` or `SELL` |
| `type` | No | `MARKET` (default) or `LIMIT` |
| `tradeType` | No | `SPOT` (default) or `MARGIN` |
| `quantity` | Yes | 株数 (整数) |
| `price` | LIMIT時必須 | 指値価格 |

**Response (成行約定例):**
```json
{
  "orderId": "clxxx...",
  "symbol": "7203",
  "market": "JP",
  "side": "BUY",
  "type": "MARKET",
  "tradeType": "SPOT",
  "quantity": 100,
  "filledPrice": 2580,
  "filledQty": 100,
  "status": "FILLED",
  "createdAt": "2026-03-15T10:30:00.000Z"
}
```

**信用取引の例（ショート）:**
```json
{
  "symbol": "AAPL",
  "market": "US",
  "side": "SELL",
  "type": "MARKET",
  "tradeType": "MARGIN",
  "quantity": 10
}
```

#### 注文履歴
```
GET /api/v1/orders?status=FILLED&limit=50&offset=0
```
**パーミッション:** `read`

| パラメータ | 必須 | 説明 |
|---|---|---|
| `status` | No | `PENDING`, `FILLED`, `CANCELLED`, `PARTIALLY_FILLED` |
| `limit` | No | 1-200 (default: `50`) |
| `offset` | No | ページングオフセット (default: `0`) |

---

### 信用取引

#### 建玉一覧
```
GET /api/v1/margin/positions?status=OPEN
```
**パーミッション:** `read`

| パラメータ | 必須 | 説明 |
|---|---|---|
| `status` | No | `OPEN` (default), `CLOSED`, `LIQUIDATED` |

#### 建玉決済
```
POST /api/v1/margin/close
Content-Type: application/json

{
  "positionId": "clxxx..."
}
```
**パーミッション:** `margin`

**Response:**
```json
{
  "pnl": 15000,
  "returnAmount": 515000,
  "exitPrice": 2650
}
```

---

## エラーレスポンス

全てのエラーは以下の形式で返されます:

```json
{
  "error": "エラーメッセージ"
}
```

| ステータス | 説明 |
|---|---|
| `400` | リクエスト不正（パラメータ不足、残高不足等） |
| `401` | 認証失敗（APIキーが無効） |
| `403` | 権限不足（パーミッション不足、アカウント無効） |
| `500` | サーバーエラー |

---

## レート制限

外部APIの制限に依存します:
- **J-Quants (日本株):** プランに応じたレート制限
- **Finnhub (米国株):** 無料プランは 60 calls/min

---

## 使用例

### Python

```python
import requests

API_URL = "http://localhost:4000/api/v1"
API_KEY = "kt_your_api_key_here"

headers = {"Authorization": f"Bearer {API_KEY}"}

# 残高確認
account = requests.get(f"{API_URL}/account", headers=headers).json()
print(f"JPY: ¥{account['balance']['jpy']:,.0f}")

# 株価取得
quote = requests.get(
    f"{API_URL}/quote",
    params={"symbol": "7203", "market": "JP"},
    headers=headers,
).json()
print(f"トヨタ: ¥{quote['price']:,.0f} ({quote['changePercent']:+.2f}%)")

# 買い注文
order = requests.post(
    f"{API_URL}/order",
    json={
        "symbol": "7203",
        "market": "JP",
        "side": "BUY",
        "type": "MARKET",
        "quantity": 100,
    },
    headers=headers,
).json()
print(f"約定: {order['status']} @¥{order['filledPrice']:,.0f}")
```

### curl

```bash
# 株価取得
curl -H "Authorization: Bearer kt_your_key" \
  "http://localhost:4000/api/v1/quote?symbol=AAPL&market=US"

# 買い注文
curl -X POST -H "Authorization: Bearer kt_your_key" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","market":"US","side":"BUY","quantity":10}' \
  "http://localhost:4000/api/v1/order"

# 信用売り（ショート）
curl -X POST -H "Authorization: Bearer kt_your_key" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"7203","market":"JP","side":"SELL","tradeType":"MARGIN","quantity":100}' \
  "http://localhost:4000/api/v1/order"
```

### Node.js / TypeScript

```typescript
const API_URL = "http://localhost:4000/api/v1";
const headers = { Authorization: "Bearer kt_your_key", "Content-Type": "application/json" };

// 複数銘柄の株価を一括取得
const { quotes } = await fetch(
  `${API_URL}/quotes?symbols=AAPL,MSFT,GOOG&market=US`,
  { headers }
).then(r => r.json());

// 最も上昇率の高い銘柄を買う
const best = quotes
  .filter(q => q.data)
  .sort((a, b) => b.data.changePercent - a.data.changePercent)[0];

if (best && best.data.changePercent > 0) {
  const order = await fetch(`${API_URL}/order`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      symbol: best.symbol,
      market: "US",
      side: "BUY",
      quantity: 5,
    }),
  }).then(r => r.json());

  console.log(`Bought ${best.symbol} @$${order.filledPrice}`);
}
```
