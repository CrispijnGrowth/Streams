import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("pending"),
  showDescriptions: boolean("show_descriptions").notNull().default(true),
  themePreference: text("theme_preference").notNull().default("system"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
