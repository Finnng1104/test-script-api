const { createBullbitRestApi } = require("../api/rest");
require("dotenv").config({ quiet: true });

const api = createBullbitRestApi();
const SYMBOL = (process.env.SYMBOL || "BTCUSD").toUpperCase();

const getFirstItem = (data) => {
  return Array.isArray(data) ? data[0] : data;
};

const logResponse = (label, data) => {
  console.log(`\n📥 ${label}:`);
  console.log(JSON.stringify(data, null, 2));
};

describe("Giai đoạn 3.1: Public REST API", () => {
  test("GET /v1/ping - Kiểm tra kết nối REST API", async () => {
    const res = await api.ping();

    logResponse("PING RESPONSE", res.data);

    expect(res.status).toBe(200);
    expect(
      res.data === "" ||
        res.data === null ||
        res.data === undefined ||
        (typeof res.data === "object" && !Array.isArray(res.data)),
    ).toBe(true);
  });

  test("GET /v1/time - Lấy server time", async () => {
    const res = await api.getServerTime();

    logResponse("SERVER TIME RESPONSE", res.data);

    expect(res.status).toBe(200);
    expect(Number.isFinite(Number(res.data.serverTime))).toBe(true);
    expect(Number(res.data.serverTime)).toBeGreaterThan(0);
  });

  test("GET /perp/v1/exchangeInfo - Lấy thông tin symbol", async () => {
    const res = await api.getExchangeInfo({ symbol: SYMBOL });

    logResponse("EXCHANGE INFO RESPONSE", res.data);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.symbols)).toBe(true);

    const symbolInfo = res.data.symbols.find((item) => item.symbol === SYMBOL);

    expect(symbolInfo).toBeDefined();
    expect(symbolInfo).toHaveProperty("symbol", SYMBOL);
    expect(symbolInfo).toHaveProperty("orderTypes");
  });

  test("GET /perp/v1/depth - Lấy snapshot orderbook", async () => {
    const res = await api.getDepth({ symbol: SYMBOL, limit: 10 });

    logResponse("DEPTH RESPONSE", res.data);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.bids)).toBe(true);
    expect(Array.isArray(res.data.asks)).toBe(true);
  });

  test("GET /perp/v1/klines - Lấy dữ liệu nến", async () => {
    const res = await api.getKlines({
      symbol: SYMBOL,
      interval: "1m",
      limit: 5,
    });

    logResponse("KLINES RESPONSE", res.data.slice(-2));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0]).toHaveProperty("interval", "1m");
  });

  test("GET /perp/v1/trades - Lấy recent trades", async () => {
    const res = await api.getRecentTrades({ symbol: SYMBOL, limit: 10 });

    logResponse("RECENT TRADES RESPONSE", res.data);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0]).toHaveProperty("price");
    expect(res.data[0]).toHaveProperty("qty");
  });

  test("GET /perp/v1/ticker/24hr - Lấy thống kê 24h", async () => {
    const res = await api.getTicker24hr({ symbol: SYMBOL });
    const ticker = getFirstItem(res.data);

    logResponse("24HR TICKER RESPONSE", res.data);

    expect(res.status).toBe(200);
    expect(ticker).toBeDefined();
    expect(ticker.symbol).toBe(SYMBOL);
    expect(Number.isFinite(Number(ticker.lastPrice))).toBe(true);
  });

  test("GET /perp/v1/bookTicker - Lấy best bid/ask", async () => {
    const res = await api.getBookTicker({ symbol: SYMBOL });
    const ticker = getFirstItem(res.data);

    logResponse("BOOK TICKER RESPONSE", res.data);

    expect(res.status).toBe(200);
    expect(ticker).toBeDefined();
    expect(ticker.symbol).toBe(SYMBOL);
    expect(Number.isFinite(Number(ticker.bidPrice))).toBe(true);
    expect(Number.isFinite(Number(ticker.askPrice))).toBe(true);
  });

  test("GET /perp/v1/fundingRateHistory - Lấy lịch sử funding rate", async () => {
    const res = await api.getFundingRateHistory({
      symbol: SYMBOL,
      limit: 10,
    });

    logResponse("FUNDING RATE HISTORY RESPONSE", res.data);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);

    if (res.data.length > 0) {
      expect(res.data[0]).toHaveProperty("symbol");
      expect(res.data[0]).toHaveProperty("interestRate");
    }
  });
});
