import { z } from "zod";

export const reviewInputSchema = z.object({
  user: z.string().trim().min(1).max(255),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000)
});

export const seedInputSchema = z
  .object({
    count: z.number().int().min(10).max(10000).optional(),
    clear_existing: z.boolean().optional()
  })
  .optional();
