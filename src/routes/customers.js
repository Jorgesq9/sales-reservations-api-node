const express = require("express");
const { prisma } = require("../prisma");
const { customerCreateSchema } = require("../validators");
const router = express.Router();

//list

router.get("/", async (req, res) => {
  const take = Math.min(parseInt(req.query.take ?? "50", 10), 200);
  const skip = parseInt(req.query.skip ?? "0", 10);
  const q = req.query.q?.trim();

  const where = q
    ? {
        OR: [{ name: { contains: q } }, { email: { contains: q } }],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({ items, total, take, skip });
});

//Create

router.post("/", async (req, res) => {
  // 1) Validation without exceptions
  const parsed = customerCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "ValidationError",
      details: parsed.error.issues,
    });
  }

  try {
    // 2) Create register
    const created = await prisma.customer.create({ data: parsed.data });
    return res.status(201).json(created);
  } catch (error) {
    // 3) Prisma: unique constraint (email)
    if (error?.code === "P2002") {
      return res.status(409).json({
        error: "Conflict",
        details: "Email already exists",
      });
    }
    // 4) Fallback controlled
    return res.status(500).json({ error: "InternalServerError" });
  }
});

module.exports = router;
