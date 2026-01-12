import { z } from "zod";
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

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

export const streams = pgTable("streams", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  phases: text("phases").array().notNull().default([]),
  owners: text("owners").array().notNull().default([]),
  labels: text("labels").array().notNull().default([]),
  status: text("status").notNull().default("In Progress"),
  momentumStatus: text("momentum_status").notNull().default("Active"),
  computedMilestoneDate: text("computed_milestone_date"),
  lastMovementAt: text("last_movement_at"),
  ordinal: integer("ordinal").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const solutions = pgTable("solutions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  streamId: text("stream_id").notNull(),
  milestoneDate: text("milestone_date"),
  priority: integer("priority"),
  phases: text("phases").array().notNull().default([]),
  owners: text("owners").array().notNull().default([]),
  labels: text("labels").array().notNull().default([]),
  status: text("status").notNull().default("In Progress"),
  momentumStatus: text("momentum_status").notNull().default("Active"),
  lastMovementAt: text("last_movement_at"),
  ordinal: integer("ordinal").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const deliverables = pgTable("deliverables", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  solutionId: text("solution_id").notNull(),
  streamId: text("stream_id").notNull(),
  borderColor: text("border_color").notNull().default("cyan"),
  owners: text("owners").array().notNull().default([]),
  ordinal: integer("ordinal").notNull(),
  isMilestoneLinked: boolean("is_milestone_linked").notNull().default(true),
  dueDate: text("due_date"),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const actions = pgTable("actions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  solutionId: text("solution_id").notNull(),
  deliverableId: text("deliverable_id"),
  streamId: text("stream_id").notNull(),
  status: text("status").notNull().default("Backlog"),
  dueDate: text("due_date"),
  effort: integer("effort"),
  owners: text("owners").array().notNull().default([]),
  labels: text("labels").array().notNull().default([]),
  kanbanOrder: integer("kanban_order").notNull().default(1),
  ordinal: integer("ordinal").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const steps = pgTable("steps", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  note: text("note"),
  actionId: text("action_id").notNull(),
  isDone: boolean("is_done").notNull().default(false),
  dueDate: text("due_date"),
  owner: text("owner"),
  ordinal: integer("ordinal").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  photoUrl: text("photo_url"),
  photoData: text("photo_data"),
  ordinal: integer("ordinal").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const stakeholders = pgTable("stakeholders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const stakeholderTags = pgTable("stakeholder_tags", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  stakeholderId: text("stakeholder_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const meetings = pgTable("meetings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  scheduledAt: text("scheduled_at"),
  notes: text("notes"),
  status: text("status").notNull().default("planned"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const meetingItems = pgTable("meeting_items", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull(),
  stakeholderId: text("stakeholder_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  discussionNotes: text("discussion_notes"),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

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

export const DeliverableBorderColor = {
  CYAN: "cyan",
  MAGENTA: "magenta",
  YELLOW: "yellow",
  LIME: "lime",
  ORANGE: "orange",
  PINK: "pink",
  BLUE: "blue",
  GREEN: "green",
} as const;

export type DeliverableBorderColorType = (typeof DeliverableBorderColor)[keyof typeof DeliverableBorderColor];

export type MomentumStatusType = (typeof MomentumStatus)[keyof typeof MomentumStatus];

export const SolutionStatus = {
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
} as const;

export type SolutionStatusType = (typeof SolutionStatus)[keyof typeof SolutionStatus];

export const Phases = {
  STRATEGY: "STRATEGY",
  DESIGN: "DESIGN",
  MODERNIZATION_MIGRATION: "MODERNIZATION & MIGRATION",
  MANAGE: "MANAGE",
} as const;

export type PhaseType = (typeof Phases)[keyof typeof Phases];

export const UserRole = {
  ADMIN: "admin",
  MEMBER: "member",
  PENDING: "pending",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRoleType;
  showDescriptions: boolean;
  themePreference: "light" | "dark" | "system";
  createdAt: string;
}

export interface MagicLinkToken {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export const insertUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1, "Name is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export interface Stream {
  id: string;
  userId: string;
  key: string;
  name: string;
  description?: string;
  phases: string[];
  owners: string[];
  labels: string[];
  status: SolutionStatusType;
  momentumStatus: MomentumStatusType;
  computedMilestoneDate?: string;
  lastMovementAt?: string;
  ordinal: number;
  isDeleted: boolean;
}

export interface Solution {
  id: string;
  userId: string;
  key: string;
  name: string;
  description?: string;
  streamId: string;
  milestoneDate?: string;
  priority?: number;
  phases: string[];
  owners: string[];
  labels: string[];
  status: SolutionStatusType;
  momentumStatus: MomentumStatusType;
  lastMovementAt?: string;
  ordinal: number;
  isDeleted: boolean;
}

export interface Deliverable {
  id: string;
  userId: string;
  key: string;
  name: string;
  description?: string;
  solutionId: string;
  streamId: string;
  borderColor: DeliverableBorderColorType;
  owners: string[];
  ordinal: number;
  isMilestoneLinked: boolean;
  dueDate?: string;
  isDeleted: boolean;
}

export interface Action {
  id: string;
  userId: string;
  key: string;
  name: string;
  description?: string;
  solutionId: string;
  deliverableId?: string;
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
  userId: string;
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

export const CommentEntityType = {
  SOLUTION: "solution",
  DELIVERABLE: "deliverable",
  ACTION: "action",
  STEP: "step",
} as const;

export type CommentEntityTypeValue = (typeof CommentEntityType)[keyof typeof CommentEntityType];

export interface Comment {
  id: string;
  userId: string;
  entityType: CommentEntityTypeValue;
  entityId: string;
  content: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  role?: string;
  photoUrl?: string;
  photoData?: string;
  ordinal: number;
  isDeleted: boolean;
}

export const TagEntityType = {
  STREAM: "stream",
  SOLUTION: "solution",
  ACTION: "action",
  STEP: "step",
} as const;

export type TagEntityTypeValue = (typeof TagEntityType)[keyof typeof TagEntityType];

export interface Stakeholder {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface StakeholderTag {
  id: string;
  userId: string;
  stakeholderId: string;
  entityType: TagEntityTypeValue;
  entityId: string;
  createdAt: string;
}

export const MeetingStatus = {
  PLANNED: "planned",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type MeetingStatusType = (typeof MeetingStatus)[keyof typeof MeetingStatus];

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  scheduledAt?: string;
  notes?: string;
  status: MeetingStatusType;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingItem {
  id: string;
  meetingId: string;
  stakeholderId: string;
  entityType: TagEntityTypeValue;
  entityId: string;
  discussionNotes?: string;
  isResolved: boolean;
  createdAt: string;
}

export const insertStreamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  phases: z.array(z.string()).default([]),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  status: z.nativeEnum(SolutionStatus).optional(),
});

export const insertSolutionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  streamId: z.string().min(1, "Stream is required"),
  milestoneDate: z.string().optional(),
  priority: z.number().int().min(1).max(5).nullable().optional(),
  phases: z.array(z.string()).default([]),
  owners: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  status: z.string().default("In Progress"),
});

export const insertDeliverableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  solutionId: z.string().min(1, "Solution is required"),
  streamId: z.string().min(1, "Stream is required"),
  borderColor: z.string().default("cyan"),
  owners: z.array(z.string()).default([]),
  ordinal: z.number().optional(),
  isMilestoneLinked: z.boolean().default(true),
  dueDate: z.string().optional(),
});

export const insertActionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  solutionId: z.string().min(1, "Solution is required"),
  deliverableId: z.string().optional(),
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

export const insertCommentSchema = z.object({
  entityType: z.enum(["solution", "deliverable", "action", "step"]),
  entityId: z.string().min(1, "Entity ID is required"),
  content: z.string().min(1, "Comment content is required"),
});

export const insertTeamMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(),
  photoUrl: z.string().optional(),
  photoData: z.string().optional(),
});

export const insertStakeholderSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

export const insertStakeholderTagSchema = z.object({
  stakeholderId: z.string().min(1, "Stakeholder is required"),
  entityType: z.enum(["stream", "solution", "action", "step"]),
  entityId: z.string().min(1, "Entity ID is required"),
});

export const insertMeetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  scheduledAt: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["planned", "completed", "cancelled"]).default("planned"),
});

export const insertMeetingItemSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  stakeholderId: z.string().min(1, "Stakeholder ID is required"),
  entityType: z.enum(["stream", "solution", "action", "step"]),
  entityId: z.string().min(1, "Entity ID is required"),
  discussionNotes: z.string().optional(),
  isResolved: z.boolean().default(false),
});

