import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { settings, generations, type Setting, type Generation, type InsertGeneration } from "@shared/schema";

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
`);

export interface IStorage {
  getSetting(key: string): Setting | undefined;
  setSetting(key: string, value: string): void;
  saveGeneration(data: InsertGeneration): Generation;
  getGenerations(limit?: number): Generation[];
  deleteGeneration(id: number): void;
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
};
