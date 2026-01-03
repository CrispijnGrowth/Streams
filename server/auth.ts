import { randomUUID, randomBytes, createHash } from "crypto";
import type { User, MagicLinkToken, Session, InsertUser } from "@shared/schema";
import { UserRole } from "@shared/schema";

const MAGIC_LINK_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FIRST_ADMIN_EMAIL = "maarten.bal@capgemini.com";

class AuthStorage {
  private users: Map<string, User> = new Map();
  private magicTokens: Map<string, MagicLinkToken> = new Map();
  private sessions: Map<string, Session> = new Map();

  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getPendingUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.role === UserRole.PENDING);
  }

  async createUser(data: InsertUser): Promise<User> {
    const id = randomUUID();
    const isFirstAdmin = data.email.toLowerCase() === FIRST_ADMIN_EMAIL.toLowerCase();
    const user: User = {
      id,
      email: data.email,
      name: data.name,
      role: isFirstAdmin ? UserRole.ADMIN : UserRole.PENDING,
      showDescriptions: true,
      themePreference: "system",
      createdAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    return user;
  }

  async approveUser(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    user.role = UserRole.MEMBER;
    return user;
  }

  async updateUserPreferences(
    userId: string,
    prefs: { showDescriptions?: boolean; themePreference?: string }
  ): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    if (prefs.showDescriptions !== undefined) {
      user.showDescriptions = prefs.showDescriptions;
    }
    if (prefs.themePreference !== undefined) {
      user.themePreference = prefs.themePreference as "light" | "dark" | "system";
    }
    return user;
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
