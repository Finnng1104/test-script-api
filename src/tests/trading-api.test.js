const { createBullbitRestApi } = require("../api/rest");
require("dotenv").config({ quiet: true });

const api = createBullbitRestApi();
const API_KEY = process.env.API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;
const SYMBOL = (process.env.SYMBOL || "BTCUSD").toUpperCase();
const ORDER_QTY = Number(process.env.ORDER_QTY || 0.001);
const ORDER_HOLD_MS = Number(process.env.ORDER_HOLD_MS || 60_000);
const TARGET_LEVERAGE = Number(process.env.TARGET_LEVERAGE || 10);
const LIMIT_PRICE_MULTIPLIER = Number(
  process.env.LIMIT_PRICE_MULTIPLIER || 0.97,
);
const DEFAULT_PRIVATE_TEST_TIMEOUT = 30_000;
const POSITION_CLOSE_POLL_MS = Number(
  process.env.POSITION_CLOSE_POLL_MS || 1_500,
);
const POSITION_CLOSE_POLL_ATTEMPTS = Number(
  process.env.POSITION_CLOSE_POLL_ATTEMPTS || 5,
);

jest.setTimeout(DEFAULT_PRIVATE_TEST_TIMEOUT);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getFirstItem = (data) => {
  return Array.isArray(data) ? data[0] : data;
};

