import { z } from "zod";

export const ActionStatus = {
  BACKLOG: "Backlog",
  TO_EXECUTE: "To Execute",
  EXECUTING: "Executing",
  BLOCKED: "Blocked",
  DELEGATED: "Delegated",
  DONE: "Done",
  ARCHIVE: "Archive",
} as const;

export type ActionStatusType = (typeof ActionStatus)[keyof typeof ActionStatus];

export const MomentumStatus = {
  ACTIVE: "Active",
  SLOWING: "Slowing",
  STALLED: "Stalled",
} as const;

export type MomentumStatusType = (typeof MomentumStatus)[keyof typeof MomentumStatus];

export const DeliverableStatus = {
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
} as const;

export type DeliverableStatusType = (typeof DeliverableStatus)[keyof typeof DeliverableStatus];

export const Phases = {
  STRATEGY: "STRATEGY",
  DESIGN: "DESIGN",
  MODERNIZATION_MIGRATION: "MODERNIZATION & MIGRATION",
  MANAGE: "MANAGE",
} as const;

export type PhaseType = (typeof Phases)[keyof typeof Phases];

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member" | "pending";
  showDescriptions: boolean;
  themePreference: "light" | "dark" | "system";
}

export interface Stream {
  id: string;
  key: string;
  name: string;
  description?: string;
  phases: string[];
  owners: string[];
  labels: string[];
  momentumStatus: MomentumStatusType;
  computedMilestoneDate?: string;
  lastMovementAt?: string;
  ordinal: number;
  isDeleted: boolean;
}

export interface Deliverable {
  id: string;
  key: string;
  name: string;
  description?: string;
  streamId: string;
  milestoneDate?: string;
  phases: string[];
  owners: string[];
  labels: string[];
  status: DeliverableStatusType;
  ordinal: number;
  isDeleted: boolean;
}

export interface Action {
  id: string;
  key: string;
  name: string;
  description?: string;
  deliverableId: string;
  streamId: string;
  status: ActionStatusType;
  dueDate?: string;
  effort?: number;
  owners: string[];
  labels: string[];
  kanbanOrder: number;
  ordinal: number;
  isDeleted: boolean;
}

export interface Step {
  id: string;
  key: string;
  name: string;
  note?: string;
  actionId: string;
  isDone: boolean;
  dueDate?: string;
  owner?: string;
  ordinal: number;
  isDeleted: boolean;
}

export const insertStreamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  phases: z.array(z.string()).default([]),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

export const insertDeliverableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  streamId: z.string().min(1, "Stream is required"),
  milestoneDate: z.string().optional(),
  phases: z.array(z.string()).default([]),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  status: z.string().default("In Progress"),
});

export const insertActionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  deliverableId: z.string().min(1, "Deliverable is required"),
  streamId: z.string().min(1, "Stream is required"),
  status: z.string().default("Backlog"),
  dueDate: z.string().optional(),
  effort: z.number().optional(),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

export const insertStepSchema = z.object({
  name: z.string().min(1, "Name is required"),
  note: z.string().optional(),
  actionId: z.string().min(1, "Action is required"),
  isDone: z.boolean().default(false),
  dueDate: z.string().optional(),
  owner: z.string().optional(),
});

export type InsertStream = z.infer<typeof insertStreamSchema>;
export type InsertDeliverable = z.infer<typeof insertDeliverableSchema>;
export type InsertAction = z.infer<typeof insertActionSchema>;
export type InsertStep = z.infer<typeof insertStepSchema>;

export interface StreamWithProgress extends Stream {
  progress: number;
  deliverableCount: number;
  doingCount: number;
  blockedCount: number;
  delegatedCount: number;
  inProgressDeliverables: string[];
}

export interface DeliverableWithProgress extends Deliverable {
  progress: number;
  actionCount: number;
  doingCount: number;
  blockedCount: number;
  delegatedCount: number;
}

export interface ActionWithProgress extends Action {
  progress: number;
  stepCount: number;
  doneStepCount: number;
}
