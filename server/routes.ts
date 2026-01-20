import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import XLSX from "xlsx";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { authStorage, generateMagicLinkUrl } from "./auth";
import { sendMagicLinkEmail, sendNewUserNotification, sendApprovalEmail } from "./email";
import {
  insertStreamSchema,
  insertSolutionSchema,
  insertDeliverableSchema,
  insertActionSchema,
  insertStepSchema,
  insertCommentSchema,
  insertTeamMemberSchema,
  insertStakeholderSchema,
  insertStakeholderTagSchema,
  insertMeetingSchema,
  insertMeetingItemSchema,
  insertViewerSchema,
  type InsertViewer,
  insertUserSchema,
  UserRole,
  CommentEntityType,
  TagEntityType,
  ViewerEntityType,
  ActionStatus,
  MomentumStatus,
  SolutionStatus,
  type TagEntityTypeValue,
  type ViewerEntityTypeValue,
} from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers["x-session-id"] as string;
  if (!sessionId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const session = await authStorage.getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const user = await authStorage.getUserById(session.userId);
  if (!user || user.role === UserRole.PENDING) {
    return res.status(403).json({ error: "Account pending approval" });
  }
  req.userId = session.userId;
  next();
}

async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = await authStorage.getUserById(req.userId!);
  if (!user || user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, name, password } = req.body;
      if (!email || !name || !password) {
        return res.status(400).json({ error: "Email, name, and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        // If user was deactivated, reactivate them with new credentials
        if (existing.isDeactivated) {
          const reactivated = await authStorage.reactivateUserWithNewPassword(existing.id, name, password);
          if (!reactivated) {
            return res.status(500).json({ error: "Failed to reactivate account" });
          }
          // Notify admin about reactivation request
          sendNewUserNotification(name, email).catch(err => 
            console.error("[Auth] Failed to notify admin:", err)
          );
          return res.status(201).json({ 
            message: "Account reactivated. Awaiting admin approval.",
            user: { id: reactivated.id, email: reactivated.email, name: reactivated.name, role: reactivated.role }
          });
        }
        return res.status(400).json({ error: "Email already registered" });
      }
      const user = await authStorage.createUser({ email, name }, password);
      if (user.role === UserRole.PENDING) {
        sendNewUserNotification(user.name, user.email).catch(err => 
          console.error("[Auth] Failed to notify admin:", err)
        );
      }
      res.status(201).json({ 
        message: user.role === UserRole.ADMIN 
          ? "Admin account created. You can now login." 
          : "Registration submitted. Awaiting admin approval.",
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const user = await authStorage.verifyPassword(email, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (user.role === UserRole.PENDING) {
        return res.status(403).json({ error: "Account pending admin approval" });
      }
      const session = await authStorage.createSession(user.id);
      // Only seed example data if user has no visible content (owned or shared)
      const hasContent = await storage.userHasVisibleContent(user.id);
      if (!hasContent) {
        await storage.seedExampleData(user.id);
      }
      res.json({ 
        sessionId: session.id, 
        user: { id: user.id, email: user.email, name: user.name, role: user.role, showDescriptions: user.showDescriptions, themePreference: user.themePreference, avatarData: user.avatarData }
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const user = await authStorage.getUserByEmail(email);
      if (!user) {
        res.json({ message: "If an account exists with this email, a reset link will be sent." });
        return;
      }
      const token = await authStorage.createMagicToken(email);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;
      if (process.env.NODE_ENV === "development") {
        console.log(`[Auth] Password reset link for ${email}: ${resetLink}`);
      }
      const emailSent = await sendMagicLinkEmail(user.email, resetLink, user.name);
      if (process.env.NODE_ENV === "development") {
        res.json({ 
          message: "If an account exists with this email, a reset link will be sent.",
          debug: resetLink 
        });
      } else {
        res.json({ message: "If an account exists with this email, a reset link will be sent." });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const magicToken = await authStorage.validateMagicToken(token);
      if (!magicToken) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }
      const user = await authStorage.getUserByEmail(magicToken.email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      await authStorage.updatePassword(user.id, password);
      res.json({ message: "Password updated successfully. You can now login." });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }
      const magicToken = await authStorage.validateMagicToken(token);
      if (!magicToken) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }
      const user = await authStorage.getUserByEmail(magicToken.email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const session = await authStorage.createSession(user.id);
      res.json({ 
        sessionId: session.id, 
        user: { id: user.id, email: user.email, name: user.name, role: user.role, showDescriptions: user.showDescriptions, themePreference: user.themePreference }
      });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const sessionId = req.headers["x-session-id"] as string;
    if (sessionId) {
      await authStorage.deleteSession(sessionId);
    }
    res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", async (req, res) => {
    const sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const session = await authStorage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    const user = await authStorage.getUserById(session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, showDescriptions: user.showDescriptions, themePreference: user.themePreference, avatarData: user.avatarData });
  });

  app.patch("/api/auth/preferences", async (req, res) => {
    const sessionId = req.headers["x-session-id"] as string;
    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const session = await authStorage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    const user = await authStorage.updateUserPreferences(session.userId, req.body);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, showDescriptions: user.showDescriptions, themePreference: user.themePreference, avatarData: user.avatarData });
  });

  const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
      }
    },
  });

  app.post("/api/auth/avatar", authMiddleware, avatarUpload.single("avatar"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      const base64Data = req.file.buffer.toString("base64");
      const avatarData = `data:${req.file.mimetype};base64,${base64Data}`;
      const user = await authStorage.updateUserAvatar(req.userId!, avatarData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Sync avatar to linked team member
      await storage.syncUserToLinkedTeamMember(user.id, user.email, { avatarData });
      
      res.json({ 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        showDescriptions: user.showDescriptions, 
        themePreference: user.themePreference,
        avatarData: user.avatarData 
      });
    } catch (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File size must be less than 2MB" });
        }
      }
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  app.delete("/api/auth/avatar", authMiddleware, async (req, res) => {
    try {
      const user = await authStorage.updateUserAvatar(req.userId!, null);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Sync avatar removal to linked team member
      await storage.syncUserToLinkedTeamMember(user.id, user.email, { avatarData: null });
      
      res.json({ 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        showDescriptions: user.showDescriptions, 
        themePreference: user.themePreference,
        avatarData: user.avatarData 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove avatar" });
    }
  });

  app.patch("/api/auth/name", authMiddleware, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      const user = await authStorage.updateUserName(req.userId!, name.trim());
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Sync name to linked team member
      await storage.syncUserToLinkedTeamMember(user.id, user.email, { name: user.name });
      
      res.json({ 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        showDescriptions: user.showDescriptions, 
        themePreference: user.themePreference,
        avatarData: user.avatarData 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update name" });
    }
  });

  app.post("/api/auth/change-password", authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }
      
      const passwordHash = await authStorage.getPasswordHash(req.userId!);
      if (!passwordHash) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      
      // Update to new password
      const updated = await authStorage.updatePassword(req.userId!, newPassword);
      if (!updated) {
        return res.status(500).json({ error: "Failed to update password" });
      }
      
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  app.get("/api/admin/pending-users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const users = await authStorage.getPendingUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending users" });
    }
  });

  app.get("/api/admin/matching-team-members/:userId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const pendingUser = await authStorage.getUserById(req.params.userId);
      if (!pendingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      const admin = await authStorage.getUserById(req.userId!);
      if (!admin) {
        return res.status(401).json({ error: "Admin user not found" });
      }
      const matchingTeamMembers = await storage.findMatchingTeamMembers(admin.email, pendingUser.name);
      res.json(matchingTeamMembers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch matching team members" });
    }
  });

  app.post("/api/admin/approve/:userId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { teamMemberId } = req.body || {};
      const user = await authStorage.approveUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get admin email for domain validation
      const admin = await authStorage.getUserById(req.userId!);
      
      if (teamMemberId) {
        // Link to specific team member selected by admin
        await storage.linkUserToTeamMember(user.id, user.email, teamMemberId);
      } else if (admin) {
        // Auto-create or link to matching team member (using admin as creator for ownership consistency)
        await storage.ensureTeamMemberLinkedForUser(user.id, user.email, user.name, req.userId!, admin.email);
      }
      
      // Only seed example data if user has no visible content (owned or shared)
      const hasContent = await storage.userHasVisibleContent(user.id);
      if (!hasContent) {
        await storage.seedExampleData(user.id);
      }
      sendApprovalEmail(user.email, user.name).catch(err =>
        console.error("[Auth] Failed to send approval email:", err)
      );
      res.json({ message: "User approved", user });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve user" });
    }
  });

  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const users = await authStorage.getActiveUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:userId/role", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { role } = req.body;
      if (role !== "admin" && role !== "member") {
        return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'member'" });
      }

      const targetUserId = req.params.userId;
      
      if (targetUserId === req.userId) {
        return res.status(400).json({ error: "You cannot change your own role" });
      }

      if (role === "member") {
        const adminCount = await authStorage.countAdmins();
        const targetUser = await authStorage.getUserById(targetUserId);
        if (targetUser?.role === "admin" && adminCount <= 1) {
          return res.status(400).json({ error: "Cannot remove the last admin" });
        }
      }

      const user = await authStorage.updateUserRole(targetUserId, role);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: `User role updated to ${role}`, user });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.post("/api/admin/users/:userId/deactivate", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      
      if (targetUserId === req.userId) {
        return res.status(400).json({ error: "You cannot deactivate yourself" });
      }

      const targetUser = await authStorage.getUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (targetUser.role === "admin") {
        const adminCount = await authStorage.countAdmins();
        if (adminCount <= 1) {
          return res.status(400).json({ error: "Cannot deactivate the last admin" });
        }
      }

      const user = await authStorage.deactivateUser(targetUserId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "User deactivated", user });
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate user" });
    }
  });

  app.post("/api/admin/users/:userId/reactivate", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const user = await authStorage.reactivateUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "User reactivated", user });
    } catch (error) {
      res.status(500).json({ error: "Failed to reactivate user" });
    }
  });

  app.get("/api/users", authMiddleware, async (req, res) => {
    try {
      const allUsers = await authStorage.getActiveUsers();
      const filteredUsers = allUsers
        .filter(u => u.id !== req.userId && !u.isDeactivated && u.role !== UserRole.PENDING)
        .map(u => ({ id: u.id, email: u.email, name: u.name }));
      res.json(filteredUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/streams", authMiddleware, async (req, res) => {
    try {
      const streams = await storage.getStreams(req.userId!);
      res.json(streams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch streams" });
    }
  });

  app.get("/api/streams/:id", authMiddleware, async (req, res) => {
    try {
      const stream = await storage.getStream(req.userId!, req.params.id);
      if (!stream) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.json(stream);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stream" });
    }
  });

  app.post("/api/streams", authMiddleware, async (req, res) => {
    try {
      const parsed = insertStreamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const stream = await storage.createStream(req.userId!, parsed.data);
      res.status(201).json(stream);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stream" });
    }
  });

  app.patch("/api/streams/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveStreamPermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Stream not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to edit this stream", code: "VIEWER_ONLY" });
      }
      
      const allowedFields = ["name", "description", "phases", "owners", "labels", "status", "momentumStatus"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      // If momentumStatus is being set, calculate the appropriate lastMovementAt
      if (req.body.momentumStatus) {
        const now = Date.now();
        switch (req.body.momentumStatus) {
          case "Active":
            // Reset to now (0 days ago)
            updateData.lastMovementAt = new Date(now).toISOString();
            break;
          case "Slowing":
            // Set to 7 days ago (will transition to Stalled after 7 more days)
            updateData.lastMovementAt = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case "Stalled":
            // Set to 14 days ago
            updateData.lastMovementAt = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
            break;
        }
      }
      
      const stream = await storage.updateStream(req.userId!, req.params.id, updateData);
      if (!stream) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.json(stream);
    } catch (error) {
      console.error("Failed to update stream:", error);
      res.status(500).json({ error: "Failed to update stream" });
    }
  });

  app.delete("/api/streams/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveStreamPermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Stream not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to delete this stream", code: "VIEWER_ONLY" });
      }
      
      const deleted = await storage.deleteStream(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stream" });
    }
  });

  app.get("/api/streams/:id/solutions", authMiddleware, async (req, res) => {
    try {
      const solutions = await storage.getSolutionsByStreamWithBreakdown(req.userId!, req.params.id);
      res.json(solutions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch solutions" });
    }
  });

  app.get("/api/solutions", authMiddleware, async (req, res) => {
    try {
      const solutions = await storage.getSolutions(req.userId!);
      res.json(solutions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch solutions" });
    }
  });

  app.get("/api/solutions/all-with-breakdown", authMiddleware, async (req, res) => {
    try {
      const solutions = await storage.getAllSolutionsWithBreakdown(req.userId!);
      res.json(solutions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch solutions" });
    }
  });

  app.get("/api/solutions/:id", authMiddleware, async (req, res) => {
    try {
      const solution = await storage.getSolution(req.userId!, req.params.id);
      if (!solution) {
        return res.status(404).json({ error: "Solution not found" });
      }
      res.json(solution);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch solution" });
    }
  });

  app.post("/api/solutions", authMiddleware, async (req, res) => {
    try {
      const parsed = insertSolutionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      // Validate priority (1-5) if provided
      if (parsed.data.priority !== undefined && parsed.data.priority !== null) {
        const priority = parsed.data.priority;
        if (typeof priority !== "number" || priority < 1 || priority > 5) {
          return res.status(400).json({ error: "Priority must be between 1 and 5" });
        }
      }
      
      const solution = await storage.createSolution(req.userId!, parsed.data);
      res.status(201).json(solution);
    } catch (error) {
      res.status(500).json({ error: "Failed to create solution" });
    }
  });

  app.patch("/api/solutions/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveSolutionPermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Solution not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to edit this solution", code: "VIEWER_ONLY" });
      }
      
      const allowedFields = ["name", "description", "milestoneDate", "priority", "phases", "owners", "labels", "status", "momentumStatus", "isDeleted"];
      const validStatuses = ["In Progress", "On Hold"];
      const validMomentumStatuses = ["Active", "Slowing", "Stalled"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === "status" && !validStatuses.includes(req.body[field])) {
            return res.status(400).json({ error: "Invalid status value" });
          }
          if (field === "momentumStatus" && !validMomentumStatuses.includes(req.body[field])) {
            return res.status(400).json({ error: "Invalid momentum status value" });
          }
          if (field === "priority") {
            const priority = req.body[field];
            if (priority !== null && (typeof priority !== "number" || priority < 1 || priority > 5)) {
              return res.status(400).json({ error: "Priority must be between 1 and 5" });
            }
          }
          updateData[field] = req.body[field];
        }
      }
      
      // If momentumStatus is being set, calculate the appropriate lastMovementAt
      if (req.body.momentumStatus) {
        const now = Date.now();
        switch (req.body.momentumStatus) {
          case "Active":
            // Reset to now (0 days ago)
            updateData.lastMovementAt = new Date(now).toISOString();
            break;
          case "Slowing":
            // Set to 7 days ago (will transition to Stalled after 7 more days)
            updateData.lastMovementAt = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case "Stalled":
            // Set to 14 days ago
            updateData.lastMovementAt = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
            break;
        }
      }
      
      const solution = await storage.updateSolution(req.userId!, req.params.id, updateData);
      if (!solution) {
        return res.status(404).json({ error: "Solution not found" });
      }
      res.json(solution);
    } catch (error) {
      res.status(500).json({ error: "Failed to update solution" });
    }
  });

  app.delete("/api/solutions/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveSolutionPermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Solution not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to delete this solution", code: "VIEWER_ONLY" });
      }
      
      const deleted = await storage.deleteSolution(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Solution not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete solution" });
    }
  });

  app.get("/api/solutions/:id/actions", authMiddleware, async (req, res) => {
    try {
      const actions = await storage.getActionsBySolution(req.userId!, req.params.id);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  app.get("/api/solutions/:id/deliverables", authMiddleware, async (req, res) => {
    try {
      const deliverables = await storage.getDeliverablesBySolution(req.userId!, req.params.id);
      res.json(deliverables);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deliverables" });
    }
  });

  app.get("/api/deliverables", authMiddleware, async (req, res) => {
    try {
      const deliverables = await storage.getDeliverables(req.userId!);
      res.json(deliverables);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deliverables" });
    }
  });

  app.get("/api/deliverables/:id", authMiddleware, async (req, res) => {
    try {
      const deliverable = await storage.getDeliverable(req.userId!, req.params.id);
      if (!deliverable) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      res.json(deliverable);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deliverable" });
    }
  });

  app.post("/api/deliverables", authMiddleware, async (req, res) => {
    try {
      const parsed = insertDeliverableSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      // Check permissions on the parent solution before creating
      const perms = await storage.resolveSolutionPermissions(req.userId!, parsed.data.solutionId);
      if (!perms.canView) {
        return res.status(404).json({ error: "Solution not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to create deliverables in this solution", code: "VIEWER_ONLY" });
      }
      
      const deliverable = await storage.createDeliverable(req.userId!, parsed.data);
      res.status(201).json(deliverable);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deliverable" });
    }
  });

  app.patch("/api/deliverables/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveDeliverablePermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to edit this deliverable", code: "VIEWER_ONLY" });
      }
      
      const allowedFields = ["name", "description", "ordinal", "borderColor", "owners", "dueDate", "isMilestoneLinked", "solutionId"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      const deliverable = await storage.updateDeliverable(req.userId!, req.params.id, updateData);
      if (!deliverable) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      res.json(deliverable);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deliverable" });
    }
  });

  app.delete("/api/deliverables/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveDeliverablePermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to delete this deliverable", code: "VIEWER_ONLY" });
      }
      
      const deleted = await storage.deleteDeliverable(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deliverable" });
    }
  });

  app.get("/api/actions", authMiddleware, async (req, res) => {
    try {
      const actions = await storage.getActions(req.userId!);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  app.get("/api/actions/:id", authMiddleware, async (req, res) => {
    try {
      const action = await storage.getAction(req.userId!, req.params.id);
      if (!action) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch action" });
    }
  });

  app.post("/api/actions", authMiddleware, async (req, res) => {
    try {
      const parsed = insertActionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      // Check permissions on the parent solution before creating
      const perms = await storage.resolveSolutionPermissions(req.userId!, parsed.data.solutionId);
      if (!perms.canView) {
        return res.status(404).json({ error: "Solution not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to create actions in this solution", code: "VIEWER_ONLY" });
      }
      
      const action = await storage.createAction(req.userId!, parsed.data);
      res.status(201).json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to create action" });
    }
  });

  app.patch("/api/actions/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveActionPermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Action not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to edit this action", code: "VIEWER_ONLY" });
      }
      
      const allowedFields = ["name", "description", "status", "dueDate", "effort", "owners", "labels", "kanbanOrder", "deliverableId", "solutionId"];
      const validStatuses = ["Backlog", "To Execute", "Executing", "Blocked", "Delegated", "Done", "Archive"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === "status" && !validStatuses.includes(req.body[field])) {
            return res.status(400).json({ error: "Invalid status value" });
          }
          updateData[field] = req.body[field];
        }
      }
      const action = await storage.updateAction(req.userId!, req.params.id, updateData);
      if (!action) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to update action" });
    }
  });

  app.delete("/api/actions/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveActionPermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Action not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to delete this action", code: "VIEWER_ONLY" });
      }
      
      const deleted = await storage.deleteAction(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete action" });
    }
  });

  app.get("/api/actions/:id/steps", authMiddleware, async (req, res) => {
    try {
      const steps = await storage.getStepsByAction(req.userId!, req.params.id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  app.get("/api/steps", authMiddleware, async (req, res) => {
    try {
      const steps = await storage.getSteps(req.userId!);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  app.get("/api/steps/:id", authMiddleware, async (req, res) => {
    try {
      const step = await storage.getStep(req.userId!, req.params.id);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch step" });
    }
  });

  app.post("/api/steps", authMiddleware, async (req, res) => {
    try {
      const parsed = insertStepSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const step = await storage.createStep(req.userId!, parsed.data);
      res.status(201).json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  app.patch("/api/steps/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveStepPermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Step not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to edit this step", code: "VIEWER_ONLY" });
      }
      
      const allowedFields = ["name", "note", "isDone", "dueDate", "owner"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      const step = await storage.updateStep(req.userId!, req.params.id, updateData);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.delete("/api/steps/:id", authMiddleware, async (req, res) => {
    try {
      // Check permissions first
      const perms = await storage.resolveStepPermissions(req.userId!, req.params.id);
      if (!perms.canView) {
        return res.status(404).json({ error: "Step not found" });
      }
      if (!perms.canEdit) {
        return res.status(403).json({ error: perms.denialReason || "You do not have permission to delete this step", code: "VIEWER_ONLY" });
      }
      
      const deleted = await storage.deleteStep(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  app.get("/api/comments/:entityType/:entityId", authMiddleware, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      if (!["solution", "deliverable", "action", "step"].includes(entityType)) {
        return res.status(400).json({ error: "Invalid entity type" });
      }
      const comments = await storage.getComments(req.userId!, entityType as any, entityId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/comments", authMiddleware, async (req, res) => {
    try {
      const parsed = insertCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const comment = await storage.createComment(req.userId!, parsed.data);
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.patch("/api/comments/:id", authMiddleware, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }
      const updated = await storage.updateComment(req.userId!, req.params.id, content);
      if (!updated) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  app.delete("/api/comments/:id", authMiddleware, async (req, res) => {
    try {
      const deleted = await storage.deleteComment(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  app.get("/api/recycle-bin", authMiddleware, async (req, res) => {
    try {
      const deletedItems = await storage.getDeletedItems(req.userId!);
      res.json(deletedItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deleted items" });
    }
  });

  app.post("/api/recycle-bin/restore/stream/:id", authMiddleware, async (req, res) => {
    try {
      const restored = await storage.restoreStream(req.userId!, req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Stream not found in recycle bin" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore stream" });
    }
  });

  app.post("/api/recycle-bin/restore/solution/:id", authMiddleware, async (req, res) => {
    try {
      const restored = await storage.restoreSolution(req.userId!, req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Solution not found in recycle bin" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore solution" });
    }
  });

  app.post("/api/recycle-bin/restore/deliverable/:id", authMiddleware, async (req, res) => {
    try {
      const restored = await storage.restoreDeliverable(req.userId!, req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Deliverable not found in recycle bin" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore deliverable" });
    }
  });

  app.post("/api/recycle-bin/restore/action/:id", authMiddleware, async (req, res) => {
    try {
      const restored = await storage.restoreAction(req.userId!, req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Action not found in recycle bin" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore action" });
    }
  });

  app.post("/api/recycle-bin/restore/step/:id", authMiddleware, async (req, res) => {
    try {
      const restored = await storage.restoreStep(req.userId!, req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Step not found in recycle bin" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore step" });
    }
  });

  app.delete("/api/recycle-bin/empty", authMiddleware, async (req, res) => {
    try {
      const result = await storage.emptyRecycleBin(req.userId!);
      res.json({ success: true, deleted: result });
    } catch (error) {
      console.error("[RecycleBin] Empty error:", error);
      res.status(500).json({ error: "Failed to empty recycle bin" });
    }
  });

  // Excel Import - Download Template
  app.get("/api/import/template", authMiddleware, (req, res) => {
    const templatePath = path.join(process.cwd(), "attached_assets", "Streams_Solutions_IMPORT_TEMPLATE_1767869308008.xlsx");
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Template file not found" });
    }
    res.download(templatePath, "StreamFlow_Import_Template.xlsx");
  });

  // Excel Import - Preview
  app.post("/api/import/preview", authMiddleware, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const preview: Record<string, { headers: string[]; rowCount: number; sample: any[] }> = {};
      
      for (const sheetName of ["Streams", "Solutions", "Deliverables", "Actions", "Steps"]) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          const headers = data[0] || [];
          const rows = data.slice(1).filter(row => row.length > 0);
          preview[sheetName] = {
            headers,
            rowCount: rows.length,
            sample: rows.slice(0, 3).map(row => {
              const obj: Record<string, any> = {};
              headers.forEach((h: string, i: number) => obj[h] = row[i]);
              return obj;
            })
          };
        }
      }
      res.json({ preview });
    } catch (error) {
      console.error("[Import] Preview error:", error);
      res.status(500).json({ error: "Failed to parse Excel file" });
    }
  });

  // Excel Import - Execute
  app.post("/api/import/execute", authMiddleware, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const userId = req.userId!;
      const updateMode = req.body.updateMode === "true" || req.body.updateMode === true;
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      
      const excelDateToJS = (serial: number): Date => {
        const utcDays = Math.floor(serial - 25569);
        return new Date(utcDays * 86400 * 1000);
      };
      
      const parseSheet = <T>(name: string): T[] => {
        const sheet = workbook.Sheets[name];
        if (!sheet) return [];
        return XLSX.utils.sheet_to_json(sheet) as T[];
      };

      const streamKeyToId = new Map<string, string>();
      const solutionKeyToId = new Map<string, string>();
      const deliverableKeyToId = new Map<string, string>();
      const actionKeyToId = new Map<string, string>();

      const stats = { 
        streams: 0, solutions: 0, deliverables: 0, actions: 0, steps: 0,
        streamsUpdated: 0, solutionsUpdated: 0, deliverablesUpdated: 0, actionsUpdated: 0
      };

      // In update mode, load existing data to match by name
      let existingStreams: { id: string; name: string }[] = [];
      let existingSolutions: { id: string; name: string; streamId: string }[] = [];
      let existingDeliverables: { id: string; name: string; solutionId: string }[] = [];
      let existingActions: { id: string; name: string; solutionId: string; deliverableId?: string | null }[] = [];
      
      if (updateMode) {
        const streams = await storage.getStreams(userId);
        existingStreams = streams.filter(s => !s.isDeleted).map(s => ({ id: s.id, name: s.name }));
        
        const solutions = await storage.getSolutions(userId);
        existingSolutions = solutions.filter(s => !s.isDeleted).map(s => ({ id: s.id, name: s.name, streamId: s.streamId }));
        
        const deliverables = await storage.getDeliverables(userId);
        existingDeliverables = deliverables.filter(d => !d.isDeleted).map(d => ({ id: d.id, name: d.name, solutionId: d.solutionId }));
        
        const actions = await storage.getActions(userId);
        existingActions = actions.filter(a => !a.isDeleted).map(a => ({ id: a.id, name: a.name, solutionId: a.solutionId, deliverableId: a.deliverableId }));
      }

      // Import Streams
      const streamsData = parseSheet<{
        stream_key: string;
        stream_name: string;
        stream_description?: string;
        phases?: string;
        owners?: string;
        labels?: string;
      }>("Streams");

      for (const row of streamsData) {
        const streamData = {
          name: row.stream_name,
          description: row.stream_description || undefined,
          phases: row.phases?.split(";").map(p => p.trim()).filter(Boolean) || [],
          owners: row.owners?.split(";").map(o => o.trim()).filter(Boolean) || [],
          labels: row.labels?.split(";").map(l => l.trim()).filter(Boolean) || [],
        };
        
        // In update mode, check if stream exists by name
        const existingStream = updateMode ? existingStreams.find(s => s.name === row.stream_name) : null;
        
        if (existingStream) {
          await storage.updateStream(userId, existingStream.id, streamData);
          streamKeyToId.set(row.stream_key, existingStream.id);
          stats.streamsUpdated++;
        } else {
          const stream = await storage.createStream(userId, streamData);
          streamKeyToId.set(row.stream_key, stream.id);
          stats.streams++;
        }
      }

      // Import Solutions
      const solutionsData = parseSheet<{
        solution_key: string;
        solution_name: string;
        stream_key: string;
        solution_description?: string;
        owners?: string;
        labels?: string;
      }>("Solutions");

      for (const row of solutionsData) {
        const streamId = streamKeyToId.get(row.stream_key);
        if (!streamId) continue;
        
        const solutionData = {
          streamId,
          name: row.solution_name,
          description: row.solution_description || undefined,
          status: SolutionStatus.IN_PROGRESS,
          phases: [] as string[],
          owners: row.owners?.split(";").map(o => o.trim()).filter(Boolean) || [],
          labels: row.labels?.split(";").map(l => l.trim()).filter(Boolean) || [],
        };
        
        // In update mode, check if solution exists by name within the same stream
        const existingSolution = updateMode ? existingSolutions.find(s => s.name === row.solution_name && s.streamId === streamId) : null;
        
        if (existingSolution) {
          await storage.updateSolution(userId, existingSolution.id, solutionData);
          solutionKeyToId.set(row.solution_key, existingSolution.id);
          stats.solutionsUpdated++;
        } else {
          const solution = await storage.createSolution(userId, solutionData);
          solutionKeyToId.set(row.solution_key, solution.id);
          stats.solutions++;
        }
      }

      // Import Deliverables
      const deliverablesData = parseSheet<{
        deliverable_key: string;
        deliverable_name: string;
        solution_key: string;
        stream_key: string;
        deliverable_description?: string;
        milestone_date?: number;
        phases?: string;
        owners?: string;
      }>("Deliverables");

      for (const row of deliverablesData) {
        const solutionId = solutionKeyToId.get(row.solution_key);
        const streamId = streamKeyToId.get(row.stream_key);
        if (!solutionId || !streamId) continue;
        
        const deliverableData = {
          solutionId,
          streamId,
          name: row.deliverable_name,
          description: row.deliverable_description || undefined,
          borderColor: "cyan",
          isMilestoneLinked: true,
          dueDate: row.milestone_date ? excelDateToJS(row.milestone_date).toISOString() : undefined,
          owners: row.owners?.split(";").map(o => o.trim()).filter(Boolean) || [],
        };
        
        // In update mode, check if deliverable exists by name within the same solution
        const existingDeliverable = updateMode ? existingDeliverables.find(d => d.name === row.deliverable_name && d.solutionId === solutionId) : null;
        
        if (existingDeliverable) {
          await storage.updateDeliverable(userId, existingDeliverable.id, deliverableData);
          deliverableKeyToId.set(row.deliverable_key, existingDeliverable.id);
          stats.deliverablesUpdated++;
        } else {
          const deliverable = await storage.createDeliverable(userId, deliverableData);
          deliverableKeyToId.set(row.deliverable_key, deliverable.id);
          stats.deliverables++;
        }
      }

      // Import Actions
      const actionsData = parseSheet<{
        action_key: string;
        action_name: string;
        deliverable_key: string;
        solution_key: string;
        stream_key: string;
        action_description?: string;
        status?: string;
        due_date?: number;
        effort?: number;
        owners?: string;
      }>("Actions");

      const statusMap: Record<string, string> = {
        "Backlog": ActionStatus.BACKLOG,
        "To Execute": ActionStatus.TO_EXECUTE,
        "Executing": ActionStatus.EXECUTING,
        "Blocked": ActionStatus.BLOCKED,
        "Delegated": ActionStatus.DELEGATED,
        "Done": ActionStatus.DONE,
        "Archive": ActionStatus.ARCHIVE,
      };

      for (const row of actionsData) {
        const deliverableId = deliverableKeyToId.get(row.deliverable_key);
        const solutionId = solutionKeyToId.get(row.solution_key);
        const streamId = streamKeyToId.get(row.stream_key);
        if (!solutionId || !streamId) continue;
        
        const actionData = {
          solutionId,
          streamId,
          deliverableId: deliverableId || undefined,
          name: row.action_name,
          description: row.action_description || undefined,
          status: statusMap[row.status || "Backlog"] || ActionStatus.BACKLOG,
          dueDate: row.due_date ? excelDateToJS(row.due_date).toISOString() : undefined,
          effort: row.effort || undefined,
          owners: row.owners?.split(";").map(o => o.trim()).filter(Boolean) || [],
          labels: [] as string[],
        };
        
        // In update mode, check if action exists by name within the same solution and deliverable
        const existingAction = updateMode ? existingActions.find(a => 
          a.name === row.action_name && 
          a.solutionId === solutionId && 
          (deliverableId ? a.deliverableId === deliverableId : !a.deliverableId)
        ) : null;
        
        if (existingAction) {
          await storage.updateAction(userId, existingAction.id, actionData);
          actionKeyToId.set(row.action_key, existingAction.id);
          stats.actionsUpdated++;
        } else {
          const action = await storage.createAction(userId, actionData);
          actionKeyToId.set(row.action_key, action.id);
          stats.actions++;
        }
      }

      // Import Steps (steps don't have update mode - always create new)
      const stepsData = parseSheet<{
        step_key: string;
        step_name: string;
        action_key: string;
        is_done?: boolean;
        due_date?: number;
        owner?: string;
      }>("Steps");

      for (const row of stepsData) {
        const actionId = actionKeyToId.get(row.action_key);
        if (!actionId) continue;
        await storage.createStep(userId, {
          actionId,
          name: row.step_name,
          isDone: row.is_done === true,
          dueDate: row.due_date ? excelDateToJS(row.due_date).toISOString() : undefined,
          owner: row.owner || undefined,
        });
        stats.steps++;
      }

      res.json({ success: true, stats, updateMode });
    } catch (error) {
      console.error("[Import] Execute error:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  // Team Member Photo Upload - stores as base64 data URI (portable across platforms)
  app.post("/api/upload/team-photo", authMiddleware, upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const buf = req.file.buffer;
      
      // Validate file size (max 500KB for avatars)
      if (buf.length > 500 * 1024) {
        return res.status(400).json({ error: "Image too large (max 500KB)" });
      }
      
      // Detect image type from magic bytes
      let mimeType = "image/jpeg";
      if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
        mimeType = "image/jpeg";
      } else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
        mimeType = "image/png";
      } else if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        mimeType = "image/gif";
      } else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
        mimeType = "image/webp";
      } else {
        return res.status(400).json({ error: "Invalid image file (supported: jpg, png, gif, webp)" });
      }
      
      // Convert to base64 data URI
      const base64 = buf.toString("base64");
      const dataUri = `data:${mimeType};base64,${base64}`;
      
      res.json({ photoData: dataUri });
    } catch (error) {
      console.error("[Upload] Photo upload error:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });

  // Team Members API
  app.get("/api/team-members", authMiddleware, async (req, res) => {
    try {
      const user = await authStorage.getUserById(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const members = await storage.getTeamMembers(req.userId!, user.email);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.post("/api/team-members", authMiddleware, async (req, res) => {
    try {
      const user = await authStorage.getUserById(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const parsed = insertTeamMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid team member data" });
      }
      const member = await storage.createTeamMember(req.userId!, user.email, parsed.data);
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to create team member" });
    }
  });

  app.patch("/api/team-members/:id", authMiddleware, async (req, res) => {
    try {
      const user = await authStorage.getUserById(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const member = await storage.updateTeamMember(req.userId!, req.params.id, req.body, user.email);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to update team member" });
    }
  });

  app.delete("/api/team-members/:id", authMiddleware, async (req, res) => {
    try {
      const user = await authStorage.getUserById(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const success = await storage.deleteTeamMember(req.userId!, req.params.id, user.email);
      if (!success) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete team member" });
    }
  });

  app.get("/api/stakeholders", authMiddleware, async (req, res) => {
    try {
      const stakeholders = await storage.getStakeholders(req.userId!);
      res.json(stakeholders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stakeholders" });
    }
  });

  app.get("/api/stakeholders/search", authMiddleware, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const stakeholders = await storage.searchStakeholders(req.userId!, query);
      res.json(stakeholders);
    } catch (error) {
      res.status(500).json({ error: "Failed to search stakeholders" });
    }
  });

  app.post("/api/stakeholders", authMiddleware, async (req, res) => {
    try {
      const parsed = insertStakeholderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid stakeholder data" });
      }
      const stakeholder = await storage.createStakeholder(req.userId!, parsed.data);
      res.status(201).json(stakeholder);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stakeholder" });
    }
  });

  app.patch("/api/stakeholders/:id", authMiddleware, async (req, res) => {
    try {
      const stakeholder = await storage.updateStakeholder(req.userId!, req.params.id, req.body);
      res.json(stakeholder);
    } catch (error: any) {
      if (error.message === "Stakeholder not found") {
        return res.status(404).json({ error: "Stakeholder not found" });
      }
      res.status(500).json({ error: "Failed to update stakeholder" });
    }
  });

  app.delete("/api/stakeholders/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteStakeholder(req.userId!, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stakeholder" });
    }
  });

  app.get("/api/stakeholders/:id/items", authMiddleware, async (req, res) => {
    try {
      const items = await storage.getTaggedItemsForStakeholder(req.userId!, req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tagged items" });
    }
  });

  app.delete("/api/stakeholders/:id/tags", authMiddleware, async (req, res) => {
    try {
      await storage.deleteAllTagsForStakeholder(req.userId!, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tags" });
    }
  });

  app.get("/api/tags/:entityType/:entityId", authMiddleware, async (req, res) => {
    try {
      const entityType = req.params.entityType as TagEntityTypeValue;
      const validTypes = [TagEntityType.STREAM, TagEntityType.SOLUTION, TagEntityType.ACTION, TagEntityType.STEP];
      if (!validTypes.includes(entityType as any)) {
        return res.status(400).json({ error: "Invalid entity type" });
      }
      const tags = await storage.getTagsForEntity(req.userId!, entityType, req.params.entityId);
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.post("/api/tags", authMiddleware, async (req, res) => {
    try {
      const parsed = insertStakeholderTagSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid tag data" });
      }
      const tag = await storage.createTag(req.userId!, parsed.data);
      res.status(201).json(tag);
    } catch (error) {
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  app.delete("/api/tags/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteTag(req.userId!, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  app.get("/api/meetings", authMiddleware, async (req, res) => {
    try {
      const meetings = await storage.getMeetings(req.userId!);
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meetings/:id", authMiddleware, async (req, res) => {
    try {
      const meeting = await storage.getMeeting(req.userId!, req.params.id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  app.post("/api/meetings", authMiddleware, async (req, res) => {
    try {
      const parsed = insertMeetingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid meeting data" });
      }
      const meeting = await storage.createMeeting(req.userId!, parsed.data);
      res.status(201).json(meeting);
    } catch (error) {
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  app.patch("/api/meetings/:id", authMiddleware, async (req, res) => {
    try {
      const meeting = await storage.updateMeeting(req.userId!, req.params.id, req.body);
      res.json(meeting);
    } catch (error: any) {
      if (error.message === "Meeting not found") {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  app.delete("/api/meetings/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteMeeting(req.userId!, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  app.post("/api/meetings/:id/items", authMiddleware, async (req, res) => {
    try {
      const data = { ...req.body, meetingId: req.params.id };
      const parsed = insertMeetingItemSchema.safeParse(data);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid meeting item data" });
      }
      const item = await storage.addMeetingItem(req.userId!, parsed.data);
      res.status(201).json(item);
    } catch (error: any) {
      if (error.message === "Meeting not found") {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.status(500).json({ error: "Failed to add meeting item" });
    }
  });

  app.patch("/api/meeting-items/:id", authMiddleware, async (req, res) => {
    try {
      const item = await storage.updateMeetingItem(req.userId!, req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      if (error.message === "Meeting item not found" || error.message === "Meeting not found or access denied") {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update meeting item" });
    }
  });

  app.delete("/api/meeting-items/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteMeetingItem(req.userId!, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete meeting item" });
    }
  });

  // Viewer management routes
  app.get("/api/viewers/:entityType/:entityId", authMiddleware, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      if (entityType !== ViewerEntityType.STREAM && entityType !== ViewerEntityType.SOLUTION) {
        return res.status(400).json({ error: "Invalid entity type" });
      }
      const viewers = await storage.getViewersForEntity(req.userId!, entityType as ViewerEntityTypeValue, entityId);
      res.json(viewers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch viewers" });
    }
  });

  app.post("/api/viewers", authMiddleware, async (req, res) => {
    try {
      const parsed = insertViewerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid viewer data" });
      }
      const { viewerId, entityType, entityId } = parsed.data;
      
      // Prevent users from adding themselves as viewers
      if (viewerId === req.userId) {
        return res.status(400).json({ error: "Cannot add yourself as a viewer" });
      }
      
      // Verify the user owns the entity before adding a viewer
      if (entityType === ViewerEntityType.STREAM) {
        const stream = await storage.getStream(req.userId!, entityId);
        if (!stream || stream.userId !== req.userId) {
          return res.status(403).json({ error: "You can only add viewers to your own streams" });
        }
      } else if (entityType === ViewerEntityType.SOLUTION) {
        const solution = await storage.getSolution(req.userId!, entityId);
        if (!solution || solution.userId !== req.userId) {
          return res.status(403).json({ error: "You can only add viewers to your own solutions" });
        }
      }
      
      const viewer = await storage.addViewer(req.userId!, viewerId, entityType as ViewerEntityTypeValue, entityId);
      res.status(201).json(viewer);
    } catch (error) {
      res.status(500).json({ error: "Failed to add viewer" });
    }
  });

  app.delete("/api/viewers/:entityType/:entityId/:viewerId", authMiddleware, async (req, res) => {
    try {
      const { entityType, entityId, viewerId } = req.params;
      if (entityType !== ViewerEntityType.STREAM && entityType !== ViewerEntityType.SOLUTION) {
        return res.status(400).json({ error: "Invalid entity type" });
      }
      
      // Verify the user owns the entity before removing a viewer
      if (entityType === ViewerEntityType.STREAM) {
        const stream = await storage.getStream(req.userId!, entityId);
        if (!stream || stream.userId !== req.userId) {
          return res.status(403).json({ error: "You can only remove viewers from your own streams" });
        }
      } else if (entityType === ViewerEntityType.SOLUTION) {
        const solution = await storage.getSolution(req.userId!, entityId);
        if (!solution || solution.userId !== req.userId) {
          return res.status(403).json({ error: "You can only remove viewers from your own solutions" });
        }
      }
      
      const success = await storage.removeViewer(req.userId!, viewerId, entityType as ViewerEntityTypeValue, entityId);
      if (!success) {
        return res.status(404).json({ error: "Viewer not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove viewer" });
    }
  });

  registerObjectStorageRoutes(app);

  // Serve public files from object storage
  app.get("/public/*", async (req, res) => {
    try {
      const filePath = req.path.replace(/^\/public\//, "");
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.searchPublicObject(filePath);
      
      if (!objectFile) {
        return res.status(404).json({ error: "File not found" });
      }
      
      await objectStorageService.downloadObject(objectFile, res, 86400);
    } catch (error) {
      console.error("[Storage] Error serving public file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  return httpServer;
}
