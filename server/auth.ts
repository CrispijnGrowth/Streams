import { randomUUID, randomBytes, createHash } from "crypto";
import bcrypt from "bcrypt";
import type { User, MagicLinkToken, Session, InsertUser } from "@shared/schema";
import { UserRole, users, sessions } from "@shared/schema";
import { db } from "./db";
import { eq, ilike, lt } from "drizzle-orm";

const MAGIC_LINK_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FIRST_ADMIN_EMAIL = "maarten.bal@capgemini.com";
const BCRYPT_ROUNDS = 12;

class AuthStorage {
  private magicTokens: Map<string, MagicLinkToken> = new Map();

  private dbUserToUser(dbUser: typeof users.$inferSelect): User {
    const createdAt = dbUser.createdAt instanceof Date 
      ? dbUser.createdAt.toISOString() 
      : new Date(dbUser.createdAt).toISOString();
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as User["role"],
      showDescriptions: dbUser.showDescriptions,
      themePreference: dbUser.themePreference as User["themePreference"],
      createdAt,
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(ilike(users.email, email)).limit(1);
    if (result.length === 0) return undefined;
    return this.dbUserToUser(result[0]);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (result.length === 0) return undefined;
    return this.dbUserToUser(result[0]);
  }

  async getUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result.map(u => this.dbUserToUser(u));
  }

  async getPendingUsers(): Promise<User[]> {
    const result = await db.select().from(users).where(eq(users.role, UserRole.PENDING));
    return result.map(u => this.dbUserToUser(u));
  }

  async createUser(data: InsertUser, password: string): Promise<User> {
    const id = randomUUID();
    const isFirstAdmin = data.email.toLowerCase() === FIRST_ADMIN_EMAIL.toLowerCase();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [newUser] = await db.insert(users).values({
      id,
      email: data.email,
      name: data.name,
      passwordHash,
      role: isFirstAdmin ? UserRole.ADMIN : UserRole.PENDING,
      showDescriptions: true,
      themePreference: "system",
    }).returning();
    return this.dbUserToUser(newUser);
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const result = await db.select().from(users).where(ilike(users.email, email)).limit(1);
    if (result.length === 0) return null;
    const dbUser = result[0];
    if (!dbUser.passwordHash) return null;
    const isValid = await bcrypt.compare(password, dbUser.passwordHash);
    if (!isValid) return null;
    return this.dbUserToUser(dbUser);
  }

  async updatePassword(userId: string, password: string): Promise<boolean> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [updated] = await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
      .returning();
    return !!updated;
  }

  async approveUser(userId: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ role: UserRole.MEMBER })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) return undefined;
    return this.dbUserToUser(updated);
  }

  async updateUserPreferences(
    userId: string,
    prefs: { showDescriptions?: boolean; themePreference?: string }
  ): Promise<User | undefined> {
    const updateData: Partial<typeof users.$inferInsert> = {};
    if (prefs.showDescriptions !== undefined) {
      updateData.showDescriptions = prefs.showDescriptions;
    }
    if (prefs.themePreference !== undefined) {
      updateData.themePreference = prefs.themePreference;
    }
    const [updated] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    if (!updated) return undefined;
    return this.dbUserToUser(updated);
  }

  async createMagicToken(email: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(token).digest("hex");
    const id = randomUUID();
    const magicToken: MagicLinkToken = {
      id,
      email,
      token: hashedToken,
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    };
    this.magicTokens.set(id, magicToken);
    return token;
  }

  async validateMagicToken(token: string): Promise<MagicLinkToken | undefined> {
    const hashedToken = createHash("sha256").update(token).digest("hex");
    for (const mt of this.magicTokens.values()) {
      if (mt.token === hashedToken && !mt.used && new Date(mt.expiresAt) > new Date()) {
        mt.used = true;
        return mt;
      }
    }
    return undefined;
  }

  async createSession(userId: string): Promise<Session> {
    const id = randomUUID();
    const session: Session = {
      id,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      createdAt: new Date().toISOString(),
    };
    await db.insert(sessions).values(session);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (result.length === 0) return undefined;
    const session = result[0];
    if (new Date(session.expiresAt) > new Date()) {
      return session;
    }
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return undefined;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, sessionId)).returning();
    return result.length > 0;
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date().toISOString();
    const result = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning();
    return result.length;
  }
}

export const authStorage = new AuthStorage();

export function generateMagicLinkUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/auth/verify?token=${token}`;
}
