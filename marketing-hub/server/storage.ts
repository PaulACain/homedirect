import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import {
  settings, generations, competitors, adDigests,
  type Setting, type Generation, type InsertGeneration,
  type Competitor, type InsertCompetitor,
  type AdDigest, type InsertAdDigest,
} from "@shared/schema";

const sqlite = new Database("marketing-hub.db");
const db = drizzle(sqlite);

// Auto-create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icp TEXT NOT NULL,
    angle TEXT,
    context TEXT,
    result TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    page_id TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS ad_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at INTEGER NOT NULL,
    summary TEXT NOT NULL,
    raw_ads_count INTEGER NOT NULL DEFAULT 0
  );
`);

// Seed default competitors if none exist
const existingCompetitors = sqlite.prepare("SELECT COUNT(*) as cnt FROM competitors").get() as { cnt: number };
if (existingCompetitors.cnt === 0) {
  const seedData = [
    { name: "Zillow",              page_id: "zillow"          },
    { name: "Redfin",              page_id: "redfin"          },
    { name: "Opendoor",            page_id: "opendoor"        },
    { name: "ForSaleByOwner.com",  page_id: "forsalebyowner"  },
    { name: "Houzeo",              page_id: "houzeo"          },
  ];
  for (const c of seedData) {
    sqlite.prepare("INSERT OR IGNORE INTO competitors (name, page_id, active) VALUES (?, ?, 1)").run(c.name, c.page_id);
  }
}

export interface IStorage {
  getSetting(key: string): Setting | undefined;
  setSetting(key: string, value: string): void;
  saveGeneration(data: InsertGeneration): Generation;
  getGenerations(limit?: number): Generation[];
  deleteGeneration(id: number): void;
  // Competitors
  getCompetitors(): Competitor[];
  // Ad Digests
  saveAdDigest(data: InsertAdDigest): AdDigest;
  getAdDigests(limit?: number): AdDigest[];
  getAdDigest(id: number): AdDigest | undefined;
}

export const storage: IStorage = {
  getSetting(key) {
    return db.select().from(settings).where(eq(settings.key, key)).get();
  },
  setSetting(key, value) {
    const existing = db.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    } else {
      db.insert(settings).values({ key, value }).run();
    }
  },
  saveGeneration(data) {
    return db.insert(generations).values(data).returning().get();
  },
  getGenerations(limit = 20) {
    return db.select().from(generations)
      .orderBy(generations.createdAt)
      .all()
      .reverse()
      .slice(0, limit);
  },
  deleteGeneration(id) {
    db.delete(generations).where(eq(generations.id, id)).run();
  },
  getCompetitors() {
    return db.select().from(competitors).where(eq(competitors.active, 1)).all();
  },
  saveAdDigest(data) {
    return db.insert(adDigests).values(data).returning().get();
  },
  getAdDigests(limit = 10) {
    return db.select().from(adDigests)
      .orderBy(adDigests.generatedAt)
      .all()
      .reverse()
      .slice(0, limit);
  },
  getAdDigest(id) {
    return db.select().from(adDigests).where(eq(adDigests.id, id)).get();
  },
};
