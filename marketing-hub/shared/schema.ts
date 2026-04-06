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

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertGenerationSchema = createInsertSchema(generations).omit({ id: true });

export type Setting = typeof settings.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