export type InsertStream = z.infer<typeof insertStreamSchema>;
export type InsertSolution = z.infer<typeof insertSolutionSchema>;
export type InsertDeliverable = z.infer<typeof insertDeliverableSchema>;
export type InsertAction = z.infer<typeof insertActionSchema>;
export type InsertStep = z.infer<typeof insertStepSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type InsertStakeholder = z.infer<typeof insertStakeholderSchema>;
export type InsertStakeholderTag = z.infer<typeof insertStakeholderTagSchema>;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type InsertMeetingItem = z.infer<typeof insertMeetingItemSchema>;

export interface InProgressSolutionInfo {
  name: string;
  progress: number;
  isEarliest: boolean;
  milestoneDate?: string;
  priority?: number;
}

export interface StreamWithProgress extends Stream {
  progress: number;
  solutionCount: number;
  doingCount: number;
  blockedCount: number;
  delegatedCount: number;
  inProgressSolutions: InProgressSolutionInfo[];
  displayKey: string;
}

export interface SolutionWithProgress extends Solution {
  progress: number;
  actionCount: number;
  deliverableCount: number;
  doingCount: number;
  blockedCount: number;
  delegatedCount: number;
  displayKey: string;
}

export interface ActiveActionInfo {
  id: string;
  name: string;
  status: ActionStatusType;
}

export interface DeliverableBreakdown {
  id: string;
  name: string;
  borderColor: DeliverableBorderColorType;
  activeActions: ActiveActionInfo[];
}

export interface SolutionWithDeliverableBreakdown extends SolutionWithProgress {
  deliverableBreakdown: DeliverableBreakdown[];
}

export interface DeliverableWithActions extends Deliverable {
  actions: ActionWithProgress[];
}

export interface ActionWithProgress extends Action {
  progress: number;
  stepCount: number;
  doneStepCount: number;
}

export interface SolutionWithLastComment extends SolutionWithProgress {
  lastComment?: Comment;
}

export interface DeliverableWithLastComment extends Deliverable {
  lastComment?: Comment;
}

export interface ActionWithLastComment extends ActionWithProgress {
  lastComment?: Comment;
}

export interface SolutionWithBreakdownAndComment extends SolutionWithDeliverableBreakdown {
  lastComment?: Comment;
}

export interface StakeholderWithTags extends Stakeholder {
  tagCount: number;
}

export interface TaggedItem {
  tag: StakeholderTag;
  entityType: TagEntityTypeValue;
  entityId: string;
  entityName: string;
  parentName?: string;
  grandparentName?: string;
}

export interface MeetingWithItems extends Meeting {
  items: MeetingItemWithEntity[];
  stakeholderNames: string[];
}

export interface MeetingItemWithEntity extends MeetingItem {
  entityName: string;
  parentName?: string;
  stakeholderName: string;
}
