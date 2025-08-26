const express = require("express");
const { prisma } = require("../prisma");
const { reservationCreateSchema } = require("../validators");
const router = express.Router();

// list with filters

router.get("/", async (req, res) => {
  const take = Math.min(parseInt(req.query.take ?? "50", 10), 200);
  const skip = parseInt(req.query.skip ?? "0", 10);
  const { customerId, status, dateFrom, dateTo } = req.query;

  const where = {};
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.AND = [];
    if (dateFrom) where.AND.push({ startAt: { gte: new Date(dateFrom) } });
    if (dateTo) where.AND.push({ endAt: { lte: new Date(dateTo) } });
  }

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      take,
      skip,
      orderBy: { startAt: "desc" },
      include: { customer: true },
    }),
    prisma.reservation.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

// Create (protected by x-api-key via global middleware)
router.post("/", async (req, res) => {
  try {
    const data = reservationCreateSchema.parse(req.body);

    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (isNaN(startAt) || isNaN(endAt)) {
      return res.status(400).json({ error: "InvalidDate" });
    }
    if (startAt >= endAt) {
      return res.status(400).json({ error: "startAt_must_be_before_endAt" });
    }

    // Block overlapping reservations for the SAME customer in active status
    const overlap = await prisma.reservation.findFirst({
      where: {
        customerId: data.customerId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (overlap)
      return res.status(409).json({ error: "OverlappingReservation" });

    const created = await prisma.reservation.create({
      data: {
        customerId: data.customerId,
        startAt,
        endAt,
        partySize: data.partySize ?? 1,
        notes: data.notes,
      },
      include: { customer: true },
    });

    res.status(201).json(created);
  } catch (err) {
    if (err?.name === "ZodError")
      return res
        .status(400)
        .json({ error: "ValidationError", details: err.errors });
    // Invalid FK (customerId does not exist)
    if (err?.code === "P2003")
      return res.status(400).json({ error: "InvalidCustomer" });
    res.status(500).json({ error: "InternalError" });
  }
});

module.exports = router;
