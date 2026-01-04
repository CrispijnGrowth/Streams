import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authStorage, generateMagicLinkUrl } from "./auth";
import { sendMagicLinkEmail, sendNewUserNotification, sendApprovalEmail } from "./email";
import {
  insertStreamSchema,
  insertDeliverableSchema,
  insertActionSchema,
  insertStepSchema,
  insertUserSchema,
  UserRole,
} from "@shared/schema";

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
      res.json({ 
        sessionId: session.id, 
        user: { id: user.id, email: user.email, name: user.name, role: user.role, showDescriptions: user.showDescriptions, themePreference: user.themePreference }
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
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, showDescriptions: user.showDescriptions, themePreference: user.themePreference });
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
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, showDescriptions: user.showDescriptions, themePreference: user.themePreference });
  });

  app.get("/api/admin/pending-users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const users = await authStorage.getPendingUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending users" });
    }
  });

  app.post("/api/admin/approve/:userId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const user = await authStorage.approveUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      sendApprovalEmail(user.email, user.name).catch(err =>
        console.error("[Auth] Failed to send approval email:", err)
      );
      res.json({ message: "User approved", user });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve user" });
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
      const allowedFields = ["name", "description", "phases", "owners", "labels", "momentumStatus"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      const stream = await storage.updateStream(req.userId!, req.params.id, updateData);
      if (!stream) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.json(stream);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stream" });
    }
  });

  app.delete("/api/streams/:id", authMiddleware, async (req, res) => {
    try {
      const deleted = await storage.deleteStream(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stream" });
    }
  });

  app.get("/api/streams/:id/deliverables", authMiddleware, async (req, res) => {
    try {
      const deliverables = await storage.getDeliverablesByStream(req.userId!, req.params.id);
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
      const deliverable = await storage.createDeliverable(req.userId!, parsed.data);
      res.status(201).json(deliverable);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deliverable" });
    }
  });

  app.patch("/api/deliverables/:id", authMiddleware, async (req, res) => {
    try {
      const allowedFields = ["name", "description", "milestoneDate", "phases", "owners", "labels", "status", "isDeleted"];
      const validStatuses = ["In Progress", "On Hold"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === "status" && !validStatuses.includes(req.body[field])) {
            return res.status(400).json({ error: "Invalid status value" });
          }
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
      const deleted = await storage.deleteDeliverable(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deliverable" });
    }
  });

  app.get("/api/deliverables/:id/actions", authMiddleware, async (req, res) => {
    try {
      const actions = await storage.getActionsByDeliverable(req.userId!, req.params.id);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch actions" });
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
      const action = await storage.createAction(req.userId!, parsed.data);
      res.status(201).json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to create action" });
    }
  });

  app.patch("/api/actions/:id", authMiddleware, async (req, res) => {
    try {
      const allowedFields = ["name", "description", "status", "dueDate", "effort", "owners", "labels", "kanbanOrder"];
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
      const deleted = await storage.deleteStep(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete step" });
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

  return httpServer;
}
