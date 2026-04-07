import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// API settings (stores the LLM API key and provider)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// Saved copy generations (history)
export const generations = sqliteTable("generations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  icp: text("icp").notNull(),       // buyer | seller | concierge
  angle: text("angle"),
  context: text("context"),
  result: text("result").notNull(), // JSON stringified GeneratedCopy
  createdAt: integer("created_at").notNull(),
});

// Competitor tracking
export const competitors = sqliteTable("competitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  pageId: text("page_id").notNull().unique(),  // Meta Page ID / search term
  active: integer("active").notNull().default(1),
});

// Competitor ad analysis digests
export const adDigests = sqliteTable("ad_digests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  generatedAt: integer("generated_at").notNull(),
  summary: text("summary").notNull(),       // JSON: full LLM analysis
  rawAdsCount: integer("raw_ads_count").notNull().default(0),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertGenerationSchema = createInsertSchema(generations).omit({ id: true });
export const insertCompetitorSchema = createInsertSchema(competitors).omit({ id: true });
export const insertAdDigestSchema = createInsertSchema(adDigests).omit({ id: true });

export type Setting = typeof settings.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type Competitor = typeof competitors.$inferSelect;
export type AdDigest = typeof adDigests.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type InsertAdDigest = z.infer<typeof insertAdDigestSchema>;
