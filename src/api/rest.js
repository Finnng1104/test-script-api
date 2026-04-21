const axios = require("axios");
const { generateSignature } = require("../lib/signature");
require("dotenv").config({ quiet: true });

const DEFAULT_BASE_URL =
  process.env.BULLBIT_BASE_URL || "https://bexchange.site/public-api";
const DEFAULT_RECV_WINDOW = Number(process.env.RECV_WINDOW || 5000);

const REST_ENDPOINTS = Object.freeze({
  general: Object.freeze({
    ping: "/v1/ping",
    time: "/v1/time",
    exchangeInfo: "/perp/v1/exchangeInfo",
  }),
  market: Object.freeze({
    depth: "/perp/v1/depth",
    klines: "/perp/v1/klines",
    trades: "/perp/v1/trades",
    ticker24hr: "/perp/v1/ticker/24hr",
    bookTicker: "/perp/v1/bookTicker",
    fundingRateHistory: "/perp/v1/fundingRateHistory",
  }),
  account: Object.freeze({
    accountInfo: "/v1/account",
    tradingInfo: "/perp/v1/tradingInfo",
    positions: "/perp/v1/positions",
    positionHistory: "/perp/v1/positionHistory",
    fundingHistory: "/perp/v1/fundingHistory",
    openOrders: "/perp/v1/openOrders",
    orderHistory: "/perp/v1/orderHistory",
    tradeHistory: "/perp/v1/tradeHistory",
  }),
  trading: Object.freeze({
    order: "/perp/v1/order",
    leverage: "/perp/v1/leverage",
  }),
});

const REST_ENUMS = Object.freeze({
  orderSides: Object.freeze(["BUY", "SELL"]),
  orderTypes: Object.freeze(["LIMIT", "MARKET", "STOP_LIMIT", "STOP_MARKET"]),
  timeInForce: Object.freeze(["GTC", "POST_ONLY", "IOC", "FOK"]),
  triggerPriceTypes: Object.freeze(["LAST_PRICE", "MARK_PRICE"]),
});

const normalizeParams = (params = {}) => {
  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === "") {
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});
};

const buildQueryString = (params = {}) => {
  return new URLSearchParams(normalizeParams(params)).toString();
};

const buildUrl = (baseUrl, endpoint, params = {}) => {
  const queryString = buildQueryString(params);
  return queryString ? `${baseUrl}${endpoint}?${queryString}` : `${baseUrl}${endpoint}`;
};

const createBullbitRestApi = ({
  baseUrl = DEFAULT_BASE_URL,
  apiKey = process.env.API_KEY,
  secretKey = process.env.SECRET_KEY,
  recvWindow = DEFAULT_RECV_WINDOW,
  axiosInstance = axios,
} = {}) => {
  const request = async (method, endpoint, params = {}, headers = {}) => {
    return axiosInstance({
      method,
      url: buildUrl(baseUrl, endpoint, params),
      headers,
    });
  };

  const publicRequest = async (method, endpoint, params = {}) => {
    return request(method, endpoint, params);
  };

  const getServerTime = async () => {
    return publicRequest("GET", REST_ENDPOINTS.general.time);
  };

  const getServerTimestamp = async () => {
    const response = await getServerTime();
    const serverTime = Number(response.data?.serverTime);

    if (!Number.isFinite(serverTime)) {
      throw new Error(
        `Không lấy được serverTime hợp lệ từ ${REST_ENDPOINTS.general.time}`,
      );
    }

    return serverTime;
  };

  const signedRequest = async (method, endpoint, params = {}) => {
    if (!apiKey || !secretKey) {
      throw new Error(
        "Thiếu API_KEY hoặc SECRET_KEY. Signed endpoint cần đủ cả hai giá trị.",
      );
    }

    const cleanParams = normalizeParams(params);
    const payload = normalizeParams({
      ...cleanParams,
      recvWindow: cleanParams.recvWindow ?? recvWindow,
      timestamp: cleanParams.timestamp ?? (await getServerTimestamp()),
    });
    const queryString = buildQueryString(payload);

    return axiosInstance({
      method,
      url: `${baseUrl}${endpoint}?${queryString}`,
      headers: {
        apiKey,
        signature: generateSignature(queryString, secretKey),
      },
    });
  };

  const general = {
    ping: async () => publicRequest("GET", REST_ENDPOINTS.general.ping),
    getServerTime,
    getExchangeInfo: async (params = {}) =>
      publicRequest("GET", REST_ENDPOINTS.general.exchangeInfo, params),
  };

  const market = {
    getDepth: async (params = {}) =>
      publicRequest("GET", REST_ENDPOINTS.market.depth, params),
    getKlines: async (params = {}) =>
      publicRequest("GET", REST_ENDPOINTS.market.klines, params),
    getRecentTrades: async (params = {}) =>
      publicRequest("GET", REST_ENDPOINTS.market.trades, params),
    getTicker24hr: async (params = {}) =>
      publicRequest("GET", REST_ENDPOINTS.market.ticker24hr, params),
    getBookTicker: async (params = {}) =>
      publicRequest("GET", REST_ENDPOINTS.market.bookTicker, params),
    getFundingRateHistory: async (params = {}) =>
      publicRequest("GET", REST_ENDPOINTS.market.fundingRateHistory, params),
  };

  const account = {
    getAccountInfo: async () =>
      signedRequest("GET", REST_ENDPOINTS.account.accountInfo),
    getTradingInfo: async (params = {}) =>
      signedRequest("GET", REST_ENDPOINTS.account.tradingInfo, params),
    getPositions: async (params = {}) =>
      signedRequest("GET", REST_ENDPOINTS.account.positions, params),
    getPositionHistory: async (params = {}) =>
      signedRequest("GET", REST_ENDPOINTS.account.positionHistory, params),
    getFundingHistory: async (params = {}) =>
      signedRequest("GET", REST_ENDPOINTS.account.fundingHistory, params),
    getOpenOrders: async (params = {}) =>
      signedRequest("GET", REST_ENDPOINTS.account.openOrders, params),
    getOrderHistory: async (params = {}) =>
      signedRequest("GET", REST_ENDPOINTS.account.orderHistory, params),
    getTradeHistory: async (params = {}) =>
      signedRequest("GET", REST_ENDPOINTS.account.tradeHistory, params),
  };

  const trading = {
    createOrder: async (params = {}) =>
      signedRequest("POST", REST_ENDPOINTS.trading.order, params),
    cancelOrder: async (params = {}) =>
      signedRequest("DELETE", REST_ENDPOINTS.trading.order, params),
    updateLeverage: async (params = {}) =>
      signedRequest("PUT", REST_ENDPOINTS.trading.leverage, params),
  };

  return {
    baseUrl,
    recvWindow,
    request,
    publicRequest,
    signedRequest,
    getServerTimestamp,
    ...general,
    ...market,
    ...account,
    ...trading,
    groups: {
      general,
      market,
      account,
      trading,
    },
  };
};

const bullbitRestApi = createBullbitRestApi();

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_RECV_WINDOW,
  REST_ENDPOINTS,
  REST_ENUMS,
  normalizeParams,
  buildQueryString,
  buildUrl,
  createBullbitRestApi,
  ...bullbitRestApi,
};
