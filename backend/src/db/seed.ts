import type { Db } from "mongodb";
import type { ProductDoc, ReviewDoc } from "../types/domain.js";

type SeedOptions = {
  count: number;
  clearExisting: boolean;
};

const categories = [
  "Clothing",
  "Electronics",
  "Furniture",
  "Books",
  "Food",
  "Software",
  "Sports"
] as const;

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomPrice = (min: number, max: number): number =>
  Number((Math.random() * (max - min) + min).toFixed(2));

const maybeReviews = (): ReviewDoc[] => {
  const count = randomInt(0, 4);
  const reviews: ReviewDoc[] = [];

  for (let i = 0; i < count; i += 1) {
    reviews.push({
      user: pick(["Alex", "Sam", "Jamie", "Chris", "Taylor", "Nina", "Murat", "Lea"]),
      rating: randomInt(2, 5),
      comment: pick([
        "Sehr gutes Preis-Leistungs-Verhaeltnis.",
        "Erfuellt den Zweck perfekt.",
        "Wuerde ich wieder kaufen.",
        "Top Qualitaet fuer den Preis.",
        "Solides Produkt mit kleinen Schwaechen."
      ]),
      date: new Date(Date.now() - randomInt(1, 120) * 24 * 60 * 60 * 1000)
    });
  }

  return reviews;
};

const makeAttributes = (category: string, index: number): Record<string, string | number | boolean> => {
  switch (category) {
    case "Clothing":
      return {
        size: pick(["XS", "S", "M", "L", "XL"]),
        color: pick(["Black", "White", "Blue", "Green", "Red"]),
        material: pick(["Cotton", "Wool", "Polyester", "Linen"]),
        unisex: Math.random() > 0.35
      };
    case "Electronics":
      return {
        cpu: pick(["Apple M3", "Intel i7", "AMD Ryzen 7", "Snapdragon X"]),
        ram_gb: pick([8, 16, 32]),
        storage_gb: pick([256, 512, 1024]),
        warranty_years: pick([1, 2, 3])
      };
    case "Furniture":
      return {
        width_cm: randomInt(60, 220),
        depth_cm: randomInt(40, 120),
        height_cm: randomInt(35, 200),
        material: pick(["Wood", "Metal", "Glass", "Fabric"])
      };
    case "Books":
      return {
        author: pick(["Ada Novak", "L. Winter", "M. Hartmann", "R. Keller"]),
        pages: randomInt(120, 780),
        language: pick(["de", "en"]),
        hardcover: Math.random() > 0.5
      };
    case "Food":
      return {
        vegan: Math.random() > 0.4,
        weight_g: randomInt(200, 2000),
        origin: pick(["Germany", "Italy", "Spain", "France", "Japan"]),
        bio: Math.random() > 0.5
      };
    case "Software":
      return {
        license: pick(["monthly", "yearly", "lifetime"]),
        seats: pick([1, 3, 5, 10, 25]),
        platform: pick(["web", "desktop", "mobile", "cross-platform"]),
        cloud_sync: Math.random() > 0.4
      };
    default:
      return {
        type: pick(["running", "fitness", "team", "outdoor"]),
        level: pick(["beginner", "intermediate", "pro"]),
        waterproof: Math.random() > 0.5,
        weight_kg: Number((Math.random() * 30 + 0.5).toFixed(1))
      };
  }
};

const makeDocument = (index: number): Omit<ProductDoc, "_id"> => {
  const category = pick(categories);
  const now = new Date();
  const name = `${category} Showcase Item ${index + 1}`;
  const sku = `${category.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(5, "0")}`;

  return {
    sku,
    name,
    description: `Demo product ${index + 1} from category ${category} to showcase MongoDB flexible schema.`,
    price: randomPrice(9, 2999),
    category,
    stock: randomInt(0, 220),
    attributes: makeAttributes(category, index),
    reviews: maybeReviews(),
    tags: [category.toLowerCase(), pick(["showcase", "featured", "new", "trending"])],
    created_at: now,
    updated_at: now
  };
};

export const seedProducts = async (
  db: Db,
  options: SeedOptions
): Promise<{ insertedCount: number; cleared: boolean }> => {
  const collection = db.collection<Omit<ProductDoc, "_id">>("products");

  if (options.clearExisting) {
    await collection.deleteMany({});
  }

  const docs = Array.from({ length: options.count }, (_, i) => makeDocument(i));
  const result = await collection.insertMany(docs);

  return {
    insertedCount: result.insertedCount,
    cleared: options.clearExisting
  };
};
