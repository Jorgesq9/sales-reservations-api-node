const express = require("express");
const { prisma } = require("../prisma");
const { orderCreateSchema, orderStatusPatchSchema } = require("../validators");
const { TAX_RATE, CURRENCY } = require("../config");
const router = express.Router();

const formatMoney = (cents, currency = "EUR", locale = "es-ES") =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    cents / 100
  );

const decorateOrder = (o) => ({
  ...o,

  subtotal: o.subtotalCents / 100,
  tax: o.taxCents / 100,
  total: o.totalCents / 100,

  subtotalFormatted: formatMoney(o.subtotalCents, o.currencyCode),
  taxFormatted: formatMoney(o.taxCents, o.currencyCode),
  totalFormatted: formatMoney(o.totalCents, o.currencyCode),
});

// LIST + fileters (dateFrom/dateTo/updatedSince)
router.get("/", async (req, res) => {
  const take = Math.min(Math.max(parseInt(req.query.take ?? "50", 10), 0), 200);
  const skip = Math.max(parseInt(req.query.skip ?? "0", 10), 0);
  const { customerId, status, dateFrom, dateTo, updatedSince } = req.query;

  const where = {};
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;

  // range for createdAt
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (isNaN(d)) return res.status(400).json({ error: "InvalidDateFrom" });
      where.createdAt.gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (isNaN(d)) return res.status(400).json({ error: "InvalidDateTo" });
      where.createdAt.lte = d;
    }
  }

  // increment for updatedAt
  if (updatedSince) {
    const u = new Date(updatedSince);
    if (isNaN(u)) return res.status(400).json({ error: "InvalidUpdatedSince" });
    where.updatedAt = { gte: u };
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      include: { customer: true, items: { include: { product: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ items: items.map(decorateOrder), total, take, skip });
});

// DETAIL
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  });
  if (!order) return res.status(404).json({ error: "OrderNotFound" });

  res.json(decorateOrder(order));
});

// PATCH /api/v1/orders/:id  → change status a PAID o CANCELLED
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = orderStatusPatchSchema.parse(req.body);

    const current = await prisma.order.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "OrderNotFound" });

    //transactions rules
    const from = current.status;
    const to = status; // 'PAID' | 'CANCELLED'

    const canTransition = (from, to) => {
      if (from === "OPEN") return to === "PAID" || to === "CANCELLED";
      // we dont allow to move from PAID or CANCELLED
      return false;
    };

    if (!canTransition(from, to)) {
      return res
        .status(409)
        .json({ error: "InvalidStatusTransition", from, to });
    }

    // update
    const updated = await prisma.order.update({
      where: { id },
      data: { status: to },
      include: { customer: true, items: { include: { product: true } } },
    });

    res.json(decorateOrder(updated));
  } catch (err) {
    if (err?.name === "ZodError") {
      return res
        .status(400)
        .json({ error: "ValidationError", details: err.errors });
    }
    return res.status(500).json({ error: "InternalError" });
  }
});

// CREATE (items + total calculation)
router.post("/", async (req, res) => {
  try {
    // 0) Validation of payload
    const data = orderCreateSchema.parse(req.body);

    // 1) obtain product IDs
    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      return res.status(400).json({ error: "InvalidProductInItems" });
    }

    // 2) Reject inactive products
    const inactive = products.find((p) => p.active === false);
    if (inactive) {
      return res
        .status(400)
        .json({ error: "ProductInactive", productId: inactive.id });
    }

    // 3) Prepare lines with "frozen" price
    const priceMap = new Map(products.map((p) => [p.id, p.priceCents]));
    const itemsPrepared = data.items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      unitCents: priceMap.get(i.productId),
    }));

    // 4) Validations of lines
    for (const it of itemsPrepared) {
      if (typeof it.unitCents !== "number") {
        return res
          .status(400)
          .json({ error: "ProductPriceMissing", productId: it.productId });
      }
      if (!Number.isInteger(it.unitCents) || it.unitCents < 0) {
        return res
          .status(400)
          .json({ error: "InvalidUnitCents", productId: it.productId });
      }
      if (!Number.isInteger(it.qty) || it.qty <= 0) {
        return res
          .status(400)
          .json({ error: "InvalidQty", productId: it.productId });
      }
    }

    // 5) Merge duplicate lines for the same product
    const merged = new Map();
    for (const it of itemsPrepared) {
      const prev = merged.get(it.productId);
      merged.set(it.productId, prev ? { ...it, qty: prev.qty + it.qty } : it);
    }
    const finalItems = [...merged.values()];

    // 6) Subtotal + taxes + total (all in cents)
    const subtotalCents = finalItems.reduce(
      (acc, it) => acc + it.unitCents * it.qty,
      0
    );
    const taxCents = Math.round(subtotalCents * TAX_RATE);
    const totalCents = subtotalCents + taxCents;

    // 7) Transaction: create order + orderItems
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId: data.customerId,
          subtotalCents,
          taxRate: TAX_RATE, // ej. 0.21
          taxCents,
          totalCents,
          currencyCode: CURRENCY, // ISO-4217
          status: "OPEN",
        },
      });

      await tx.orderItem.createMany({
        data: finalItems.map((it) => ({ ...it, orderId: order.id })),
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: { customer: true, items: { include: { product: true } } },
      });
    });

    res.status(201).json(decorateOrder(created));
  } catch (err) {
    console.error("POST /orders error:", err);
    if (err?.name === "ZodError") {
      return res
        .status(400)
        .json({ error: "ValidationError", details: err.errors });
    }
    if (err?.code === "P2003") {
      // FK not valid (customer or product)
      return res.status(400).json({ error: "InvalidCustomerOrProduct" });
    }
    return res.status(500).json({ error: "InternalError" });
  }
});

module.exports = router;
