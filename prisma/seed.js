require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TAX_RATE = Math.min(
  Math.max(Number(process.env.TAX_RATE ?? "0.21"), 0),
  1
);
const CURRENCY = (
  /^[A-Za-z]{3}$/i.test(process.env.CURRENCY || "EUR")
    ? process.env.CURRENCY
    : "EUR"
).toUpperCase();

// --- Data Base example
const customersSeed = [
  { email: "ada@example.com", name: "Ada Lovelace", phone: "+34600123456" },
  { email: "alan@example.com", name: "Alan Turing", phone: "+34600222333" },
  { email: "grace@example.com", name: "Grace Hopper", phone: "+34600333444" },
  { email: "linus@example.com", name: "Linus Torvalds", phone: "+34600444555" },
  {
    email: "margaret@example.com",
    name: "Margaret Hamilton",
    phone: "+34600555666",
  },
  {
    email: "barbara@example.com",
    name: "Barbara Liskov",
    phone: "+34600666777",
  },
  { email: "donald@example.com", name: "Donald Knuth", phone: "+34600777888" },
  {
    email: "katherine@example.com",
    name: "Katherine Johnson",
    phone: "+34600888999",
  },
  {
    email: "dennis@example.com",
    name: "Dennis Ritchie",
    phone: "+34600999000",
  },
  { email: "jorn@example.com", name: "Jorn Barger", phone: "+34600000111" },
];

const productsSeed = [
  { sku: "P001", name: "Haircut 30 min", priceCents: 1500, active: true },
  { sku: "P002", name: "Shaving Kit", priceCents: 2500, active: true },
  { sku: "P003", name: "Beard Trim", priceCents: 1200, active: true },
  { sku: "P004", name: "Coloring", priceCents: 4500, active: true },
  { sku: "P005", name: "Hair Wash", priceCents: 800, active: true },
  { sku: "P006", name: "Haircut 60 min", priceCents: 2800, active: true },
  { sku: "P007", name: "Aftershave Balm", priceCents: 900, active: true },
  { sku: "P008", name: "Gift Card 25€", priceCents: 2500, active: true },
];

// Utility function for random integers
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  console.log("Seeding…");

  // 1) Customers (upsert per email)
  const customers = [];
  for (const c of customersSeed) {
    const u = await prisma.customer.upsert({
      where: { email: c.email },
      update: { name: c.name, phone: c.phone },
      create: { email: c.email, name: c.name, phone: c.phone },
    });
    customers.push(u);
  }
  console.log(`Customers ok: ${customers.length}`);

  // 2) Products (upsert per sku)
  for (const p of productsSeed) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { name: p.name, priceCents: p.priceCents, active: p.active },
      create: { ...p },
    });
  }
  const products = await prisma.product.findMany({ where: { active: true } });
  console.log(`Products ok: ${products.length}`);

  // 3) (Optional) delete previous orders/reservations if you want a “demo” state

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();

  // 4) Demo Orders
  for (let i = 0; i < 12; i++) {
    const customer = customers[randInt(0, customers.length - 1)];

    // 1–3 lines per order
    const numItems = randInt(1, 3);
    const chosen = [];
    const usedIdx = new Set();
    while (chosen.length < numItems) {
      const idx = randInt(0, products.length - 1);
      if (!usedIdx.has(idx)) {
        usedIdx.add(idx);
        chosen.push(products[idx]);
      }
    }

    const finalItems = chosen.map((p) => ({
      productId: p.id,
      qty: randInt(1, 3),
      unitCents: p.priceCents,
    }));

    const subtotalCents = finalItems.reduce(
      (acc, it) => acc + it.unitCents * it.qty,
      0
    );
    const taxCents = Math.round(subtotalCents * TAX_RATE);
    const totalCents = subtotalCents + taxCents;

    // crea order + items
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        subtotalCents,
        taxRate: TAX_RATE,
        taxCents,
        totalCents,
        currencyCode: CURRENCY,
        status: i % 4 === 0 ? "PAID" : "OPEN", // some paid, others open
      },
    });

    await prisma.orderItem.createMany({
      data: finalItems.map((it) => ({ ...it, orderId: order.id })),
    });
  }
  console.log("Orders ok: 12");

  // 5) Reservations demo (15 non-overlapping simple reservations)
  // For each one, 30–90 minutes from today ± 10 days
  const now = new Date();
  for (let i = 0; i < 15; i++) {
    const customer = customers[randInt(0, customers.length - 1)];
    const start = new Date(now);
    start.setDate(now.getDate() + randInt(-10, 10));
    start.setHours(randInt(9, 19), [0, 15, 30, 45][randInt(0, 3)], 0, 0);
    const durationMin = [30, 45, 60, 90][randInt(0, 3)];
    const end = new Date(start.getTime() + durationMin * 60000);

    await prisma.reservation.create({
      data: {
        customerId: customer.id,
        startAt: start,
        endAt: end,
        partySize: randInt(1, 4),
        status: ["PENDING", "CONFIRMED", "CANCELLED"][randInt(0, 2)],
      },
    });
  }
  console.log("Reservations ok: 15");

  console.log("✅ Seed completado");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
