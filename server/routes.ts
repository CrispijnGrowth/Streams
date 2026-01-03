import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertStreamSchema,
  insertDeliverableSchema,
  insertActionSchema,
  insertStepSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/streams", async (req, res) => {
    try {
      const streams = await storage.getStreams();
      res.json(streams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch streams" });
    }
  });

  app.get("/api/streams/:id", async (req, res) => {
    try {
      const stream = await storage.getStream(req.params.id);
      if (!stream) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.json(stream);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stream" });
    }
  });

  app.post("/api/streams", async (req, res) => {
    try {
      const parsed = insertStreamSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const stream = await storage.createStream(parsed.data);
      res.status(201).json(stream);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stream" });
    }
  });

  app.patch("/api/streams/:id", async (req, res) => {
    try {
      const allowedFields = ["name", "description", "phases", "owners", "labels", "momentumStatus"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      const stream = await storage.updateStream(req.params.id, updateData);
      if (!stream) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.json(stream);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stream" });
    }
  });

  app.post("/api/streams/:id/activate", async (req, res) => {
    try {
      const stream = await storage.activateStream(req.params.id);
      if (!stream) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.json(stream);
    } catch (error) {
      res.status(500).json({ error: "Failed to activate stream" });
    }
  });

  app.delete("/api/streams/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteStream(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Stream not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stream" });
    }
  });

  app.get("/api/streams/:id/deliverables", async (req, res) => {
    try {
      const deliverables = await storage.getDeliverablesByStream(req.params.id);
      res.json(deliverables);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deliverables" });
    }
  });

  app.get("/api/deliverables", async (req, res) => {
    try {
      const deliverables = await storage.getDeliverables();
      res.json(deliverables);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deliverables" });
    }
  });

  app.get("/api/deliverables/:id", async (req, res) => {
    try {
      const deliverable = await storage.getDeliverable(req.params.id);
      if (!deliverable) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      res.json(deliverable);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deliverable" });
    }
  });

  app.post("/api/deliverables", async (req, res) => {
    try {
      const parsed = insertDeliverableSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const deliverable = await storage.createDeliverable(parsed.data);
      res.status(201).json(deliverable);
    } catch (error) {
      res.status(500).json({ error: "Failed to create deliverable" });
    }
  });

  app.patch("/api/deliverables/:id", async (req, res) => {
    try {
      const allowedFields = ["name", "description", "milestoneDate", "phases", "owners", "labels", "status"];
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
      const deliverable = await storage.updateDeliverable(req.params.id, updateData);
      if (!deliverable) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      res.json(deliverable);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deliverable" });
    }
  });

  app.delete("/api/deliverables/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDeliverable(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deliverable" });
    }
  });

  app.get("/api/deliverables/:id/actions", async (req, res) => {
    try {
      const actions = await storage.getActionsByDeliverable(req.params.id);
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  app.get("/api/actions", async (req, res) => {
    try {
      const actions = await storage.getActions();
      res.json(actions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  app.get("/api/actions/:id", async (req, res) => {
    try {
      const action = await storage.getAction(req.params.id);
      if (!action) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch action" });
    }
  });

  app.post("/api/actions", async (req, res) => {
    try {
      const parsed = insertActionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const action = await storage.createAction(parsed.data);
      res.status(201).json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to create action" });
    }
  });

  app.patch("/api/actions/:id", async (req, res) => {
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
      const action = await storage.updateAction(req.params.id, updateData);
      if (!action) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.json(action);
    } catch (error) {
      res.status(500).json({ error: "Failed to update action" });
    }
  });

  app.delete("/api/actions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAction(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Action not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete action" });
    }
  });

  app.get("/api/actions/:id/steps", async (req, res) => {
    try {
      const steps = await storage.getStepsByAction(req.params.id);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  app.get("/api/steps", async (req, res) => {
    try {
      const steps = await storage.getSteps();
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  app.get("/api/steps/:id", async (req, res) => {
    try {
      const step = await storage.getStep(req.params.id);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch step" });
    }
  });

  app.post("/api/steps", async (req, res) => {
    try {
      const parsed = insertStepSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const step = await storage.createStep(parsed.data);
      res.status(201).json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  app.patch("/api/steps/:id", async (req, res) => {
    try {
      const allowedFields = ["name", "note", "isDone", "dueDate", "owner"];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      const step = await storage.updateStep(req.params.id, updateData);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.delete("/api/steps/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteStep(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  app.get("/api/recycle-bin", async (req, res) => {
    try {
      const deletedItems = await storage.getDeletedItems();
      res.json(deletedItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deleted items" });
    }
  });

  app.post("/api/recycle-bin/restore/stream/:id", async (req, res) => {
    try {
      const restored = await storage.restoreStream(req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Stream not found in recycle bin" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore stream" });
    }
  });

  app.post("/api/recycle-bin/restore/deliverable/:id", async (req, res) => {
    try {
      const restored = await storage.restoreDeliverable(req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Deliverable not found in recycle bin" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore deliverable" });
    }
  });

  app.post("/api/recycle-bin/restore/action/:id", async (req, res) => {
    try {
      const restored = await storage.restoreAction(req.params.id);
      if (!restored) {
        return res.status(404).json({ error: "Action not found in recycle bin" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore action" });
    }
  });

  app.post("/api/recycle-bin/restore/step/:id", async (req, res) => {
    try {
      const restored = await storage.restoreStep(req.params.id);
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
