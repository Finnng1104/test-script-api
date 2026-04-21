# Bullbit API Test Suite

Repo này dùng để test Bullbit REST API và WebSocket API bằng `jest`, đồng thời tách sẵn client dùng lại được cho REST và WS.

Mục tiêu chính:

- test public REST endpoints
- test private REST endpoints
- test trading actions như `LIMIT`, `MARKET`, `cancel by orderId`, `cancel all`
- tái sử dụng client thay vì viết request thủ công trong từng test

## Yêu cầu

- Node.js 18+
- npm
- API key Bullbit nếu muốn chạy private REST hoặc WebSocket private

## Cài đặt

```bash
npm install
```

## Cấu hình môi trường

Tạo file `.env` ở root project.

Ví dụ:

```env
API_KEY=your_api_key
SECRET_KEY=your_secret_key
SYMBOL=BTCUSD

BULLBIT_BASE_URL=https://bexchange.site/public-api
BULLBIT_WS_URL=wss://app.bullbit.ai/ws

RECV_WINDOW=5000
ORDER_QTY=0.001
ORDER_HOLD_MS=60000
TARGET_LEVERAGE=10
LIMIT_PRICE_MULTIPLIER=0.97
```

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `API_KEY` | Có với private API | API key Bullbit |
| `SECRET_KEY` | Có với private API | Secret key để ký request |
| `SYMBOL` | Không | Symbol mặc định, ví dụ `BTCUSD` |
| `BULLBIT_BASE_URL` | Không | Base URL REST, mặc định `https://bexchange.site/public-api` |
| `BULLBIT_WS_URL` | Không | Base URL WebSocket, mặc định `wss://app.bullbit.ai/ws` |
| `RECV_WINDOW` | Không | `recvWindow` cho signed REST request |
| `ORDER_QTY` | Không | Khối lượng mặc định cho trading tests |
| `ORDER_HOLD_MS` | Không | Thời gian giữ lệnh LIMIT trước khi hủy |
| `TARGET_LEVERAGE` | Không | Leverage dùng trong test update leverage |
| `LIMIT_PRICE_MULTIPLIER` | Không | Hệ số để đặt giá LIMIT thấp hơn bid hiện tại |

## Cấu trúc thư mục

```text
.
├── src
│   ├── api
│   │   └── rest.js
│   ├── lib
│   │   └── signature.js
│   ├── tests
│   │   ├── connection.test.js
│   │   ├── public-api.test.js
│   │   └── trading-api.test.js
│   └── ws
│       └── client.js
├── package.json
└── README.md
```

## Chạy test

Chạy toàn bộ test:

```bash
npm test
```

Chạy public REST:

```bash
npm run test:public
```

Chạy private REST / trading:

```bash
npm run test:trade
```

Chạy WebSocket:

```bash
npm run test:ws
```

Chạy tuần tự:

```bash
npm run test:trade -- --runInBand
```

## Lưu ý quan trọng

- `test:trade` có side effect thật trên tài khoản:
  - tạo lệnh `LIMIT`
  - tạo lệnh `MARKET`
  - hủy lệnh theo `orderId`
  - hủy toàn bộ open orders theo `symbol`
- Không nên chạy private test trên tài khoản production nếu bạn không kiểm soát được rủi ro.
- Một số endpoint thực tế trả body rỗng `""` dù docs minh họa là `{}`. Test đã được viết để chấp nhận response thực tế này.
- File WebSocket test hiện vẫn là test integration riêng ở `src/tests/connection.test.js`.
- `src/tests/connection.test.js` hiện còn case `test.only`, nên nếu bạn muốn chạy full suite thật sự thì nên dọn phần đó trước.

## REST client dùng lại

File: [src/api/rest.js](src/api/rest.js)

Client này đã bọc sẵn:

- public request
- signed request
- ký HMAC SHA256 bằng `SECRET_KEY`
- đồng bộ `timestamp` từ `GET /v1/time`

### Ví dụ dùng

```js
const { createBullbitRestApi } = require("./src/api/rest");

const api = createBullbitRestApi();

async function main() {
  const timeRes = await api.getServerTime();
  console.log(timeRes.data);

  const tickerRes = await api.getBookTicker({ symbol: "BTCUSD" });
  console.log(tickerRes.data);
}

main().catch(console.error);
```

### Public REST methods

- `ping()`
- `getServerTime()`
- `getExchangeInfo(params)`
- `getDepth(params)`
- `getKlines(params)`
- `getRecentTrades(params)`
- `getTicker24hr(params)`
- `getBookTicker(params)`
- `getFundingRateHistory(params)`

### Private REST methods

- `getAccountInfo()`
- `getTradingInfo(params)`
- `getPositions(params)`
- `getPositionHistory(params)`
- `getFundingHistory(params)`
- `getOpenOrders(params)`
- `getOrderHistory(params)`
- `getTradeHistory(params)`
- `createOrder(params)`
- `cancelOrder(params)`
- `updateLeverage(params)`

## Test coverage hiện tại

### Public REST

File: [src/tests/public-api.test.js](src/tests/public-api.test.js)

Mỗi endpoint là một test case riêng:

- `GET /v1/ping`
- `GET /v1/time`
- `GET /perp/v1/exchangeInfo`
- `GET /perp/v1/depth`
- `GET /perp/v1/klines`
- `GET /perp/v1/trades`
- `GET /perp/v1/ticker/24hr`
- `GET /perp/v1/bookTicker`
- `GET /perp/v1/fundingRateHistory`

### Private REST

File: [src/tests/trading-api.test.js](src/tests/trading-api.test.js)

READ endpoints:

- `GET /v1/account`
- `GET /perp/v1/tradingInfo`
- `GET /perp/v1/positions`
- `GET /perp/v1/positionHistory`
- `GET /perp/v1/fundingHistory`
- `GET /perp/v1/openOrders`
- `GET /perp/v1/orderHistory`
- `GET /perp/v1/tradeHistory`

Trading endpoints:

- `PUT /perp/v1/leverage`
- `POST /perp/v1/order` với `LIMIT`
- `POST /perp/v1/order` với `MARKET`
- `DELETE /perp/v1/order` theo `orderId`
- `DELETE /perp/v1/order` theo `symbol` để cancel all

## WebSocket client

File: [src/ws/client.js](src/ws/client.js)

Client này hỗ trợ:

- `connect()`
- `attach(ws)`
- `subscribe(methods)`
- `unsubscribe(methods)`
- `auth()`
- `streamNames.*` để build tên stream

Ví dụ:

```js
const { createBullbitWsClient, streamNames } = require("./src/ws/client");

async function main() {
  const wsClient = createBullbitWsClient();
  const ws = await wsClient.connect();

  ws.on("message", (raw) => {
    console.log(String(raw));
  });

  wsClient.subscribe(streamNames.bookTicker("BTCUSD"));
}

main().catch(console.error);
```

## Tài liệu tham khảo

- REST docs: `https://bullbitperpdex.gitbook.io/bullbit-docs/api-reference/api-public`
- WebSocket docs: `https://bullbitperpdex.gitbook.io/bullbit-docs/api-reference/websocket-streams`