const maskSecret = (value = "") => {
  if (!value || typeof value !== "string") return value;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const formatResponseData = (data) => {
  if (typeof data === "string") {
    return data.length ? data : "<empty string>";
  }

  if (data === undefined) return "<undefined>";
  if (data === null) return "<null>";

  try {
    return JSON.stringify(data, null, 2);
  } catch (_) {
    return String(data);
  }
};

const logResponse = (label, data) => {
  console.log(`\n📥 ${label}:`);
  console.log(formatResponseData(data));
};

const logAxiosError = (label, error) => {
  console.error(`\n❌ ${label}`);
  console.error("Message:", error.message);

  if (error.code) {
    console.error("Error code:", error.code);
  }

  if (error.config) {
    console.error("Request method:", (error.config.method || "").toUpperCase());
    console.error("Request url:", error.config.url);
    console.error(
      "Request headers:",
      JSON.stringify(
        {
          ...error.config.headers,
          apiKey: maskSecret(error.config.headers?.apiKey || ""),
          signature: maskSecret(error.config.headers?.signature || ""),
        },
        null,
        2,
      ),
    );
  }

  if (error.response) {
    console.error("Status:", error.response.status);
    console.error("Status text:", error.response.statusText || "<empty>");
    console.error(
      "Response headers:",
      JSON.stringify(error.response.headers || {}, null, 2),
    );
    console.error("Response data:", formatResponseData(error.response.data));
  }
};

const expectEmptyOrObjectResponse = (data) => {
  return (
    data === "" ||
    data === null ||
    data === undefined ||
    typeof data === "object"
  );
};

const getPassiveLimitPrice = async (multiplier = LIMIT_PRICE_MULTIPLIER) => {
  const tickerRes = await api.getBookTicker({ symbol: SYMBOL });
  const ticker = getFirstItem(tickerRes.data);
  const bidPrice = Number(ticker?.bidPrice);

  expect(Number.isFinite(bidPrice)).toBe(true);
  expect(bidPrice).toBeGreaterThan(0);

  return Number((bidPrice * multiplier).toFixed(2));
};

const createPassiveLimitOrder = async (multiplier = LIMIT_PRICE_MULTIPLIER) => {
  const price = await getPassiveLimitPrice(multiplier);
  const createRes = await api.createOrder({
    symbol: SYMBOL,
    side: "BUY",
    type: "LIMIT",
    qty: ORDER_QTY,
    price,
    timeInForce: "GTC",
  });

  return { price, createRes, orderId: createRes.data?.id };
};

const getPositionSize = (position) => {
  const rawSize = position?.currentSize ?? position?.size ?? 0;
  return Number(rawSize);
};

const isPositionStillOpen = (position) => {
  return (
    position &&
    position.status === "OPEN" &&
    Number.isFinite(getPositionSize(position)) &&
    Math.abs(getPositionSize(position)) > 0
  );
};

const buildClosePositionOrderParams = (position) => {
  const positionSize = getPositionSize(position);

  if (!Number.isFinite(positionSize) || positionSize === 0) {
    throw new Error(
      `Position ${position?.id || "<unknown>"} không có currentSize/size hợp lệ để đóng`,
    );
  }

  return {
    symbol: position.symbol,
    side: positionSize > 0 ? "SELL" : "BUY",
    type: "MARKET",
    qty: Math.abs(positionSize),
    isReduceOnly: true,
    isReduceFull: true,
  };
};

const waitUntilPositionsClosed = async (positionIds) => {
  for (let attempt = 1; attempt <= POSITION_CLOSE_POLL_ATTEMPTS; attempt += 1) {
    const positionsRes = await api.getPositions({ limit: 100 });
    const currentPositions = Array.isArray(positionsRes.data)
      ? positionsRes.data
      : [];
    const remaining = currentPositions.filter(
      (position) =>
        positionIds.includes(String(position.id)) &&
        isPositionStillOpen(position),
    );

    if (remaining.length === 0) {
      return positionsRes;
    }

    console.log(
      `\n⏳ Vẫn còn ${remaining.length} position mở sau lần kiểm tra ${attempt}/${POSITION_CLOSE_POLL_ATTEMPTS}, chờ thêm ${POSITION_CLOSE_POLL_MS}ms...`,
    );

    await wait(POSITION_CLOSE_POLL_MS);
  }

  return api.getPositions({ limit: 100 });
};

describe("Giai đoạn 4: Trading API (REST)", () => {
  if (!API_KEY || !SECRET_KEY) {
    throw new Error("Thiếu API_KEY hoặc SECRET_KEY trong file .env");
  }

  test("GET /v1/account - Lấy thông tin account", async () => {
    try {
      const res = await api.getAccountInfo();

      logResponse("ACCOUNT INFO RESPONSE", res.data);

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty("id");
      expect(res.data).toHaveProperty("crossBalance");
    } catch (error) {
      logAxiosError("Lỗi lấy account info", error);
      throw error;
    }
  });

  test("GET /perp/v1/tradingInfo - Lấy trading info theo symbol", async () => {
    try {
      const res = await api.getTradingInfo({ symbol: SYMBOL });

      logResponse("TRADING INFO RESPONSE", res.data);

      expect(res.status).toBe(200);
      expect(res.data.symbol).toBe(SYMBOL);
      expect(Number.isFinite(Number(res.data.leverage))).toBe(true);
    } catch (error) {
      logAxiosError("Lỗi lấy trading info", error);
      throw error;
    }
  });

  test("GET /perp/v1/positions - Lấy positions hiện tại", async () => {
    try {
      const res = await api.getPositions({ symbol: SYMBOL, limit: 10 });

      logResponse("POSITIONS RESPONSE", res.data);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    } catch (error) {
      logAxiosError("Lỗi lấy positions", error);
      throw error;
    }
  });

  test("GET /perp/v1/positionHistory - Lấy lịch sử position", async () => {
    try {
      const res = await api.getPositionHistory({ symbol: SYMBOL, limit: 10 });

      logResponse("POSITION HISTORY RESPONSE", res.data);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    } catch (error) {
      logAxiosError("Lỗi lấy position history", error);
      throw error;
    }
  });

  test("GET /perp/v1/fundingHistory - Lấy lịch sử funding", async () => {
    try {
      const res = await api.getFundingHistory({ limit: 10 });

      logResponse("FUNDING HISTORY RESPONSE", res.data);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    } catch (error) {
      logAxiosError("Lỗi lấy funding history", error);
      throw error;
    }
  });

  test("GET /perp/v1/openOrders - Lấy open orders", async () => {
    try {
      const res = await api.getOpenOrders({ symbol: SYMBOL, limit: 100 });

      logResponse("OPEN ORDERS RESPONSE", res.data);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    } catch (error) {
      logAxiosError("Lỗi lấy open orders", error);
      throw error;
    }
  });

  test("GET /perp/v1/orderHistory - Lấy lịch sử orders", async () => {
    try {
      const res = await api.getOrderHistory({ symbol: SYMBOL, limit: 10 });

      logResponse("ORDER HISTORY RESPONSE", res.data);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    } catch (error) {
      logAxiosError("Lỗi lấy order history", error);
      throw error;
    }
  });

  test("GET /perp/v1/tradeHistory - Lấy lịch sử trades", async () => {
    try {
      const res = await api.getTradeHistory({ symbol: SYMBOL, limit: 10 });

      logResponse("TRADE HISTORY RESPONSE", res.data);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    } catch (error) {
      logAxiosError("Lỗi lấy trade history", error);
      throw error;
    }
  });

  test("PUT /perp/v1/leverage - Cập nhật leverage", async () => {
    try {
      const infoRes = await api.getTradingInfo({ symbol: SYMBOL });

      expect(infoRes.status).toBe(200);
      expect(infoRes.data.symbol).toBe(SYMBOL);

      const updateRes = await api.updateLeverage({
        symbol: SYMBOL,
        leverage: TARGET_LEVERAGE,
      });

      logResponse("LEVERAGE UPDATE RESPONSE", updateRes.data);

      expect(updateRes.status).toBe(200);
      expect(updateRes.data.symbol).toBe(SYMBOL);
      expect(Number(updateRes.data.leverage)).toBe(TARGET_LEVERAGE);
    } catch (error) {
      logAxiosError("Lỗi update leverage", error);
      throw error;
    }
  });

  test(
    "POST /perp/v1/order + DELETE /perp/v1/order - Tạo LIMIT order, giữ rồi hủy theo orderId",
    async () => {
      try {
        const { price, createRes, orderId } = await createPassiveLimitOrder();

        logResponse("CREATE LIMIT ORDER RESPONSE", createRes.data);

        expect(createRes.status).toBe(200);
        expect(createRes.data).toHaveProperty("id");
        expect(createRes.data.symbol).toBe(SYMBOL);
        expect(createRes.data.type).toBe("LIMIT");
        expect(Number(createRes.data.price)).toBe(price);

        console.log(
          `\n⏳ Giữ LIMIT order ${orderId} trong ${ORDER_HOLD_MS / 1000} giây trước khi hủy...`,
        );
        await wait(ORDER_HOLD_MS);

        const cancelRes = await api.cancelOrder({
          symbol: SYMBOL,
          orderId,
        });

        logResponse("CANCEL ORDER RESPONSE", cancelRes.data);

        expect(cancelRes.status).toBe(200);
        expect(expectEmptyOrObjectResponse(cancelRes.data)).toBe(true);

        const openOrdersRes = await api.getOpenOrders({
          symbol: SYMBOL,
          limit: 100,
        });

        expect(openOrdersRes.status).toBe(200);
        expect(
          openOrdersRes.data.some(
            (order) => String(order.id) === String(orderId),
          ),
        ).toBe(false);
      } catch (error) {
        logAxiosError("Lỗi create/cancel LIMIT order", error);
        throw error;
      }
    },
    ORDER_HOLD_MS + 30_000,
  );

  test("POST /perp/v1/order - Tạo MARKET order", async () => {
    try {
      const createRes = await api.createOrder({
        symbol: SYMBOL,
        side: "BUY",
        type: "MARKET",
        qty: ORDER_QTY,
      });

      logResponse("CREATE MARKET ORDER RESPONSE", createRes.data);

      expect(createRes.status).toBe(200);
      expect(typeof createRes.data).toBe("object");
      expect(createRes.data).toHaveProperty("id");
      expect(createRes.data.symbol).toBe(SYMBOL);
      expect(createRes.data.type).toBe("MARKET");
    } catch (error) {
      logAxiosError("Lỗi create MARKET order", error);
      throw error;
    }
  }, 30_000);

  test("DELETE /perp/v1/order - Hủy toàn bộ open orders theo symbol", async () => {
    try {
      const firstOrder = await createPassiveLimitOrder(0.96);
      const secondOrder = await createPassiveLimitOrder(0.95);

      logResponse(
        "FIRST LIMIT ORDER FOR CANCEL-ALL",
        firstOrder.createRes.data,
      );
      logResponse(
        "SECOND LIMIT ORDER FOR CANCEL-ALL",
        secondOrder.createRes.data,
      );

      const beforeCancelRes = await api.getOpenOrders({
        symbol: SYMBOL,
        limit: 100,
      });

      expect(beforeCancelRes.status).toBe(200);
      expect(Array.isArray(beforeCancelRes.data)).toBe(true);

      const createdIds = [firstOrder.orderId, secondOrder.orderId].map(String);
      const openOrderIds = beforeCancelRes.data.map((order) =>
        String(order.id),
      );

      expect(createdIds.every((id) => openOrderIds.includes(id))).toBe(true);

      const cancelAllRes = await api.cancelOrder({ symbol: SYMBOL });

      logResponse("CANCEL ALL ORDERS RESPONSE", cancelAllRes.data);

      expect(cancelAllRes.status).toBe(200);
      expect(expectEmptyOrObjectResponse(cancelAllRes.data)).toBe(true);

      const afterCancelRes = await api.getOpenOrders({
        symbol: SYMBOL,
        limit: 100,
      });

      expect(afterCancelRes.status).toBe(200);
      expect(Array.isArray(afterCancelRes.data)).toBe(true);
      expect(
        afterCancelRes.data.some((order) =>
          createdIds.includes(String(order.id)),
        ),
      ).toBe(false);
    } catch (error) {
      logAxiosError("Lỗi cancel all open orders", error);
      throw error;
    }
  }, 60_000);

  test("DELETE /perp/v1/order - Hủy toàn bộ open orders không truyền symbol", async () => {
    try {
      const firstOrder = await createPassiveLimitOrder(0.94);
      const secondOrder = await createPassiveLimitOrder(0.93);

      logResponse(
        "FIRST LIMIT ORDER FOR GLOBAL CANCEL-ALL",
        firstOrder.createRes.data,
      );
      logResponse(
        "SECOND LIMIT ORDER FOR GLOBAL CANCEL-ALL",
        secondOrder.createRes.data,
      );

      const beforeCancelRes = await api.getOpenOrders({
        symbol: SYMBOL,
        limit: 100,
      });

      expect(beforeCancelRes.status).toBe(200);
      expect(Array.isArray(beforeCancelRes.data)).toBe(true);

      const createdIds = [firstOrder.orderId, secondOrder.orderId].map(String);
      const openOrderIds = beforeCancelRes.data.map((order) =>
        String(order.id),
      );

      expect(createdIds.every((id) => openOrderIds.includes(id))).toBe(true);

      const cancelAllRes = await api.cancelOrder({});

      logResponse("GLOBAL CANCEL ALL ORDERS RESPONSE", cancelAllRes.data);

      expect(cancelAllRes.status).toBe(200);
      expect(expectEmptyOrObjectResponse(cancelAllRes.data)).toBe(true);

      const afterCancelRes = await api.getOpenOrders({
        symbol: SYMBOL,
        limit: 100,
      });

      expect(afterCancelRes.status).toBe(200);
      expect(Array.isArray(afterCancelRes.data)).toBe(true);
      expect(
        afterCancelRes.data.some((order) =>
          createdIds.includes(String(order.id)),
        ),
      ).toBe(false);
    } catch (error) {
      logAxiosError("Lỗi global cancel all open orders", error);
      throw error;
    }
  }, 60_000);

  test("POST /perp/v1/order - Đóng toàn bộ position hiện tại", async () => {
    try {
      const beforePositionsRes = await api.getPositions({ limit: 100 });

      expect(beforePositionsRes.status).toBe(200);
      expect(Array.isArray(beforePositionsRes.data)).toBe(true);

      const openPositions = beforePositionsRes.data.filter(isPositionStillOpen);

      logResponse("OPEN POSITIONS BEFORE CLOSE-ALL", openPositions);

      if (openPositions.length === 0) {
        console.log("\nℹ️ Không có position mở để đóng.");
        expect(openPositions).toHaveLength(0);
        return;
      }

      const closeResults = [];

      for (const position of openPositions) {
        const closeParams = buildClosePositionOrderParams(position);
        const closeRes = await api.createOrder(closeParams);

        closeResults.push({
          positionId: position.id,
          symbol: position.symbol,
          closeOrder: closeRes.data,
        });
      }

      logResponse("CLOSE POSITION ORDER RESPONSES", closeResults);

      const positionIds = openPositions.map((position) => String(position.id));
      const afterPositionsRes = await waitUntilPositionsClosed(positionIds);

      expect(afterPositionsRes.status).toBe(200);
      expect(Array.isArray(afterPositionsRes.data)).toBe(true);

      const remainingOpenPositions = afterPositionsRes.data.filter(
        (position) =>
          positionIds.includes(String(position.id)) &&
          isPositionStillOpen(position),
      );

      logResponse("POSITIONS AFTER CLOSE-ALL", afterPositionsRes.data);

      expect(remainingOpenPositions).toHaveLength(0);
    } catch (error) {
      logAxiosError("Lỗi đóng toàn bộ position hiện tại", error);
      throw error;
    }
  }, 90_000);
});
