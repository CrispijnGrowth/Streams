import { randomUUID, randomBytes, createHash } from "crypto";
import type { User, MagicLinkToken, Session, InsertUser } from "@shared/schema";
import { UserRole } from "@shared/schema";
import { db } from "./db";
import { users } from "./db-schema";
import { eq, ilike } from "drizzle-orm";

const MAGIC_LINK_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FIRST_ADMIN_EMAIL = "maarten.bal@capgemini.com";

class AuthStorage {
  private magicTokens: Map<string, MagicLinkToken> = new Map();
  private sessions: Map<string, Session> = new Map();

  private dbUserToUser(dbUser: typeof users.$inferSelect): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as User["role"],
      showDescriptions: dbUser.showDescriptions,
      themePreference: dbUser.themePreference as User["themePreference"],
      createdAt: dbUser.createdAt.toISOString(),
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

  async createUser(data: InsertUser): Promise<User> {
    const id = randomUUID();
    const isFirstAdmin = data.email.toLowerCase() === FIRST_ADMIN_EMAIL.toLowerCase();
    const [newUser] = await db.insert(users).values({
      id,
      email: data.email,
      name: data.name,
      role: isFirstAdmin ? UserRole.ADMIN : UserRole.PENDING,
      showDescriptions: true,
      themePreference: "system",
    }).returning();
    return this.dbUserToUser(newUser);
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
    this.sessions.set(id, session);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (session && new Date(session.expiresAt) > new Date()) {
      return session;
    }
    if (session) {
      this.sessions.delete(sessionId);
    }
    return undefined;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }
}

export const authStorage = new AuthStorage();

export function generateMagicLinkUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/auth/verify?token=${token}`;
}
