import { z } from "zod";

export const reviewInputSchema = z.object({
  user: z.string().trim().min(1).max(255),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000)
});

const productAttributeValueSchema = z.union([
  z.string().trim().min(1).max(255),
  z.number().finite(),
  z.boolean()
]);

export const createProductInputSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(3000),
  price: z.number().finite().min(0),
  category: z.string().trim().min(1).max(120),
  stock: z.number().int().min(0),
  attributes: z.record(z.string().trim().min(1).max(120), productAttributeValueSchema).default({}),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).default([])
});

export const seedInputSchema = z
  .object({
    count: z.number().int().min(10).max(10000).optional(),
    clear_existing: z.boolean().optional()
  })
  .optional();
