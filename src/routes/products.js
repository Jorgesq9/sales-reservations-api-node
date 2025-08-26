const express = require("express");
const { prisma } = require("../prisma");
const { productCreateSchema } = require("../validators");
const router = express.Router();

//list
router.get("/", async (req, res) => {
  const take = Math.min(parseInt(req.query.take ?? "50", 10), 200);
  const skip = parseInt(req.query.skip ?? "0", 10);
  const q = req.query.q?.trim();

  const where = q
    ? {
        OR: [{ name: { contains: q } }, { sku: { contains: q } }],
      }
    : {};

  // Fetch data
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

router.post("/", async (req, res) => {
  // 1) Validation without exceptions
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "ValidationError",
      details: parsed.error.issues,
    });
  }

  try {
    // 2) Create register
    const created = await prisma.product.create({ data: parsed.data });
    return res.status(201).json(created);
  } catch (error) {
    // 3) Prisma: unique constraint (SKU)
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: "Conflict",
        details: "SKU already exists",
      });
    }
    // 4) Fallback controlled
    return res.status(500).json({ error: "InternalServerError" });
  }
});

module.exports = router;
