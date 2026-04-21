const { generateSignature } = require("../lib/signature");
require("dotenv").config();

const WSS_URL = process.env.BULLBIT_WS_URL || "wss://bexchange.site/ws";
const API_KEY = process.env.API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;
const SYMBOL = "btcusd";

const logFullData = (label, data) => {
  console.log(`\n=== FULL DATA: ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
  console.log(`===========================\n`);
};

describe("Bullbit WebSocket Data Validation Test", () => {
  let ws;

  beforeEach(() => {
    ws = new WebSocket(WSS_URL);
  });

  afterEach(() => {
    if (ws.readyState === ws.OPEN) ws.close();
  });

  describe("Giai đoạn 1: Public Data Check (In 5 bản tin)", () => {
    const MAX_COUNT = 5;

    test("Log Full Data - 5 bản tin Ticker All liên tiếp", (done) => {
      let count = 0;
      const MAX_COUNT = 5;

      ws.addEventListener("open", () => {
        console.log("🚀 Kết nối thành công! Đang sub ticker@all...");
        ws.send(
          JSON.stringify({ action: "SUBSCRIBE", methods: ["ticker@all"] }),
        );
      });

      ws.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));

        if (message.method === "ticker@all") {
          count++;
          console.log(
            `\n🔔 [BẢN TIN ${count}/${MAX_COUNT}] - Symbol: ${message.data.symbol}`,
          );
          console.log("--------------------------------------------------");
          console.log(JSON.stringify(message, null, 2));
          console.log("--------------------------------------------------");

          if (count >= MAX_COUNT) done();
        }
      });
    }, 30000);

    test("Validate Kline Stream - In 5 bản tin nến 1m liên tiếp", (done) => {
      let count = 0;
      const MAX_COUNT = 5;
      const INTERVAL = "1m";
      const klineMethod = `${SYMBOL}@kline@${INTERVAL}`;

      ws.addEventListener("open", () => {
        console.log(`🚀 Đang sub Kline: ${klineMethod}...`);
        ws.send(
          JSON.stringify({
            action: "SUBSCRIBE",
            methods: [klineMethod],
          }),
        );
      });

      ws.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));

        if (message.method === klineMethod) {
          count++;
          console.log(
            `\n🕯️  [KLINE UPDATE ${count}/${MAX_COUNT}] - Interval: ${INTERVAL}`,
          );
          console.log("--------------------------------------------------");
          console.log(JSON.stringify(message, null, 2));

          const k = message.data;
          console.log(
            `   📊 OHLC: O:${k.open} H:${k.high} L:${k.low} C:${k.close}`,
          );
          console.log(`   📈 Volume: ${k.volume} | Trades: ${k.tradeCount}`);
          console.log("--------------------------------------------------");

          if (count >= MAX_COUNT) {
            done();
          }
        }
      });
    }, 60000);

    test("Validate Orderbook Stream - In 5 bản tin độ sâu liên tiếp", (done) => {
      let count = 0;
      const MAX_COUNT = 5;
      const POW = "1";
      const obMethod = `${SYMBOL}@orderbook@${POW}`;

      ws.addEventListener("open", () => {
        console.log(`🚀 Đang sub Orderbook: ${obMethod}...`);
        ws.send(
          JSON.stringify({
            action: "SUBSCRIBE",
            methods: [obMethod],
          }),
        );
      });

      ws.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));

        if (message.method === obMethod) {
          count++;
          console.log(
            `\n📚 [ORDERBOOK UPDATE ${count}/${MAX_COUNT}] - Version: ${message.data.ver}`,
          );
          console.log("--------------------------------------------------");

          console.log(JSON.stringify(message, null, 2));

          const { asks, bids } = message.data;
          console.log(`   🔴 ASKS (Bán) Top 3:`, asks.slice(0, 3));
          console.log(`   🟢 BIDS (Mua) Top 3:`, bids.slice(0, 3));
          console.log("--------------------------------------------------");

          if (count >= MAX_COUNT) {
            done();
          }
        }
      });
    }, 40000);

    test("Validate Market Trade - In 5 trades gần nhất", (done) => {
      let count = 0;
      const MAX_COUNT = 5;

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({ action: "SUBSCRIBE", methods: [`${SYMBOL}@trade`] }),
        );
      });

      ws.addEventListener("message", (event) => {
        const data = JSON.parse(String(event.data));

        if (data.method === `${SYMBOL}@trade`) {
          count++;
          console.log(`\n📦 Trade thứ ${count}/${MAX_COUNT}:`);
          logFullData(`TRADE_STREAM_${count}`, data);

          if (count >= MAX_COUNT) {
            console.log(`✅ Đã thu thập đủ ${MAX_COUNT} trades.`);
            done();
          }
        }
      });
    }, 30000);

    test("Validate Book Ticker - In 5 nhịp Spread", (done) => {
      let count = 0;
      const method = `${SYMBOL}@book-ticker`;
      ws.addEventListener("open", () =>
        ws.send(JSON.stringify({ action: "SUBSCRIBE", methods: [method] })),
      );

      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.method === method) {
          count++;
          console.log(`\n⚖️  [BOOK TICKER ${count}/${MAX_COUNT}]`);
          console.log(JSON.stringify(msg, null, 2));
          const spread = msg.data.askPrice - msg.data.bidPrice;
          console.log(
            `   🔸 Best Bid: ${msg.data.bidPrice} | Best Ask: ${msg.data.askPrice} | Spread: ${spread.toFixed(4)}`,
          );
          if (count >= MAX_COUNT) done();
        }
      });
    }, 20000);

    test("Validate Index Price - In 5 nhịp", (done) => {
      let count = 0;
      const method = `${SYMBOL}@index-price`;
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ action: "SUBSCRIBE", methods: [method] }));
      });

      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.method === method) {
          count++;
          console.log(`\n🌎 [INDEX PRICE ${count}/${MAX_COUNT}]`);
          console.log(JSON.stringify(msg, null, 2));
          if (count >= MAX_COUNT) done();
        }
      });
    }, 20000);

    test("Validate Mark Price - In 5 nhịp", (done) => {
      let count = 0;
      const method = `${SYMBOL}@mark-price`;
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ action: "SUBSCRIBE", methods: [method] }));
      });

      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.method === method) {
          count++;
          console.log(`\n📌 [MARK PRICE ${count}/${MAX_COUNT}]`);
          console.log(JSON.stringify(msg, null, 2));
          if (count >= MAX_COUNT) done();
        }
      });
    }, 20000);

    test("Validate Funding Rate - In 5 bản tin", (done) => {
      let count = 0;
      const method = `${SYMBOL}@funding-rate`;
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ action: "SUBSCRIBE", methods: [method] }));
      });

      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.method === method) {
          count++;
          console.log(`\n💰 [FUNDING RATE ${count}/${MAX_COUNT}]`);
          console.log(JSON.stringify(msg, null, 2));
          console.log(
            `   🏷️  Rate: ${(msg.data.interestRate * 100).toFixed(4)}% | Period: ${msg.data.timePeriod}h`,
          );
          if (count >= MAX_COUNT) done();
        }
      });
    }, 40000);
  });

  describe("Giai đoạn 2: Private Account Data Check (Wait for all types)", () => {
    test("Nên nhận đủ 4 loại dữ liệu: BALANCE, ORDER, TRADE, POSITION", (done) => {
      const requiredTypes = new Set([
        "PERP_CROSS_ACC_BAL",
        "PERP_ORDER",
        "PERP_TRADE",
        "PERP_POSITION",
      ]);

      const receivedTypes = new Set();

      ws.addEventListener("open", () => {
        console.log("✅ Đã kết nối. Đang gửi AUTH...");
        const timestamp = Date.now().toString();
        const signature = generateSignature(timestamp, SECRET_KEY);

        const authMsg = {
          action: "AUTH",
          apiKey: API_KEY,
          timestamp: timestamp,
          signature: signature,
        };
        ws.send(JSON.stringify(authMsg));
      });

      ws.addEventListener("message", (event) => {
        const data = JSON.parse(String(event.data));

        if (data.isSuccess === false) {
          return done(new Error(`Server error: ${data.msg}`));
        }

        if (data.action === "AUTH") {
          console.log(
            "🚀 Auth thành công! Hãy thao tác đặt lệnh trên sàn để kích hoạt data...",
          );
        }

        if (data.method === "account") {
          const type = data.type;

          if (requiredTypes.has(type) && !receivedTypes.has(type)) {
            receivedTypes.add(type);
            console.log(
              `\n📥 Đã thu thập: [${receivedTypes.size}/${requiredTypes.size}] - Type: ${type}`,
            );
            logFullData(`PRIVATE_DATA_${type}`, data);
          }

          if (receivedTypes.size === requiredTypes.size) {
            console.log("🎉 Đã nhận đủ bộ 4 Private Data Types chuẩn docs!");
            done();
          }
        }
      });

      ws.addEventListener("error", (err) => done(err));
    }, 300000);
  });

  describe("Giai đoạn 2.1: Test các trường hợp AUTH thất bại chi tiết", () => {
    const runAuthFailCase = ({ caseName, buildPayload, assertError, done }) => {
      let finished = false;
      const finish = (err) => {
        if (finished) return;
        finished = true;
        done(err);
      };

      ws.addEventListener("open", () => {
        const payload = buildPayload();
        console.log(`🚀 [${caseName}] Gửi AUTH payload...`);
        ws.send(JSON.stringify(payload));
      });

      ws.addEventListener("message", (event) => {
        const raw = String(event.data);
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          console.log(`📩 [${caseName}] Raw message (không phải JSON):`, raw);
          return;
        }

        console.log(
          `📩 [${caseName}] WS response:`,
          JSON.stringify(data, null, 2),
        );

        if (data.action === "AUTH" && data.isSuccess === true) {
          return finish(
            new Error(
              `[${caseName}] Expected AUTH thất bại nhưng server trả success`,
            ),
          );
        }

        if (data.isSuccess === false) {
          try {
            assertError(data);
            return finish();
          } catch (err) {
            return finish(err);
          }
        }
      });

      ws.addEventListener("error", (event) => {
        const errMessage = event?.error?.message || event?.message || "unknown";
        finish(new Error(`[${caseName}] WebSocket error: ${errMessage}`));
      });

      ws.addEventListener("close", (event) => {
        if (finished) return;
        finish(
          new Error(
            `[${caseName}] Socket đóng trước khi nhận AUTH fail response. code=${event.code}, reason=${event.reason || ""}`,
          ),
        );
      });
    };

    test("Phải báo lỗi khi API KEY không tồn tại", (done) => {
      runAuthFailCase({
        caseName: "Sai API Key",
        buildPayload: () => {
          const ts = Date.now().toString();
          const signature = generateSignature(ts, SECRET_KEY);
          return {
            action: "AUTH",
            apiKey: "NON_EXISTENT_KEY_123",
            timestamp: ts,
            signature,
          };
        },
        assertError: (data) => {
          console.log("🎯 Bắt được lỗi Sai API Key:", data.msg);
          expect(data.msg).toMatch(
            /Invalid API Key|API Key not found|Invalid request/i,
          );
        },
        done,
      });
    }, 10000);

    test("Phải báo lỗi khi SECRET KEY sai (Signature mismatch)", (done) => {
      runAuthFailCase({
        caseName: "Sai Secret/Signature",
        buildPayload: () => {
          const ts = Date.now().toString();
          const FAKE_SECRET = "this_is_not_the_real_secret";
          const signature = generateSignature(ts, FAKE_SECRET);
          return {
            action: "AUTH",
            apiKey: API_KEY,
            timestamp: ts,
            signature,
          };
        },
        assertError: (data) => {
          console.log("🎯 Bắt được lỗi Sai Secret/Signature:", data.msg);
          expect(data.msg).toMatch(/Signature|verify|auth/i);
        },
        done,
      });
    }, 20000);

    test("Phải báo lỗi khi Timestamp quá cũ (> 5s)", (done) => {
      runAuthFailCase({
        caseName: "Timestamp quá cũ",
        buildPayload: () => {
          const expiredTs = (Date.now() - 10000).toString();
          const signature = generateSignature(expiredTs, SECRET_KEY);
          return {
            action: "AUTH",
            apiKey: API_KEY,
            timestamp: expiredTs,
            signature,
          };
        },
        assertError: (data) => {
          console.log("🎯 Bắt được lỗi Request Expired:", data.msg);
          expect(data.msg).toMatch(/expired|timestamp|timeout/i);
        },
        done,
      });
    }, 10000);

    test.only("Phải báo lỗi khi Timestamp nằm ở tương lai", (done) => {
      runAuthFailCase({
        caseName: "Timestamp tương lai",
        buildPayload: () => {
          const futureTs = (Date.now() + 60000).toString();
          const signature = generateSignature(futureTs, SECRET_KEY);
          return {
            action: "AUTH",
            apiKey: API_KEY,
            timestamp: futureTs,
            signature,
          };
        },
        assertError: (data) => {
          console.log("🎯 Bắt được lỗi Future Timestamp:", data.msg);
          expect(data.msg || "AUTH failed").toMatch(
            /future|timestamp|time|auth/i,
          );
        },
        done,
      });
    }, 10000);
  });
});
