import type { Db } from "mongodb";
import type { ProductDoc, ReviewDoc } from "../types/domain.js";

export type SeedOptions = {
  count: number;
  clearExisting: boolean;
  seed?: number;
};

export type SeedProductDoc = Omit<ProductDoc, "_id">;

const categories = [
  "Clothing",
  "Electronics",
  "Furniture",
  "Books",
  "Food",
  "Software",
  "Sports"
] as const;

const defaultSeed = 20260503;
const baseDate = new Date("2026-05-03T12:00:00.000Z");

const createRandom = (seed: number) => {
  let value = seed >>> 0;

  return (): number => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

type RandomFn = ReturnType<typeof createRandom>;

const pick = <T>(list: readonly T[], random: RandomFn): T => list[Math.floor(random() * list.length)];

const randomInt = (min: number, max: number, random: RandomFn): number =>
  Math.floor(random() * (max - min + 1)) + min;

const randomPrice = (min: number, max: number, random: RandomFn): number =>
  Number((random() * (max - min) + min).toFixed(2));

const maybeReviews = (random: RandomFn): ReviewDoc[] => {
  const count = randomInt(0, 4, random);
  const reviews: ReviewDoc[] = [];

  for (let i = 0; i < count; i += 1) {
    reviews.push({
      user: pick(["Alex", "Sam", "Jamie", "Chris", "Taylor", "Nina", "Murat", "Lea"], random),
      rating: randomInt(2, 5, random),
      comment: pick([
        "Sehr gutes Preis-Leistungs-Verhaeltnis.",
        "Erfuellt den Zweck perfekt.",
        "Wuerde ich wieder kaufen.",
        "Top Qualitaet fuer den Preis.",
        "Solides Produkt mit kleinen Schwaechen."
      ], random),
      date: new Date(baseDate.getTime() - randomInt(1, 120, random) * 24 * 60 * 60 * 1000)
    });
  }

  return reviews;
};

const makeAttributes = (category: string, random: RandomFn): Record<string, string | number | boolean> => {
  switch (category) {
    case "Clothing":
      return {
        size: pick(["XS", "S", "M", "L", "XL"], random),
        color: pick(["Black", "White", "Blue", "Green", "Red"], random),
        material: pick(["Cotton", "Wool", "Polyester", "Linen"], random),
        unisex: random() > 0.35
      };
    case "Electronics":
      return {
        cpu: pick(["Apple M3", "Intel i7", "AMD Ryzen 7", "Snapdragon X"], random),
        ram_gb: pick([8, 16, 32], random),
        storage_gb: pick([256, 512, 1024], random),
        warranty_years: pick([1, 2, 3], random)
      };
    case "Furniture":
      return {
        width_cm: randomInt(60, 220, random),
        depth_cm: randomInt(40, 120, random),
        height_cm: randomInt(35, 200, random),
        material: pick(["Wood", "Metal", "Glass", "Fabric"], random)
      };
    case "Books":
      return {
        author: pick(["Ada Novak", "L. Winter", "M. Hartmann", "R. Keller"], random),
        pages: randomInt(120, 780, random),
        language: pick(["de", "en"], random),
        hardcover: random() > 0.5
      };
    case "Food":
      return {
        vegan: random() > 0.4,
        weight_g: randomInt(200, 2000, random),
        origin: pick(["Germany", "Italy", "Spain", "France", "Japan"], random),
        bio: random() > 0.5
      };
    case "Software":
      return {
        license: pick(["monthly", "yearly", "lifetime"], random),
        seats: pick([1, 3, 5, 10, 25], random),
        platform: pick(["web", "desktop", "mobile", "cross-platform"], random),
        cloud_sync: random() > 0.4
      };
    default:
      return {
        type: pick(["running", "fitness", "team", "outdoor"], random),
        level: pick(["beginner", "intermediate", "pro"], random),
        waterproof: random() > 0.5,
        weight_kg: Number((random() * 30 + 0.5).toFixed(1))
      };
  }
};

const makeDocument = (index: number, random: RandomFn): SeedProductDoc => {
  const category = pick(categories, random);
  const now = new Date(baseDate.getTime() - index * 60 * 1000);
  const name = `${category} Showcase Item ${index + 1}`;
  const sku = `${category.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(5, "0")}`;

  return {
    sku,
    name,
    description: `Demo product ${index + 1} from category ${category} for the database model comparison.`,
    price: randomPrice(9, 2999, random),
    category,
    stock: randomInt(0, 220, random),
    attributes: makeAttributes(category, random),
    reviews: maybeReviews(random),
    tags: [category.toLowerCase(), pick(["showcase", "featured", "new", "trending"], random)],
    created_at: now,
    updated_at: now
  };
};

export const generateSeedProducts = (count: number, seed = defaultSeed): SeedProductDoc[] => {
  const random = createRandom(seed);
  return Array.from({ length: count }, (_, i) => makeDocument(i, random));
};

export const seedProducts = async (
  db: Db,
  options: SeedOptions
): Promise<{ insertedCount: number; cleared: boolean }> => {
  const collection = db.collection<Omit<ProductDoc, "_id">>("products");

  if (options.clearExisting) {
    await collection.deleteMany({});
  }

  const docs = generateSeedProducts(options.count, options.seed);
  const result = await collection.insertMany(docs);

  return {
    insertedCount: result.insertedCount,
    cleared: options.clearExisting
  };
};
