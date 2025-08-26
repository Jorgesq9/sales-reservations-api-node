const { z } = require("zod");

const customerCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().max(30).optional(),
  notes: z.string().optional(),
});

const productCreateSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  active: z.boolean().optional(),
});

const reservationCreateSchema = z.object({
  customerId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  partySize: z.number().int().positive().optional(), // default en DB = 1
  notes: z.string().optional(),
});

const orderCreateSchema = z.object({
  customerId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive().default(1),
      })
    )
    .min(1),
});

const orderStatusPatchSchema = z.object({
  status: z.enum(["PAID", "CANCELLED"]),
});

module.exports = {
  customerCreateSchema,
  productCreateSchema,
  reservationCreateSchema,
  orderCreateSchema,
  orderStatusPatchSchema,
};
