const crypto = require("crypto");

const generateSignature = (payload, secretKey) => {
  return crypto
    .createHmac("sha256", secretKey)
    .update(String(payload))
    .digest("hex");
};

module.exports = { generateSignature };
