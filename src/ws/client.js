const WebSocket = require("ws");
const { generateSignature } = require("../lib/signature");
require("dotenv").config({ quiet: true });

const DEFAULT_WS_URL = process.env.BULLBIT_WS_URL || "wss://app.bullbit.ai/ws";
const ACCOUNT_STREAM = "account";

const WS_ACTIONS = Object.freeze({
  subscribe: "SUBSCRIBE",
  unsubscribe: "UNSUBSCRIBE",
  auth: "AUTH",
});

const WS_EVENT_TYPES = Object.freeze({
  ticker: "TICKER",
  kline: "KLINE",
  orderbook: "ORDERBOOK",
  marketTrade: "MARKET_TRADE",
  bookTicker: "BOOK_TICKER",
  indexPrice: "INDEX_PRICE",
  markPrice: "MARK_PRICE",
  perpFundingRate: "PERP_FUNDING_RATE",
  perpOrder: "PERP_ORDER",
  perpTrade: "PERP_TRADE",
  perpPosition: "PERP_POSITION",
  perpCrossAccBal: "PERP_CROSS_ACC_BAL",
});

const normalizeSymbol = (symbol = "") => String(symbol).toLowerCase();

const streamNames = Object.freeze({
  allTicker: () => "ticker@all",
  kline: (symbol, interval) => `${normalizeSymbol(symbol)}@kline@${interval}`,
  orderbook: (symbol, pow = 1) => `${normalizeSymbol(symbol)}@orderbook@${pow}`,
  trade: (symbol) => `${normalizeSymbol(symbol)}@trade`,
  bookTicker: (symbol) => `${normalizeSymbol(symbol)}@book-ticker`,
  indexPrice: (symbol) => `${normalizeSymbol(symbol)}@index-price`,
  markPrice: (symbol) => `${normalizeSymbol(symbol)}@mark-price`,
  fundingRate: (symbol) => `${normalizeSymbol(symbol)}@funding-rate`,
});

const toMethodList = (methods) => {
  if (Array.isArray(methods)) {
    return methods;
  }

  if (typeof methods === "string" && methods) {
    return [methods];
  }

  throw new Error("methods phải là string hoặc string[]");
};

const createBullbitWsClient = ({
  wsUrl = DEFAULT_WS_URL,
  apiKey = process.env.API_KEY,
  secretKey = process.env.SECRET_KEY,
  WebSocketImpl = WebSocket,
} = {}) => {
  let socket = null;

  const requireSocket = (ws = socket) => {
    if (!ws) {
      throw new Error("Chưa có WebSocket connection. Hãy gọi connect() hoặc attach().");
    }

    return ws;
  };

  const attach = (ws) => {
    socket = ws;
    return socket;
  };

  const connect = () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocketImpl(wsUrl);

      ws.once("open", () => {
        socket = ws;
        resolve(ws);
      });

      ws.once("error", reject);
    });
  };

  const sendJson = (payload, ws = socket) => {
    const target = requireSocket(ws);
    target.send(JSON.stringify(payload));
    return payload;
  };

  const subscribe = (methods, ws = socket) => {
    const methodList = toMethodList(methods);
    return sendJson(
      {
        action: WS_ACTIONS.subscribe,
        methods: methodList,
      },
      ws,
    );
  };

  const unsubscribe = (methods, ws = socket) => {
    const methodList = toMethodList(methods);
    return sendJson(
      {
        action: WS_ACTIONS.unsubscribe,
        methods: methodList,
      },
      ws,
    );
  };

  const auth = ({ timestamp = Date.now() } = {}, ws = socket) => {
    if (!apiKey || !secretKey) {
      throw new Error(
        "Thiếu API_KEY hoặc SECRET_KEY. WebSocket AUTH cần đủ cả hai giá trị.",
      );
    }

    const authTimestamp = Number(timestamp);
    const payload = {
      action: WS_ACTIONS.auth,
      apiKey,
      timestamp: authTimestamp,
      signature: generateSignature(String(authTimestamp), secretKey),
    };

    return sendJson(payload, ws);
  };

  return {
    wsUrl,
    attach,
    connect,
    sendJson,
    subscribe,
    unsubscribe,
    auth,
    streamNames,
  };
};

module.exports = {
  DEFAULT_WS_URL,
  ACCOUNT_STREAM,
  WS_ACTIONS,
  WS_EVENT_TYPES,
  normalizeSymbol,
  streamNames,
  createBullbitWsClient,
};
