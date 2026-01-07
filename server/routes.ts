import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import XLSX from "xlsx";
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
  insertUserSchema,
  UserRole,
  CommentEntityType,
  ActionStatus,
  MomentumStatus,
  SolutionStatus,
} from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage() });

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
      await storage.seedExampleData(user.id);
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
      await storage.seedExampleData(user.id);
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
      
      // If momentumStatus is being set, calculate the appropriate lastMovementAt
      if (req.body.momentumStatus) {
        const now = new Date();
        switch (req.body.momentumStatus) {
          case "Active":
            // Reset to now (0 days ago)
            updateData.lastMovementAt = now.toISOString();
            break;
          case "Slowing":
            // Set to 7 days ago (will transition to Stalled after 7 more days)
            now.setDate(now.getDate() - 7);
            updateData.lastMovementAt = now.toISOString();
            break;
          case "Stalled":
            // Set to 14 days ago
            now.setDate(now.getDate() - 14);
            updateData.lastMovementAt = now.toISOString();
            break;
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
      const solution = await storage.createSolution(req.userId!, parsed.data);
      res.status(201).json(solution);
    } catch (error) {
      res.status(500).json({ error: "Failed to create solution" });
    }
  });

  app.patch("/api/solutions/:id", authMiddleware, async (req, res) => {
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
      const deliverable = await storage.createDeliverable(req.userId!, parsed.data);
      res.status(201).json(deliverable);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deliverable" });
    }
  });

  app.patch("/api/deliverables/:id", authMiddleware, async (req, res) => {
    try {
      const allowedFields = ["name", "description", "ordinal", "borderColor", "owners", "dueDate", "isMilestoneLinked"];
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
      const action = await storage.createAction(req.userId!, parsed.data);
      res.status(201).json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to create action" });
    }
  });

  app.patch("/api/actions/:id", authMiddleware, async (req, res) => {
    try {
      const allowedFields = ["name", "description", "status", "dueDate", "effort", "owners", "labels", "kanbanOrder", "deliverableId"];
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

  app.get("/api/comments/:entityType/:entityId", authMiddleware, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      if (!["solution", "deliverable", "action"].includes(entityType)) {
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

      const stats = { streams: 0, solutions: 0, deliverables: 0, actions: 0, steps: 0 };

      // Import Streams
      const streamsData = parseSheet<{
        stream_key: string;
        stream_name: string;
        phases?: string;
        owners?: string;
        labels?: string;
      }>("Streams");

      for (const row of streamsData) {
        const stream = await storage.createStream(userId, {
          name: row.stream_name,
          phases: row.phases?.split(";").map(p => p.trim()).filter(Boolean) || [],
          owners: row.owners?.split(";").map(o => o.trim()).filter(Boolean) || [],
          labels: row.labels?.split(";").map(l => l.trim()).filter(Boolean) || [],
        });
        streamKeyToId.set(row.stream_key, stream.id);
        stats.streams++;
      }

      // Import Solutions
      const solutionsData = parseSheet<{
        solution_key: string;
        solution_name: string;
        stream_key: string;
        owners?: string;
        labels?: string;
      }>("Solutions");

      for (const row of solutionsData) {
        const streamId = streamKeyToId.get(row.stream_key);
        if (!streamId) continue;
        const solution = await storage.createSolution(userId, {
          streamId,
          name: row.solution_name,
          status: SolutionStatus.IN_PROGRESS,
          phases: [],
          owners: row.owners?.split(";").map(o => o.trim()).filter(Boolean) || [],
          labels: row.labels?.split(";").map(l => l.trim()).filter(Boolean) || [],
        });
        solutionKeyToId.set(row.solution_key, solution.id);
        stats.solutions++;
      }

      // Import Deliverables
      const deliverablesData = parseSheet<{
        deliverable_key: string;
        deliverable_name: string;
        solution_key: string;
        stream_key: string;
        milestone_date?: number;
        phases?: string;
        owners?: string;
      }>("Deliverables");

      for (const row of deliverablesData) {
        const solutionId = solutionKeyToId.get(row.solution_key);
        const streamId = streamKeyToId.get(row.stream_key);
        if (!solutionId || !streamId) continue;
        const deliverable = await storage.createDeliverable(userId, {
          solutionId,
          streamId,
          name: row.deliverable_name,
          borderColor: "cyan",
          isMilestoneLinked: true,
          dueDate: row.milestone_date ? excelDateToJS(row.milestone_date).toISOString() : undefined,
          owners: row.owners?.split(";").map(o => o.trim()).filter(Boolean) || [],
        });
        deliverableKeyToId.set(row.deliverable_key, deliverable.id);
        stats.deliverables++;
      }

      // Import Actions
      const actionsData = parseSheet<{
        action_key: string;
        action_name: string;
        deliverable_key: string;
        solution_key: string;
        stream_key: string;
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
        const action = await storage.createAction(userId, {
          solutionId,
          streamId,
          deliverableId: deliverableId || undefined,
          name: row.action_name,
          status: statusMap[row.status || "Backlog"] || ActionStatus.BACKLOG,
          dueDate: row.due_date ? excelDateToJS(row.due_date).toISOString() : undefined,
          effort: row.effort || undefined,
          owners: row.owners?.split(";").map(o => o.trim()).filter(Boolean) || [],
          labels: [],
        });
        actionKeyToId.set(row.action_key, action.id);
        stats.actions++;
      }

      // Import Steps
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

      res.json({ success: true, stats });
    } catch (error) {
      console.error("[Import] Execute error:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  // Team Members API
  app.get("/api/team-members", authMiddleware, async (req, res) => {
    try {
      const members = await storage.getTeamMembers(req.userId!);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.post("/api/team-members", authMiddleware, async (req, res) => {
    try {
      const parsed = insertTeamMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid team member data" });
      }
      const member = await storage.createTeamMember(req.userId!, parsed.data);
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to create team member" });
    }
  });

  app.patch("/api/team-members/:id", authMiddleware, async (req, res) => {
    try {
      const member = await storage.updateTeamMember(req.userId!, req.params.id, req.body);
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
      const success = await storage.deleteTeamMember(req.userId!, req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Team member not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete team member" });
    }
  });

  return httpServer;
}
