import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users ───────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("buyer"), // buyer | seller | chaperone | admin
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  location: text("location"),
  isVerified: integer("is_verified", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().default(""),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Listings ────────────────────────────────────────────────────────────
export const listings = sqliteTable("listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  price: real("price").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: real("bathrooms").notNull(),
  sqft: integer("sqft").notNull(),
  lotSize: real("lot_size"),
  yearBuilt: integer("year_built"),
  propertyType: text("property_type").notNull().default("single_family"), // single_family | condo | townhouse | multi_family
  status: text("status").notNull().default("active"), // active | pending | sold | withdrawn
  images: text("images").notNull().default("[]"), // JSON array of image URLs
  features: text("features").notNull().default("[]"), // JSON array of feature strings
  latitude: real("latitude"),
  longitude: real("longitude"),
  mlsNumber: text("mls_number"),
  hoaFee: real("hoa_fee"),
  taxAmount: real("tax_amount"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertListingSchema = createInsertSchema(listings).omit({ id: true, createdAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listings.$inferSelect;

// ── Offers ──────────────────────────────────────────────────────────────
export const offers = sqliteTable("offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"), // pending | countered | accepted | rejected | withdrawn
  message: text("message"),
  contingencies: text("contingencies").notNull().default("[]"), // JSON array
  closingDate: text("closing_date"),
  counterAmount: real("counter_amount"),
  counterMessage: text("counter_message"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true });
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offers.$inferSelect;

// ── Walkthroughs ────────────────────────────────────────────────────────
export const walkthroughs = sqliteTable("walkthroughs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  chaperoneId: integer("chaperone_id"),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  status: text("status").notNull().default("requested"), // requested | assigned | confirmed | completed | cancelled
  chaperonePayment: real("chaperone_payment").notNull().default(20),
  buyerNotes: text("buyer_notes"),
  chaperoneNotes: text("chaperone_notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertWalkthroughSchema = createInsertSchema(walkthroughs).omit({ id: true, createdAt: true });
export type InsertWalkthrough = z.infer<typeof insertWalkthroughSchema>;
export type Walkthrough = typeof walkthroughs.$inferSelect;

// ── Documents ───────────────────────────────────────────────────────────
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").notNull(),
  offerId: integer("offer_id"),
  type: text("type").notNull(), // disclosure | title | contract | inspection | appraisal | closing
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft | pending_review | signed | completed
  content: text("content"), // JSON content for form-based docs
  signedByBuyer: integer("signed_by_buyer", { mode: "boolean" }).default(false),
  signedBySeller: integer("signed_by_seller", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().default(""),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ── Messages (AI negotiation chat) ──────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  offerId: integer("offer_id").notNull(),
  senderId: integer("sender_id"), // null for AI messages
  senderType: text("sender_type").notNull().default("user"), // user | ai
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(""),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ── Transactions ────────────────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").notNull(),
  offerId: integer("offer_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  salePrice: real("sale_price").notNull(),
  platformFee: real("platform_fee").notNull(), // 1% of sale price
  status: text("status").notNull().default("in_progress"), // in_progress | closing | completed | cancelled
  closingDate: text("closing_date"),
  escrowStatus: text("escrow_status").default("not_started"), // not_started | opened | funded | disbursed
  titleStatus: text("title_status").default("not_started"), // not_started | ordered | clear | issues
  inspectionStatus: text("inspection_status").default("not_started"),
  appraisalStatus: text("appraisal_status").default("not_started"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// ── Saved Searches ──────────────────────────────────────────────────────
export const savedSearches = sqliteTable("saved_searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  filters: text("filters").notNull().default("{}"), // JSON search criteria
  createdAt: text("created_at").notNull().default(""),
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true });
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;

// ── Favorites ───────────────────────────────────────────────────────────
export const favorites = sqliteTable("favorites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  listingId: integer("listing_id").notNull(),
  createdAt: text("created_at").notNull().default(""),
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;
