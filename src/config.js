const TAX_RATE = Math.min(
  Math.max(Number(process.env.TAX_RATE ?? "0.21"), 0),
  1
);

const CURRENCY = (
  /^[A-Za-z]{3}$/.test(process.env.CURRENCY || "")
    ? process.env.CURRENCY
    : "EUR"
).toUpperCase();

module.exports = { TAX_RATE, CURRENCY };
