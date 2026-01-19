import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { Pool } from "pg";
import {
  type Stream,
  type Solution,
  type Deliverable,
  type Action,
  type Step,
  type Comment,
  type TeamMember,
  type Stakeholder,
  type StakeholderTag,
  type Meeting,
  type MeetingItem,
  type MeetingWithItems,
  type MeetingItemWithEntity,
  type TaggedItem,
  type InsertStream,
  type InsertSolution,
  type InsertDeliverable,
  type InsertAction,
  type InsertStep,
  type InsertComment,
  type InsertTeamMember,
  type InsertStakeholder,
  type InsertStakeholderTag,
  type InsertMeeting,
  type InsertMeetingItem,
  type StreamWithProgress,
  type SolutionWithProgress,
  type SolutionWithBreakdownAndComment,
  type DeliverableBreakdown,
  type DeliverableWithActions,
  type ActionWithProgress,
  type ActionWithLastComment,
  type CommentEntityTypeValue,
  type TagEntityTypeValue,
  ActionStatus,
  MomentumStatus,
  SolutionStatus,
  CommentEntityType,
  TagEntityType,
  streams,
  solutions,
  deliverables,
  actions,
  steps,
  comments,
  teamMembers,
  stakeholders,
  stakeholderTags,
  meetings,
  meetingItems,
} from "@shared/schema";
import { randomUUID } from "crypto";
import type { IStorage } from "./storage";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

function mapStreamFromDb(row: any): Stream {
  return {
    id: row.id,
    userId: row.userId,
    key: row.key,
    name: row.name,
    description: row.description || undefined,
    phases: row.phases || [],
    owners: row.owners || [],
    labels: row.labels || [],
    status: row.status || SolutionStatus.IN_PROGRESS,
    momentumStatus: row.momentumStatus as any,
    computedMilestoneDate: row.computedMilestoneDate || undefined,
    lastMovementAt: row.lastMovementAt || undefined,
    ordinal: row.ordinal,
    isDeleted: row.isDeleted,
  };
}

function mapSolutionFromDb(row: any): Solution {
  return {
    id: row.id,
    userId: row.userId,
    key: row.key,
    name: row.name,
    description: row.description || undefined,
    streamId: row.streamId,
    milestoneDate: row.milestoneDate || undefined,
    priority: row.priority ?? undefined,
    phases: row.phases || [],
    owners: row.owners || [],
    labels: row.labels || [],
    status: row.status as any,
    momentumStatus: (row.momentumStatus as any) || MomentumStatus.ACTIVE,
    lastMovementAt: row.lastMovementAt || undefined,
    ordinal: row.ordinal,
    isDeleted: row.isDeleted,
  };
}

function mapDeliverableFromDb(row: any): Deliverable {
  return {
    id: row.id,
    userId: row.userId,
    key: row.key,
    name: row.name,
    description: row.description || undefined,
    solutionId: row.solutionId,
    streamId: row.streamId,
    borderColor: row.borderColor as any,
    owners: row.owners || [],
    ordinal: row.ordinal,
    isMilestoneLinked: row.isMilestoneLinked,
    dueDate: row.dueDate || undefined,
    isDeleted: row.isDeleted,
  };
}

function mapActionFromDb(row: any): Action {
  return {
    id: row.id,
    userId: row.userId,
    key: row.key,
    name: row.name,
    description: row.description || undefined,
    solutionId: row.solutionId,
    deliverableId: row.deliverableId || undefined,
    streamId: row.streamId,
    status: row.status as any,
    dueDate: row.dueDate || undefined,
    effort: row.effort || undefined,
    owners: row.owners || [],
    labels: row.labels || [],
    kanbanOrder: row.kanbanOrder,
    ordinal: row.ordinal,
    isDeleted: row.isDeleted,
  };
}

function mapStepFromDb(row: any): Step {
  return {
    id: row.id,
    userId: row.userId,
    key: row.key,
    name: row.name,
    note: row.note || undefined,
    actionId: row.actionId,
    isDone: row.isDone,
    dueDate: row.dueDate || undefined,
    owner: row.owner || undefined,
    ordinal: row.ordinal,
    isDeleted: row.isDeleted,
  };
}

function mapCommentFromDb(row: any): Comment {
  return {
    id: row.id,
    userId: row.userId,
    entityType: row.entityType as CommentEntityTypeValue,
    entityId: row.entityId,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function mapTeamMemberFromDb(row: any): TeamMember {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    role: row.role || undefined,
    photoUrl: row.photoUrl || undefined,
    photoData: row.photoData || undefined,
    ordinal: row.ordinal,
    isDeleted: row.isDeleted,
  };
}

function mapStakeholderFromDb(row: any): Stakeholder {
  return {
    id: row.id,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    createdAt: row.createdAt,
  };
}

function mapStakeholderTagFromDb(row: any): StakeholderTag {
  return {
    id: row.id,
    userId: row.userId,
    stakeholderId: row.stakeholderId,
    entityType: row.entityType as TagEntityTypeValue,
    entityId: row.entityId,
    createdAt: row.createdAt,
  };
}

function mapMeetingFromDb(row: any): Meeting {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    scheduledAt: row.scheduledAt || undefined,
    notes: row.notes || undefined,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMeetingItemFromDb(row: any): MeetingItem {
  return {
    id: row.id,
    meetingId: row.meetingId,
    stakeholderId: row.stakeholderId,
    entityType: row.entityType as TagEntityTypeValue,
    entityId: row.entityId,
    discussionNotes: row.discussionNotes || undefined,
    isResolved: row.isResolved,
    createdAt: row.createdAt,
  };
}

export class DatabaseStorage implements IStorage {
  private async computeActionProgress(actionId: string, userId: string): Promise<{ progress: number; stepCount: number; doneStepCount: number }> {
    const actionSteps = await db.select().from(steps).where(
      and(eq(steps.actionId, actionId), eq(steps.userId, userId), eq(steps.isDeleted, false))
    );
    const doneStepCount = actionSteps.filter((s) => s.isDone).length;
    const stepCount = actionSteps.length;
    
    if (stepCount === 0) {
      const [action] = await db.select().from(actions).where(
        and(eq(actions.id, actionId), eq(actions.userId, userId))
      );
      if (!action) return { progress: 0, stepCount: 0, doneStepCount: 0 };
      switch (action.status) {
        case ActionStatus.DONE:
          return { progress: 100, stepCount: 0, doneStepCount: 0 };
        case ActionStatus.EXECUTING:
          return { progress: 50, stepCount: 0, doneStepCount: 0 };
        default:
          return { progress: 0, stepCount: 0, doneStepCount: 0 };
      }
    }
    
    return {
      progress: Math.round((doneStepCount / stepCount) * 100),
      stepCount,
      doneStepCount,
    };
  }

  private async computeSolutionProgress(solutionId: string, userId: string): Promise<{
    progress: number;
    actionCount: number;
    deliverableCount: number;
    doingCount: number;
    blockedCount: number;
    delegatedCount: number;
  }> {
    const solutionActions = await db.select().from(actions).where(
      and(eq(actions.solutionId, solutionId), eq(actions.userId, userId), eq(actions.isDeleted, false))
    );
    const solutionDeliverables = await db.select().from(deliverables).where(
      and(eq(deliverables.solutionId, solutionId), eq(deliverables.userId, userId), eq(deliverables.isDeleted, false))
    );

    const actionCount = solutionActions.length;
    const deliverableCount = solutionDeliverables.length;
    const doingCount = solutionActions.filter((a) => a.status === ActionStatus.EXECUTING).length;
    const blockedCount = solutionActions.filter((a) => a.status === ActionStatus.BLOCKED).length;
    const delegatedCount = solutionActions.filter((a) => a.status === ActionStatus.DELEGATED).length;

    if (actionCount === 0) {
      return { progress: 0, actionCount, deliverableCount, doingCount, blockedCount, delegatedCount };
    }

    let totalProgress = 0;
    for (const action of solutionActions) {
      const { progress } = await this.computeActionProgress(action.id, userId);
      totalProgress += progress;
    }

    return {
      progress: Math.round(totalProgress / actionCount),
      actionCount,
      deliverableCount,
      doingCount,
      blockedCount,
      delegatedCount,
    };
  }

  async getStreams(userId: string): Promise<StreamWithProgress[]> {
    const rows = await db.select().from(streams).where(
      and(eq(streams.userId, userId), eq(streams.isDeleted, false))
    );
    
    // Sort by ordinal to ensure consistent display key numbering
    rows.sort((a, b) => a.ordinal - b.ordinal);
    
    const result: StreamWithProgress[] = [];
    let displayIndex = 1;
    for (const row of rows) {
      const stream = mapStreamFromDb(row);
      const streamSolutions = await db.select().from(solutions).where(
        and(eq(solutions.streamId, stream.id), eq(solutions.userId, userId), eq(solutions.isDeleted, false))
      );
      
      let totalProgress = 0;
      let doingCount = 0;
      let blockedCount = 0;
      let delegatedCount = 0;
      const inProgressSolutions: { name: string; progress: number; isEarliest: boolean; milestoneDate?: string; priority?: number }[] = [];

      const inProgressWithDates: { name: string; progress: number; milestoneDate?: string; priority?: number }[] = [];

      for (const sol of streamSolutions) {
        const stats = await this.computeSolutionProgress(sol.id, userId);
        totalProgress += stats.progress;
        doingCount += stats.doingCount;
        blockedCount += stats.blockedCount;
        delegatedCount += stats.delegatedCount;
        
        if (sol.status === SolutionStatus.IN_PROGRESS) {
          inProgressWithDates.push({
            name: sol.name,
            progress: stats.progress,
            milestoneDate: sol.milestoneDate || undefined,
            priority: sol.priority || undefined,
          });
        }
      }

      let earliestDate: string | undefined = undefined;
      for (const sol of inProgressWithDates) {
        if (sol.milestoneDate) {
          if (!earliestDate || sol.milestoneDate < earliestDate) {
            earliestDate = sol.milestoneDate;
          }
        }
      }
      
      for (const sol of inProgressWithDates) {
        inProgressSolutions.push({
          name: sol.name,
          progress: sol.progress,
          isEarliest: sol.milestoneDate === earliestDate && earliestDate !== undefined,
          milestoneDate: sol.milestoneDate,
          priority: sol.priority,
        });
      }

      result.push({
        ...stream,
        progress: streamSolutions.length > 0 ? Math.round(totalProgress / streamSolutions.length) : 0,
        solutionCount: streamSolutions.length,
        doingCount,
        blockedCount,
        delegatedCount,
        inProgressSolutions,
        displayKey: `Stream ${displayIndex}`,
      });
      displayIndex++;
    }
    
    return result;
  }

  async getStream(userId: string, id: string): Promise<Stream | undefined> {
    const [row] = await db.select().from(streams).where(
      and(eq(streams.id, id), eq(streams.userId, userId), eq(streams.isDeleted, false))
    );
    return row ? mapStreamFromDb(row) : undefined;
  }

  async createStream(userId: string, data: InsertStream): Promise<Stream> {
    const id = randomUUID();
    const existingStreams = await db.select().from(streams).where(eq(streams.userId, userId));
    const ordinal = existingStreams.length + 1;
    
    const newStream = {
      id,
      userId,
      key: `STRM${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description || null,
      phases: data.phases || [],
      owners: data.owners || [],
      labels: data.labels || [],
      status: data.status || SolutionStatus.IN_PROGRESS,
      momentumStatus: MomentumStatus.ACTIVE,
      computedMilestoneDate: null,
      lastMovementAt: new Date().toISOString(),
      ordinal,
      isDeleted: false,
    };
    
    await db.insert(streams).values(newStream);
    return mapStreamFromDb(newStream);
  }

  async updateStream(userId: string, id: string, data: Partial<InsertStream & { isDeleted?: boolean; lastMovementAt?: string; momentumStatus?: string }>): Promise<Stream | undefined> {
    const [existing] = await db.select().from(streams).where(
      and(eq(streams.id, id), eq(streams.userId, userId))
    );
    if (!existing) return undefined;
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.phases !== undefined) updateData.phases = data.phases;
    if (data.owners !== undefined) updateData.owners = data.owners;
    if (data.labels !== undefined) updateData.labels = data.labels;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.momentumStatus !== undefined) updateData.momentumStatus = data.momentumStatus;
    if (data.isDeleted !== undefined) updateData.isDeleted = data.isDeleted;
    if (data.lastMovementAt !== undefined) updateData.lastMovementAt = data.lastMovementAt;
    
    await db.update(streams).set(updateData).where(eq(streams.id, id));
    
    const [updated] = await db.select().from(streams).where(eq(streams.id, id));
    return updated ? mapStreamFromDb(updated) : undefined;
  }

  private async updateStreamMilestone(streamId: string, userId: string): Promise<void> {
    const streamSolutions = await db.select().from(solutions).where(
      and(eq(solutions.streamId, streamId), eq(solutions.userId, userId), eq(solutions.isDeleted, false))
    );
    
    const datedSolutions = streamSolutions.filter(s => s.milestoneDate);
    
    let computedMilestoneDate: string | null = null;
    if (datedSolutions.length > 0) {
      computedMilestoneDate = datedSolutions.reduce((min, s) => {
        if (!s.milestoneDate) return min;
        if (!min) return s.milestoneDate;
        return s.milestoneDate < min ? s.milestoneDate : min;
      }, datedSolutions[0].milestoneDate);
    }
    
    await db.update(streams).set({ computedMilestoneDate }).where(eq(streams.id, streamId));
  }

  async deleteStream(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(streams).where(
      and(eq(streams.id, id), eq(streams.userId, userId))
    );
    if (!existing) return false;
    
    // Cascade soft-delete to all child solutions
    const childSolutions = await db.select().from(solutions).where(
      and(eq(solutions.streamId, id), eq(solutions.userId, userId))
    );
    for (const solution of childSolutions) {
      await this.deleteSolution(userId, solution.id);
    }
    
    await db.update(streams).set({ isDeleted: true }).where(eq(streams.id, id));
    return true;
  }

  async getSolutions(userId: string): Promise<SolutionWithProgress[]> {
    const rows = await db.select().from(solutions).where(
      and(eq(solutions.userId, userId), eq(solutions.isDeleted, false))
    );
    
    // Group by streamId and sort by ordinal within each stream
    const byStream = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = byStream.get(row.streamId) || [];
      group.push(row);
      byStream.set(row.streamId, group);
    }
    
    // Get stream ordinals for consistent ordering
    const streamRows = await db.select().from(streams).where(
      and(eq(streams.userId, userId), eq(streams.isDeleted, false))
    );
    const streamOrdinalMap = new Map(streamRows.map(s => [s.id, s.ordinal]));
    
    // Sort stream groups by stream ordinal for consistent global ordering
    const sortedStreamIds = Array.from(byStream.keys()).sort((a, b) => {
      return (streamOrdinalMap.get(a) || 0) - (streamOrdinalMap.get(b) || 0);
    });
    
    const result: SolutionWithProgress[] = [];
    for (const streamId of sortedStreamIds) {
      const streamRows = byStream.get(streamId)!;
      streamRows.sort((a, b) => a.ordinal - b.ordinal);
      let displayIndex = 1;
      for (const row of streamRows) {
        const sol = mapSolutionFromDb(row);
        const stats = await this.computeSolutionProgress(sol.id, userId);
        result.push({ ...sol, ...stats, displayKey: `Solution ${displayIndex}` });
        displayIndex++;
      }
    }
    return result;
  }

  async getSolutionsByStream(userId: string, streamId: string): Promise<SolutionWithProgress[]> {
    const rows = await db.select().from(solutions).where(
      and(eq(solutions.streamId, streamId), eq(solutions.userId, userId), eq(solutions.isDeleted, false))
    );
    
    // Sort by ordinal to ensure consistent display key numbering
    rows.sort((a, b) => a.ordinal - b.ordinal);
    
    const result: SolutionWithProgress[] = [];
    let displayIndex = 1;
    for (const row of rows) {
      const sol = mapSolutionFromDb(row);
      const stats = await this.computeSolutionProgress(sol.id, userId);
      result.push({ ...sol, ...stats, displayKey: `Solution ${displayIndex}` });
      displayIndex++;
    }
    return result;
  }

  async getSolutionsByStreamWithBreakdown(userId: string, streamId: string): Promise<SolutionWithBreakdownAndComment[]> {
    const rows = await db.select().from(solutions).where(
      and(eq(solutions.streamId, streamId), eq(solutions.userId, userId), eq(solutions.isDeleted, false))
    );
    
    // Sort by ordinal to ensure consistent display key numbering
    rows.sort((a, b) => a.ordinal - b.ordinal);
    
    const activeStatuses = [ActionStatus.EXECUTING, ActionStatus.BLOCKED, ActionStatus.DELEGATED];
    const results: SolutionWithBreakdownAndComment[] = [];
    let displayIndex = 1;
    
    for (const row of rows) {
      const sol = mapSolutionFromDb(row);
      const stats = await this.computeSolutionProgress(sol.id, userId);
      
      const solutionDeliverables = await db.select().from(deliverables).where(
        and(eq(deliverables.solutionId, sol.id), eq(deliverables.userId, userId), eq(deliverables.isDeleted, false))
      );
      solutionDeliverables.sort((a, b) => a.ordinal - b.ordinal);
      
      const solutionActions = await db.select().from(actions).where(
        and(eq(actions.solutionId, sol.id), eq(actions.userId, userId), eq(actions.isDeleted, false))
      );
      
      const deliverableBreakdown: DeliverableBreakdown[] = solutionDeliverables.map((del) => {
        const activeActions = solutionActions
          .filter((a) => a.deliverableId === del.id && activeStatuses.includes(a.status as any))
          .map((a) => ({
            id: a.id,
            name: a.name,
            status: a.status as any,
          }));
        
        return {
          id: del.id,
          name: del.name,
          borderColor: del.borderColor as any,
          activeActions,
        };
      });
      
      const unassignedActiveActions = solutionActions
        .filter((a) => !a.deliverableId && activeStatuses.includes(a.status as any))
        .map((a) => ({
          id: a.id,
          name: a.name,
          status: a.status as any,
        }));
      
      if (unassignedActiveActions.length > 0) {
        deliverableBreakdown.unshift({
          id: "unassigned",
          name: "Unassigned",
          borderColor: "cyan" as any,
          activeActions: unassignedActiveActions,
        });
      }
      
      const lastComment = await this.getLastComment(userId, CommentEntityType.SOLUTION, sol.id);
      
      results.push({ ...sol, ...stats, deliverableBreakdown, lastComment, displayKey: `Solution ${displayIndex}` });
      displayIndex++;
    }
    
    return results;
  }

  async getAllSolutionsWithBreakdown(userId: string): Promise<SolutionWithBreakdownAndComment[]> {
    const rows = await db.select().from(solutions).where(
      and(eq(solutions.userId, userId), eq(solutions.isDeleted, false))
    );
    
    // Group by streamId and maintain ordinal ordering within streams
    const byStream = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = byStream.get(row.streamId) || [];
      group.push(row);
      byStream.set(row.streamId, group);
    }
    
    const activeStatuses = [ActionStatus.EXECUTING, ActionStatus.BLOCKED, ActionStatus.DELEGATED];
    const results: SolutionWithBreakdownAndComment[] = [];
    let globalDisplayIndex = 1;
    
    for (const [streamId, streamRows] of byStream) {
      streamRows.sort((a, b) => a.ordinal - b.ordinal);
      
      for (const row of streamRows) {
        const sol = mapSolutionFromDb(row);
        const stats = await this.computeSolutionProgress(sol.id, userId);
        const displayIndex = globalDisplayIndex++;
        
        
        const solutionDeliverables = await db.select().from(deliverables).where(
          and(eq(deliverables.solutionId, sol.id), eq(deliverables.userId, userId), eq(deliverables.isDeleted, false))
        );
        solutionDeliverables.sort((a, b) => a.ordinal - b.ordinal);
        
        const solutionActions = await db.select().from(actions).where(
          and(eq(actions.solutionId, sol.id), eq(actions.userId, userId), eq(actions.isDeleted, false))
        );
        
        const deliverableBreakdown: DeliverableBreakdown[] = solutionDeliverables.map((del) => {
          const activeActions = solutionActions
            .filter((a) => a.deliverableId === del.id && activeStatuses.includes(a.status as any))
            .map((a) => ({
              id: a.id,
              name: a.name,
              status: a.status as any,
            }));
          
          return {
            id: del.id,
            name: del.name,
            borderColor: del.borderColor as any,
            activeActions,
          };
        });
        
        const unassignedActiveActions = solutionActions
          .filter((a) => !a.deliverableId && activeStatuses.includes(a.status as any))
          .map((a) => ({
            id: a.id,
            name: a.name,
            status: a.status as any,
          }));
        
        if (unassignedActiveActions.length > 0) {
          deliverableBreakdown.unshift({
            id: "unassigned",
            name: "Unassigned",
            borderColor: "cyan" as any,
            activeActions: unassignedActiveActions,
          });
        }
        
        const lastComment = await this.getLastComment(userId, CommentEntityType.SOLUTION, sol.id);
        
        results.push({ ...sol, ...stats, deliverableBreakdown, lastComment, displayKey: `Solution ${displayIndex}` });
      }
    }
    
    return results;
  }

  async getSolution(userId: string, id: string): Promise<Solution | undefined> {
    const [row] = await db.select().from(solutions).where(
      and(eq(solutions.id, id), eq(solutions.userId, userId), eq(solutions.isDeleted, false))
    );
    return row ? mapSolutionFromDb(row) : undefined;
  }

  async createSolution(userId: string, data: InsertSolution): Promise<Solution> {
    const [parentStream] = await db.select().from(streams).where(
      and(eq(streams.id, data.streamId), eq(streams.userId, userId), eq(streams.isDeleted, false))
    );
    if (!parentStream) {
      throw new Error("Parent stream not found or access denied");
    }
    
    const id = randomUUID();
    const existingSolutions = await db.select().from(solutions).where(
      and(eq(solutions.streamId, data.streamId), eq(solutions.userId, userId))
    );
    const ordinal = existingSolutions.length + 1;
    
    const newSolution = {
      id,
      userId,
      key: `SOL${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description || null,
      streamId: data.streamId,
      milestoneDate: data.milestoneDate || null,
      priority: data.priority ?? null,
      phases: data.phases || [],
      owners: data.owners || [],
      labels: data.labels || [],
      status: (data.status as any) || SolutionStatus.IN_PROGRESS,
      momentumStatus: MomentumStatus.ACTIVE,
      lastMovementAt: new Date().toISOString(),
      ordinal,
      isDeleted: false,
    };
    
    await db.insert(solutions).values(newSolution);
    await this.updateStreamMilestone(data.streamId, userId);
    await db.update(streams).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(streams.id, data.streamId));
    return mapSolutionFromDb(newSolution);
  }

  async updateSolution(userId: string, id: string, data: Partial<InsertSolution & { isDeleted?: boolean; lastMovementAt?: string; momentumStatus?: string; priority?: number | null }>): Promise<Solution | undefined> {
    const [existing] = await db.select().from(solutions).where(
      and(eq(solutions.id, id), eq(solutions.userId, userId))
    );
    if (!existing) return undefined;
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.milestoneDate !== undefined) updateData.milestoneDate = data.milestoneDate || null;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.phases !== undefined) updateData.phases = data.phases;
    if (data.owners !== undefined) updateData.owners = data.owners;
    if (data.labels !== undefined) updateData.labels = data.labels;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.momentumStatus !== undefined) updateData.momentumStatus = data.momentumStatus;
    if (data.lastMovementAt !== undefined) updateData.lastMovementAt = data.lastMovementAt;
    if (data.isDeleted !== undefined) updateData.isDeleted = data.isDeleted;
    
    await db.update(solutions).set(updateData).where(eq(solutions.id, id));
    
    const [updated] = await db.select().from(solutions).where(eq(solutions.id, id));
    
    if (updated) {
      await this.updateStreamMilestone(updated.streamId, userId);
    }
    
    return updated ? mapSolutionFromDb(updated) : undefined;
  }

  async deleteSolution(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(solutions).where(
      and(eq(solutions.id, id), eq(solutions.userId, userId))
    );
    if (!existing) return false;
    
    // Cascade soft-delete to all child deliverables
    const childDeliverables = await db.select().from(deliverables).where(
      and(eq(deliverables.solutionId, id), eq(deliverables.userId, userId))
    );
    for (const deliverable of childDeliverables) {
      await this.deleteDeliverable(userId, deliverable.id);
    }
    
    // Cascade soft-delete to all actions directly under this solution (unassigned to deliverables)
    const childActions = await db.select().from(actions).where(
      and(eq(actions.solutionId, id), eq(actions.userId, userId))
    );
    for (const action of childActions) {
      await this.deleteAction(userId, action.id);
    }
    
    await db.update(solutions).set({ isDeleted: true }).where(eq(solutions.id, id));
    await this.updateStreamMilestone(existing.streamId, userId);
    return true;
  }

  async getDeliverables(userId: string): Promise<Deliverable[]> {
    const rows = await db.select().from(deliverables).where(
      and(eq(deliverables.userId, userId), eq(deliverables.isDeleted, false))
    );
    return rows.map(mapDeliverableFromDb);
  }

  async getDeliverablesBySolution(userId: string, solutionId: string): Promise<DeliverableWithActions[]> {
    const rows = await db.select().from(deliverables).where(
      and(eq(deliverables.solutionId, solutionId), eq(deliverables.userId, userId), eq(deliverables.isDeleted, false))
    );
    rows.sort((a, b) => a.ordinal - b.ordinal);
    
    const result: DeliverableWithActions[] = [];
    for (const row of rows) {
      const del = mapDeliverableFromDb(row);
      const delActions = await db.select().from(actions).where(
        and(eq(actions.deliverableId, del.id), eq(actions.userId, userId), eq(actions.isDeleted, false))
      );
      delActions.sort((a, b) => a.kanbanOrder - b.kanbanOrder);
      
      const actionsWithProgress: ActionWithProgress[] = [];
      for (const action of delActions) {
        const stats = await this.computeActionProgress(action.id, userId);
        actionsWithProgress.push({ ...mapActionFromDb(action), ...stats });
      }
      
      result.push({ ...del, actions: actionsWithProgress });
    }
    return result;
  }

  async getDeliverable(userId: string, id: string): Promise<Deliverable | undefined> {
    const [row] = await db.select().from(deliverables).where(
      and(eq(deliverables.id, id), eq(deliverables.userId, userId), eq(deliverables.isDeleted, false))
    );
    return row ? mapDeliverableFromDb(row) : undefined;
  }

  async createDeliverable(userId: string, data: InsertDeliverable): Promise<Deliverable> {
    const [parentSolution] = await db.select().from(solutions).where(
      and(eq(solutions.id, data.solutionId), eq(solutions.userId, userId), eq(solutions.isDeleted, false))
    );
    if (!parentSolution) {
      throw new Error("Parent solution not found or access denied");
    }
    
    const id = randomUUID();
    const existingDeliverables = await db.select().from(deliverables).where(
      and(eq(deliverables.solutionId, data.solutionId), eq(deliverables.userId, userId))
    );
    const ordinal = data.ordinal ?? existingDeliverables.length + 1;
    
    const newDeliverable = {
      id,
      userId,
      key: `DEL${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description || null,
      solutionId: data.solutionId,
      streamId: data.streamId,
      borderColor: data.borderColor || "cyan",
      owners: data.owners || [],
      ordinal,
      isMilestoneLinked: data.isMilestoneLinked ?? true,
      dueDate: data.dueDate || null,
      isDeleted: false,
    };
    
    await db.insert(deliverables).values(newDeliverable);
    await db.update(streams).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(streams.id, data.streamId));
    await db.update(solutions).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(solutions.id, data.solutionId));
    return mapDeliverableFromDb(newDeliverable);
  }

  async updateDeliverable(userId: string, id: string, data: Partial<InsertDeliverable & { isDeleted?: boolean }>): Promise<Deliverable | undefined> {
    const [existing] = await db.select().from(deliverables).where(
      and(eq(deliverables.id, id), eq(deliverables.userId, userId))
    );
    if (!existing) return undefined;
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.borderColor !== undefined) updateData.borderColor = data.borderColor;
    if (data.owners !== undefined) updateData.owners = data.owners;
    if (data.ordinal !== undefined) updateData.ordinal = data.ordinal;
    if (data.isMilestoneLinked !== undefined) updateData.isMilestoneLinked = data.isMilestoneLinked;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate || null;
    if (data.isDeleted !== undefined) updateData.isDeleted = data.isDeleted;
    if (data.solutionId !== undefined) updateData.solutionId = data.solutionId;
    
    if (Object.keys(updateData).length === 0) {
      const [current] = await db.select().from(deliverables).where(eq(deliverables.id, id));
      return current ? mapDeliverableFromDb(current) : undefined;
    }
    
    await db.update(deliverables).set(updateData).where(eq(deliverables.id, id));
    
    // When moving a deliverable to a different solution, also move all its child actions
    if (data.solutionId !== undefined && data.solutionId !== existing.solutionId) {
      console.log(`[MOVE DELIVERABLE] Moving deliverable ${id} from solution ${existing.solutionId} to ${data.solutionId}`);
      
      // Get the target solution to find its streamId
      const [targetSolution] = await db.select().from(solutions).where(
        and(eq(solutions.id, data.solutionId), eq(solutions.userId, userId))
      );
      
      console.log(`[MOVE DELIVERABLE] Target solution found: ${!!targetSolution}, streamId: ${targetSolution?.streamId}`);
      
      if (targetSolution) {
        // Update the deliverable's streamId to match the target solution's stream
        await db.update(deliverables).set({ streamId: targetSolution.streamId }).where(eq(deliverables.id, id));
        
        // Update all child actions' solutionId and streamId
        const childActions = await db.select().from(actions).where(
          and(eq(actions.deliverableId, id), eq(actions.userId, userId))
        );
        
        console.log(`[MOVE DELIVERABLE] Found ${childActions.length} child actions to move`);
        
        for (const action of childActions) {
          console.log(`[MOVE DELIVERABLE] Moving action ${action.id} (${action.name})`);
          await db.update(actions).set({ 
            solutionId: data.solutionId,
            streamId: targetSolution.streamId 
          }).where(eq(actions.id, action.id));
        }
      }
    }
    
    const [updated] = await db.select().from(deliverables).where(eq(deliverables.id, id));
    return updated ? mapDeliverableFromDb(updated) : undefined;
  }

  async deleteDeliverable(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(deliverables).where(
      and(eq(deliverables.id, id), eq(deliverables.userId, userId))
    );
    if (!existing) return false;
    
    // Cascade soft-delete to all child actions under this deliverable
    const childActions = await db.select().from(actions).where(
      and(eq(actions.deliverableId, id), eq(actions.userId, userId))
    );
    for (const action of childActions) {
      await this.deleteAction(userId, action.id);
    }
    
    await db.update(deliverables).set({ isDeleted: true }).where(eq(deliverables.id, id));
    return true;
  }

  async getActions(userId: string): Promise<ActionWithLastComment[]> {
    const rows = await db.select().from(actions).where(
      and(eq(actions.userId, userId), eq(actions.isDeleted, false))
    );
    rows.sort((a, b) => a.kanbanOrder - b.kanbanOrder);
    
    const result: ActionWithLastComment[] = [];
    for (const row of rows) {
      const action = mapActionFromDb(row);
      const stats = await this.computeActionProgress(action.id, userId);
      const lastComment = await this.getLastComment(userId, "action", action.id);
      result.push({ ...action, ...stats, lastComment });
    }
    return result;
  }

  async getActionsBySolution(userId: string, solutionId: string): Promise<ActionWithLastComment[]> {
    const rows = await db.select().from(actions).where(
      and(eq(actions.solutionId, solutionId), eq(actions.userId, userId), eq(actions.isDeleted, false))
    );
    rows.sort((a, b) => a.kanbanOrder - b.kanbanOrder);
    
    const result: ActionWithLastComment[] = [];
    for (const row of rows) {
      const action = mapActionFromDb(row);
      const stats = await this.computeActionProgress(action.id, userId);
      const lastComment = await this.getLastComment(userId, "action", action.id);
      result.push({ ...action, ...stats, lastComment });
    }
    return result;
  }

  async getAction(userId: string, id: string): Promise<ActionWithLastComment | undefined> {
    const [row] = await db.select().from(actions).where(
      and(eq(actions.id, id), eq(actions.userId, userId), eq(actions.isDeleted, false))
    );
    if (!row) return undefined;
    
    const action = mapActionFromDb(row);
    const stats = await this.computeActionProgress(action.id, userId);
    const lastComment = await this.getLastComment(userId, "action", action.id);
    return { ...action, ...stats, lastComment };
  }

  async createAction(userId: string, data: InsertAction): Promise<Action> {
    const [parentSolution] = await db.select().from(solutions).where(
      and(eq(solutions.id, data.solutionId), eq(solutions.userId, userId), eq(solutions.isDeleted, false))
    );
    if (!parentSolution) {
      throw new Error("Parent solution not found or access denied");
    }
    
    const id = randomUUID();
    const existingActions = await db.select().from(actions).where(
      and(eq(actions.solutionId, data.solutionId), eq(actions.userId, userId))
    );
    const ordinal = existingActions.length + 1;
    
    const status = data.status || ActionStatus.BACKLOG;
    const sameStatusActions = existingActions.filter(a => a.status === status && !a.isDeleted);
    const maxKanbanOrder = sameStatusActions.reduce((max, a) => Math.max(max, a.kanbanOrder), 0);
    
    const newAction = {
      id,
      userId,
      key: `ACT${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description || null,
      solutionId: data.solutionId,
      deliverableId: data.deliverableId || null,
      streamId: data.streamId,
      status,
      dueDate: data.dueDate || null,
      effort: data.effort || null,
      owners: data.owners || [],
      labels: data.labels || [],
      kanbanOrder: maxKanbanOrder + 1,
      ordinal,
      isDeleted: false,
    };
    
    await db.insert(actions).values(newAction);
    
    await db.update(streams).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(streams.id, data.streamId));
    await db.update(solutions).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(solutions.id, data.solutionId));
    
    return mapActionFromDb(newAction);
  }

  async updateAction(userId: string, id: string, data: Partial<InsertAction & { isDeleted?: boolean; kanbanOrder?: number }>): Promise<Action | undefined> {
    const [existing] = await db.select().from(actions).where(
      and(eq(actions.id, id), eq(actions.userId, userId))
    );
    if (!existing) return undefined;
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.deliverableId !== undefined) updateData.deliverableId = data.deliverableId || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate || null;
    if (data.effort !== undefined) updateData.effort = data.effort || null;
    if (data.owners !== undefined) updateData.owners = data.owners;
    if (data.labels !== undefined) updateData.labels = data.labels;
    if (data.isDeleted !== undefined) updateData.isDeleted = data.isDeleted;
    if (data.kanbanOrder !== undefined) updateData.kanbanOrder = data.kanbanOrder;
    
    await db.update(actions).set(updateData).where(eq(actions.id, id));
    
    await db.update(streams).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(streams.id, existing.streamId));
    await db.update(solutions).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(solutions.id, existing.solutionId));
    
    const [updated] = await db.select().from(actions).where(eq(actions.id, id));
    return updated ? mapActionFromDb(updated) : undefined;
  }

  async deleteAction(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(actions).where(
      and(eq(actions.id, id), eq(actions.userId, userId))
    );
    if (!existing) return false;
    
    // Cascade soft-delete to all child steps under this action
    const childSteps = await db.select().from(steps).where(
      and(eq(steps.actionId, id), eq(steps.userId, userId))
    );
    for (const step of childSteps) {
      await db.update(steps).set({ isDeleted: true }).where(eq(steps.id, step.id));
    }
    
    await db.update(actions).set({ isDeleted: true }).where(eq(actions.id, id));
    return true;
  }

  async getSteps(userId: string): Promise<Step[]> {
    const rows = await db.select().from(steps).where(
      and(eq(steps.userId, userId), eq(steps.isDeleted, false))
    );
    return rows.map(mapStepFromDb);
  }

  async getStepsByAction(userId: string, actionId: string): Promise<Step[]> {
    const rows = await db.select().from(steps).where(
      and(eq(steps.actionId, actionId), eq(steps.userId, userId), eq(steps.isDeleted, false))
    );
    rows.sort((a, b) => a.ordinal - b.ordinal);
    return rows.map(mapStepFromDb);
  }

  async getStep(userId: string, id: string): Promise<Step | undefined> {
    const [row] = await db.select().from(steps).where(
      and(eq(steps.id, id), eq(steps.userId, userId), eq(steps.isDeleted, false))
    );
    return row ? mapStepFromDb(row) : undefined;
  }

  async createStep(userId: string, data: InsertStep): Promise<Step> {
    const [parentAction] = await db.select().from(actions).where(
      and(eq(actions.id, data.actionId), eq(actions.userId, userId), eq(actions.isDeleted, false))
    );
    if (!parentAction) {
      throw new Error("Parent action not found or access denied");
    }
    
    const id = randomUUID();
    const existingSteps = await db.select().from(steps).where(
      and(eq(steps.actionId, data.actionId), eq(steps.userId, userId))
    );
    const ordinal = existingSteps.length + 1;
    
    const newStep = {
      id,
      userId,
      key: `STEP${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      note: data.note || null,
      actionId: data.actionId,
      isDone: data.isDone || false,
      dueDate: data.dueDate || null,
      owner: data.owner || null,
      ordinal,
      isDeleted: false,
    };
    
    await db.insert(steps).values(newStep);
    await db.update(streams).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(streams.id, parentAction.streamId));
    await db.update(solutions).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(solutions.id, parentAction.solutionId));
    return mapStepFromDb(newStep);
  }

  async updateStep(userId: string, id: string, data: Partial<InsertStep & { isDeleted?: boolean }>): Promise<Step | undefined> {
    const [existing] = await db.select().from(steps).where(
      and(eq(steps.id, id), eq(steps.userId, userId))
    );
    if (!existing) return undefined;
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.note !== undefined) updateData.note = data.note || null;
    if (data.isDone !== undefined) updateData.isDone = data.isDone;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate || null;
    if (data.owner !== undefined) updateData.owner = data.owner || null;
    if (data.isDeleted !== undefined) updateData.isDeleted = data.isDeleted;
    
    await db.update(steps).set(updateData).where(eq(steps.id, id));
    
    if (data.isDone !== undefined) {
      const [parentAction] = await db.select().from(actions).where(eq(actions.id, existing.actionId));
      if (parentAction) {
        await db.update(streams).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(streams.id, parentAction.streamId));
        await db.update(solutions).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(solutions.id, parentAction.solutionId));
      }
    }
    
    const [updated] = await db.select().from(steps).where(eq(steps.id, id));
    return updated ? mapStepFromDb(updated) : undefined;
  }

  async deleteStep(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(steps).where(
      and(eq(steps.id, id), eq(steps.userId, userId))
    );
    if (!existing) return false;
    
    await db.update(steps).set({ isDeleted: true }).where(eq(steps.id, id));
    return true;
  }

  async getDeletedItems(userId: string): Promise<{
    streams: Stream[];
    solutions: Solution[];
    deliverables: Deliverable[];
    actions: Action[];
    steps: Step[];
  }> {
    const deletedStreams = await db.select().from(streams).where(
      and(eq(streams.userId, userId), eq(streams.isDeleted, true))
    );
    const deletedSolutions = await db.select().from(solutions).where(
      and(eq(solutions.userId, userId), eq(solutions.isDeleted, true))
    );
    const deletedDeliverables = await db.select().from(deliverables).where(
      and(eq(deliverables.userId, userId), eq(deliverables.isDeleted, true))
    );
    const deletedActions = await db.select().from(actions).where(
      and(eq(actions.userId, userId), eq(actions.isDeleted, true))
    );
    const deletedSteps = await db.select().from(steps).where(
      and(eq(steps.userId, userId), eq(steps.isDeleted, true))
    );
    
    return {
      streams: deletedStreams.map(mapStreamFromDb),
      solutions: deletedSolutions.map(mapSolutionFromDb),
      deliverables: deletedDeliverables.map(mapDeliverableFromDb),
      actions: deletedActions.map(mapActionFromDb),
      steps: deletedSteps.map(mapStepFromDb),
    };
  }

  async restoreStream(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(streams).where(
      and(eq(streams.id, id), eq(streams.userId, userId), eq(streams.isDeleted, true))
    );
    if (!existing) return false;
    
    await db.update(streams).set({ isDeleted: false }).where(eq(streams.id, id));
    return true;
  }

  async restoreSolution(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(solutions).where(
      and(eq(solutions.id, id), eq(solutions.userId, userId), eq(solutions.isDeleted, true))
    );
    if (!existing) return false;
    
    await db.update(solutions).set({ isDeleted: false }).where(eq(solutions.id, id));
    return true;
  }

  async restoreDeliverable(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(deliverables).where(
      and(eq(deliverables.id, id), eq(deliverables.userId, userId), eq(deliverables.isDeleted, true))
    );
    if (!existing) return false;
    
    await db.update(deliverables).set({ isDeleted: false }).where(eq(deliverables.id, id));
    return true;
  }

  async restoreAction(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(actions).where(
      and(eq(actions.id, id), eq(actions.userId, userId), eq(actions.isDeleted, true))
    );
    if (!existing) return false;
    
    await db.update(actions).set({ isDeleted: false }).where(eq(actions.id, id));
    return true;
  }

  async restoreStep(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(steps).where(
      and(eq(steps.id, id), eq(steps.userId, userId), eq(steps.isDeleted, true))
    );
    if (!existing) return false;
    
    await db.update(steps).set({ isDeleted: false }).where(eq(steps.id, id));
    return true;
  }

  async emptyRecycleBin(userId: string): Promise<{ streams: number; solutions: number; deliverables: number; actions: number; steps: number }> {
    const deletedStreams = await db.select().from(streams).where(
      and(eq(streams.userId, userId), eq(streams.isDeleted, true))
    );
    const deletedSolutions = await db.select().from(solutions).where(
      and(eq(solutions.userId, userId), eq(solutions.isDeleted, true))
    );
    const deletedDeliverables = await db.select().from(deliverables).where(
      and(eq(deliverables.userId, userId), eq(deliverables.isDeleted, true))
    );
    const deletedActions = await db.select().from(actions).where(
      and(eq(actions.userId, userId), eq(actions.isDeleted, true))
    );
    const deletedSteps = await db.select().from(steps).where(
      and(eq(steps.userId, userId), eq(steps.isDeleted, true))
    );

    if (deletedSteps.length > 0) {
      await db.delete(steps).where(
        and(eq(steps.userId, userId), eq(steps.isDeleted, true))
      );
    }
    if (deletedActions.length > 0) {
      await db.delete(actions).where(
        and(eq(actions.userId, userId), eq(actions.isDeleted, true))
      );
    }
    if (deletedDeliverables.length > 0) {
      await db.delete(deliverables).where(
        and(eq(deliverables.userId, userId), eq(deliverables.isDeleted, true))
      );
    }
    if (deletedSolutions.length > 0) {
      await db.delete(solutions).where(
        and(eq(solutions.userId, userId), eq(solutions.isDeleted, true))
      );
    }
    if (deletedStreams.length > 0) {
      await db.delete(streams).where(
        and(eq(streams.userId, userId), eq(streams.isDeleted, true))
      );
    }

    return {
      streams: deletedStreams.length,
      solutions: deletedSolutions.length,
      deliverables: deletedDeliverables.length,
      actions: deletedActions.length,
      steps: deletedSteps.length,
    };
  }

  async seedExampleData(userId: string): Promise<void> {
    const hasData = await this.hasExampleData(userId);
    if (hasData) return;

    const stream1Id = randomUUID();
    const stream2Id = randomUUID();
    const stream3Id = randomUUID();

    await db.insert(streams).values([
      {
        id: stream1Id,
        userId,
        key: "STRM01",
        name: "[Example] Marketing Campaign Launch",
        description: "A product launch marketing campaign with digital and print strategies",
        phases: ["Execution"],
        owners: ["Marketing Lead"],
        labels: ["marketing", "launch"],
        momentumStatus: MomentumStatus.ACTIVE,
        lastMovementAt: new Date().toISOString(),
        ordinal: 1,
        isDeleted: false,
      },
      {
        id: stream2Id,
        userId,
        key: "STRM02",
        name: "[Example] Build a Sailboat",
        description: "Construct a small wooden sailboat for recreational use",
        phases: ["Planning"],
        owners: ["Project Manager"],
        labels: ["construction", "hobby"],
        momentumStatus: MomentumStatus.ACTIVE,
        lastMovementAt: new Date().toISOString(),
        ordinal: 2,
        isDeleted: false,
      },
      {
        id: stream3Id,
        userId,
        key: "STRM03",
        name: "[Example] Company Christmas Party",
        description: "Organize the annual company holiday celebration",
        phases: ["Planning"],
        owners: ["HR Team"],
        labels: ["event", "company-wide"],
        momentumStatus: MomentumStatus.ACTIVE,
        lastMovementAt: new Date().toISOString(),
        ordinal: 3,
        isDeleted: false,
      },
    ]);

    const sol1Id = randomUUID();
    const sol2Id = randomUUID();
    const sol3Id = randomUUID();
    const sol4Id = randomUUID();
    const sol5Id = randomUUID();
    const sol6Id = randomUUID();
    const sol7Id = randomUUID();

    await db.insert(solutions).values([
      { id: sol1Id, userId, key: "SOL01", name: "Digital Marketing", description: "Online advertising and social media campaigns", streamId: stream1Id, phases: [], owners: [], labels: [], status: SolutionStatus.IN_PROGRESS, ordinal: 1, isDeleted: false },
      { id: sol2Id, userId, key: "SOL02", name: "Print Materials", description: "Brochures and promotional materials for events", streamId: stream1Id, phases: [], owners: [], labels: [], status: SolutionStatus.IN_PROGRESS, ordinal: 2, isDeleted: false },
      { id: sol3Id, userId, key: "SOL01", name: "Hull Construction", description: "Build the main body of the boat", streamId: stream2Id, phases: [], owners: [], labels: [], status: SolutionStatus.IN_PROGRESS, ordinal: 1, isDeleted: false },
      { id: sol4Id, userId, key: "SOL02", name: "Rigging and Sails", description: "Install mast, boom, and sails", streamId: stream2Id, phases: [], owners: [], labels: [], status: SolutionStatus.IN_PROGRESS, ordinal: 2, isDeleted: false },
      { id: sol5Id, userId, key: "SOL01", name: "Venue and Catering", description: "Secure location and food arrangements", streamId: stream3Id, phases: [], owners: [], labels: [], status: SolutionStatus.IN_PROGRESS, ordinal: 1, isDeleted: false },
      { id: sol6Id, userId, key: "SOL02", name: "Entertainment and Activities", description: "Plan fun activities for the party", streamId: stream3Id, phases: [], owners: [], labels: [], status: SolutionStatus.IN_PROGRESS, ordinal: 2, isDeleted: false },
      { id: sol7Id, userId, key: "SOL03", name: "Invitations and RSVPs", description: "Handle guest communications", streamId: stream3Id, phases: [], owners: [], labels: [], status: SolutionStatus.IN_PROGRESS, ordinal: 3, isDeleted: false },
    ]);

    const del1Id = randomUUID();
    const del2Id = randomUUID();
    const del3Id = randomUUID();
    const del4Id = randomUUID();
    const del5Id = randomUUID();
    const del6Id = randomUUID();
    const del7Id = randomUUID();
    const del8Id = randomUUID();
    const del9Id = randomUUID();
    const del10Id = randomUUID();

    await db.insert(deliverables).values([
      { id: del1Id, userId, key: "DEL01", name: "Social Media", solutionId: sol1Id, streamId: stream1Id, borderColor: "cyan", owners: [], ordinal: 1, isMilestoneLinked: true, isDeleted: false },
      { id: del2Id, userId, key: "DEL02", name: "Email Marketing", solutionId: sol1Id, streamId: stream1Id, borderColor: "magenta", owners: [], ordinal: 2, isMilestoneLinked: true, isDeleted: false },
      { id: del3Id, userId, key: "DEL01", name: "Brochures", solutionId: sol2Id, streamId: stream1Id, borderColor: "yellow", owners: [], ordinal: 1, isMilestoneLinked: true, isDeleted: false },
      { id: del4Id, userId, key: "DEL01", name: "Frame Assembly", solutionId: sol3Id, streamId: stream2Id, borderColor: "lime", owners: [], ordinal: 1, isMilestoneLinked: true, isDeleted: false },
      { id: del5Id, userId, key: "DEL02", name: "Planking", solutionId: sol3Id, streamId: stream2Id, borderColor: "orange", owners: [], ordinal: 2, isMilestoneLinked: true, isDeleted: false },
      { id: del6Id, userId, key: "DEL01", name: "Mast Installation", solutionId: sol4Id, streamId: stream2Id, borderColor: "pink", owners: [], ordinal: 1, isMilestoneLinked: true, isDeleted: false },
      { id: del7Id, userId, key: "DEL01", name: "Venue Selection", solutionId: sol5Id, streamId: stream3Id, borderColor: "blue", owners: [], ordinal: 1, isMilestoneLinked: true, isDeleted: false },
      { id: del8Id, userId, key: "DEL02", name: "Catering", solutionId: sol5Id, streamId: stream3Id, borderColor: "green", owners: [], ordinal: 2, isMilestoneLinked: true, isDeleted: false },
      { id: del9Id, userId, key: "DEL01", name: "Music and Games", solutionId: sol6Id, streamId: stream3Id, borderColor: "cyan", owners: [], ordinal: 1, isMilestoneLinked: true, isDeleted: false },
      { id: del10Id, userId, key: "DEL01", name: "Guest Communications", solutionId: sol7Id, streamId: stream3Id, borderColor: "magenta", owners: [], ordinal: 1, isMilestoneLinked: true, isDeleted: false },
    ]);

    const actionData = [
      { solutionId: sol1Id, deliverableId: del1Id, streamId: stream1Id, name: "Create content calendar", status: ActionStatus.DONE },
      { solutionId: sol1Id, deliverableId: del1Id, streamId: stream1Id, name: "Design social media graphics", status: ActionStatus.EXECUTING },
      { solutionId: sol1Id, deliverableId: del1Id, streamId: stream1Id, name: "Set up ad campaigns", status: ActionStatus.TO_EXECUTE },
      { solutionId: sol1Id, deliverableId: del2Id, streamId: stream1Id, name: "Build email list segments", status: ActionStatus.DONE },
      { solutionId: sol1Id, deliverableId: del2Id, streamId: stream1Id, name: "Design email templates", status: ActionStatus.EXECUTING },
      { solutionId: sol2Id, deliverableId: del3Id, streamId: stream1Id, name: "Write copy for brochures", status: ActionStatus.BACKLOG },
      { solutionId: sol2Id, deliverableId: del3Id, streamId: stream1Id, name: "Design brochure layout", status: ActionStatus.BACKLOG },
      { solutionId: sol3Id, deliverableId: del4Id, streamId: stream2Id, name: "Source lumber materials", status: ActionStatus.DONE },
      { solutionId: sol3Id, deliverableId: del4Id, streamId: stream2Id, name: "Cut frame pieces", status: ActionStatus.EXECUTING },
      { solutionId: sol3Id, deliverableId: del4Id, streamId: stream2Id, name: "Assemble keel and ribs", status: ActionStatus.TO_EXECUTE },
      { solutionId: sol3Id, deliverableId: del5Id, streamId: stream2Id, name: "Steam bend planks", status: ActionStatus.BACKLOG },
      { solutionId: sol3Id, deliverableId: del5Id, streamId: stream2Id, name: "Attach planking to frame", status: ActionStatus.BACKLOG },
      { solutionId: sol4Id, deliverableId: del6Id, streamId: stream2Id, name: "Shape mast from spar", status: ActionStatus.BACKLOG },
      { solutionId: sol4Id, deliverableId: del6Id, streamId: stream2Id, name: "Install mast step and partners", status: ActionStatus.BACKLOG },
      { solutionId: sol5Id, deliverableId: del7Id, streamId: stream3Id, name: "Research venue options", status: ActionStatus.DONE },
      { solutionId: sol5Id, deliverableId: del7Id, streamId: stream3Id, name: "Visit and book venue", status: ActionStatus.EXECUTING },
      { solutionId: sol5Id, deliverableId: del8Id, streamId: stream3Id, name: "Select catering company", status: ActionStatus.TO_EXECUTE },
      { solutionId: sol5Id, deliverableId: del8Id, streamId: stream3Id, name: "Plan menu with dietary options", status: ActionStatus.BACKLOG },
      { solutionId: sol6Id, deliverableId: del9Id, streamId: stream3Id, name: "Book DJ or band", status: ActionStatus.BACKLOG },
      { solutionId: sol6Id, deliverableId: del9Id, streamId: stream3Id, name: "Plan party games", status: ActionStatus.BACKLOG },
      { solutionId: sol6Id, deliverableId: del9Id, streamId: stream3Id, name: "Organize Secret Santa", status: ActionStatus.EXECUTING },
      { solutionId: sol7Id, deliverableId: del10Id, streamId: stream3Id, name: "Design invitation", status: ActionStatus.DONE },
      { solutionId: sol7Id, deliverableId: del10Id, streamId: stream3Id, name: "Send invitations", status: ActionStatus.DONE },
      { solutionId: sol7Id, deliverableId: del10Id, streamId: stream3Id, name: "Track RSVPs", status: ActionStatus.EXECUTING },
    ];

    const actionIds: string[] = [];
    for (let i = 0; i < actionData.length; i++) {
      const id = randomUUID();
      actionIds.push(id);
      await db.insert(actions).values({
        id,
        userId,
        key: `ACT${String(i + 1).padStart(2, "0")}`,
        name: actionData[i].name,
        solutionId: actionData[i].solutionId,
        deliverableId: actionData[i].deliverableId,
        streamId: actionData[i].streamId,
        status: actionData[i].status,
        owners: [],
        labels: [],
        kanbanOrder: i + 1,
        ordinal: i + 1,
        isDeleted: false,
      });
    }

    for (let i = 0; i < actionIds.length; i++) {
      for (let j = 1; j <= 3; j++) {
        const isDone = actionData[i].status === ActionStatus.DONE;
        await db.insert(steps).values({
          id: randomUUID(),
          userId,
          key: `STEP${String(j).padStart(2, "0")}`,
          name: `Step ${j} for action`,
          actionId: actionIds[i],
          isDone,
          ordinal: j,
          isDeleted: false,
        });
      }
    }
  }

  async hasExampleData(userId: string): Promise<boolean> {
    const userStreams = await db.select().from(streams).where(eq(streams.userId, userId));
    return userStreams.some(s => s.name.includes("[Example]"));
  }

  async getComments(userId: string, entityType: CommentEntityTypeValue, entityId: string): Promise<Comment[]> {
    const rows = await db.select().from(comments).where(
      and(eq(comments.userId, userId), eq(comments.entityType, entityType), eq(comments.entityId, entityId))
    );
    rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return rows.map(mapCommentFromDb);
  }

  async getLastComment(userId: string, entityType: CommentEntityTypeValue, entityId: string): Promise<Comment | undefined> {
    const rows = await db.select().from(comments).where(
      and(eq(comments.userId, userId), eq(comments.entityType, entityType), eq(comments.entityId, entityId))
    );
    if (rows.length === 0) return undefined;
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return mapCommentFromDb(rows[0]);
  }

  async createComment(userId: string, data: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const newComment = {
      id,
      userId,
      entityType: data.entityType,
      entityId: data.entityId,
      content: data.content,
      createdAt: new Date().toISOString(),
    };
    
    await db.insert(comments).values(newComment);
    return mapCommentFromDb(newComment);
  }

  async updateComment(userId: string, id: string, content: string): Promise<Comment | undefined> {
    const rows = await db.select().from(comments).where(and(eq(comments.id, id), eq(comments.userId, userId)));
    if (rows.length === 0) return undefined;
    
    await db.update(comments).set({ content }).where(and(eq(comments.id, id), eq(comments.userId, userId)));
    
    const updated = await db.select().from(comments).where(eq(comments.id, id));
    return updated.length > 0 ? mapCommentFromDb(updated[0]) : undefined;
  }

  async deleteComment(userId: string, id: string): Promise<boolean> {
    const rows = await db.select().from(comments).where(and(eq(comments.id, id), eq(comments.userId, userId)));
    if (rows.length === 0) return false;
    
    await db.delete(comments).where(and(eq(comments.id, id), eq(comments.userId, userId)));
    return true;
  }

  async getTeamMembers(userId: string): Promise<TeamMember[]> {
    const rows = await db.select().from(teamMembers).where(
      and(eq(teamMembers.userId, userId), eq(teamMembers.isDeleted, false))
    );
    return rows.sort((a, b) => a.ordinal - b.ordinal).map(mapTeamMemberFromDb);
  }

  async getTeamMember(userId: string, id: string): Promise<TeamMember | undefined> {
    const [row] = await db.select().from(teamMembers).where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, userId), eq(teamMembers.isDeleted, false))
    );
    if (!row) return undefined;
    return mapTeamMemberFromDb(row);
  }

  async createTeamMember(userId: string, data: InsertTeamMember): Promise<TeamMember> {
    const id = randomUUID();
    const userMembers = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
    const ordinal = userMembers.length + 1;
    
    const newMember = {
      id,
      userId,
      name: data.name,
      role: data.role || null,
      photoUrl: data.photoUrl || null,
      photoData: data.photoData || null,
      ordinal,
      isDeleted: false,
    };
    
    await db.insert(teamMembers).values(newMember);
    return mapTeamMemberFromDb(newMember);
  }

  async updateTeamMember(userId: string, id: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [existing] = await db.select().from(teamMembers).where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, userId), eq(teamMembers.isDeleted, false))
    );
    if (!existing) return undefined;
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role || null;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl || null;
    if (data.photoData !== undefined) updateData.photoData = data.photoData || null;
    
    await db.update(teamMembers).set(updateData).where(eq(teamMembers.id, id));
    
    const [updated] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return mapTeamMemberFromDb(updated);
  }

  async deleteTeamMember(userId: string, id: string): Promise<boolean> {
    const [existing] = await db.select().from(teamMembers).where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, userId))
    );
    if (!existing) return false;
    
    await db.update(teamMembers).set({ isDeleted: true }).where(eq(teamMembers.id, id));
    return true;
  }

  async getStakeholders(userId: string): Promise<Stakeholder[]> {
    const rows = await db.select().from(stakeholders).where(eq(stakeholders.userId, userId));
    return rows.map(mapStakeholderFromDb);
  }

  async getStakeholder(userId: string, id: string): Promise<Stakeholder | undefined> {
    const [row] = await db.select().from(stakeholders).where(
      and(eq(stakeholders.id, id), eq(stakeholders.userId, userId))
    );
    return row ? mapStakeholderFromDb(row) : undefined;
  }

  async createStakeholder(userId: string, data: InsertStakeholder): Promise<Stakeholder> {
    const id = randomUUID();
    const newStakeholder = {
      id,
      userId,
      firstName: data.firstName,
      lastName: data.lastName,
      createdAt: new Date().toISOString(),
    };
    await db.insert(stakeholders).values(newStakeholder);
    return mapStakeholderFromDb(newStakeholder);
  }

  async updateStakeholder(userId: string, id: string, data: Partial<InsertStakeholder>): Promise<Stakeholder> {
    const [existing] = await db.select().from(stakeholders).where(
      and(eq(stakeholders.id, id), eq(stakeholders.userId, userId))
    );
    if (!existing) {
      throw new Error("Stakeholder not found");
    }
    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    
    await db.update(stakeholders).set(updateData).where(eq(stakeholders.id, id));
    const [updated] = await db.select().from(stakeholders).where(eq(stakeholders.id, id));
    return mapStakeholderFromDb(updated);
  }

  async deleteStakeholder(userId: string, id: string): Promise<void> {
    await db.delete(stakeholderTags).where(
      and(eq(stakeholderTags.stakeholderId, id), eq(stakeholderTags.userId, userId))
    );
    await db.delete(stakeholders).where(
      and(eq(stakeholders.id, id), eq(stakeholders.userId, userId))
    );
  }

  async searchStakeholders(userId: string, query: string): Promise<Stakeholder[]> {
    const searchPattern = `%${query}%`;
    const rows = await db.select().from(stakeholders).where(
      and(
        eq(stakeholders.userId, userId),
        or(
          ilike(stakeholders.firstName, searchPattern),
          ilike(stakeholders.lastName, searchPattern)
        )
      )
    );
    return rows.map(mapStakeholderFromDb);
  }

  async getTagsForEntity(userId: string, entityType: TagEntityTypeValue, entityId: string): Promise<StakeholderTag[]> {
    const rows = await db.select().from(stakeholderTags).where(
      and(
        eq(stakeholderTags.userId, userId),
        eq(stakeholderTags.entityType, entityType),
        eq(stakeholderTags.entityId, entityId)
      )
    );
    return rows.map(mapStakeholderTagFromDb);
  }

  async getTagsByStakeholder(userId: string, stakeholderId: string): Promise<StakeholderTag[]> {
    const rows = await db.select().from(stakeholderTags).where(
      and(eq(stakeholderTags.userId, userId), eq(stakeholderTags.stakeholderId, stakeholderId))
    );
    return rows.map(mapStakeholderTagFromDb);
  }

  async createTag(userId: string, data: InsertStakeholderTag): Promise<StakeholderTag> {
    const id = randomUUID();
    const newTag = {
      id,
      userId,
      stakeholderId: data.stakeholderId,
      entityType: data.entityType,
      entityId: data.entityId,
      createdAt: new Date().toISOString(),
    };
    await db.insert(stakeholderTags).values(newTag);
    return mapStakeholderTagFromDb(newTag);
  }

  async deleteTag(userId: string, tagId: string): Promise<void> {
    await db.delete(stakeholderTags).where(
      and(eq(stakeholderTags.id, tagId), eq(stakeholderTags.userId, userId))
    );
  }

  async deleteAllTagsForStakeholder(userId: string, stakeholderId: string): Promise<void> {
    await db.delete(stakeholderTags).where(
      and(eq(stakeholderTags.stakeholderId, stakeholderId), eq(stakeholderTags.userId, userId))
    );
  }

  async getTaggedItemsForStakeholder(userId: string, stakeholderId: string): Promise<TaggedItem[]> {
    const tags = await db.select().from(stakeholderTags).where(
      and(eq(stakeholderTags.userId, userId), eq(stakeholderTags.stakeholderId, stakeholderId))
    );
    
    const taggedItems: TaggedItem[] = [];
    
    for (const tag of tags) {
      let entityName = "";
      let parentName: string | undefined;
      let grandparentName: string | undefined;
      
      if (tag.entityType === TagEntityType.STREAM) {
        const [stream] = await db.select().from(streams).where(eq(streams.id, tag.entityId));
        entityName = stream?.name || "Unknown Stream";
      } else if (tag.entityType === TagEntityType.SOLUTION) {
        const [solution] = await db.select().from(solutions).where(eq(solutions.id, tag.entityId));
        entityName = solution?.name || "Unknown Solution";
        if (solution?.streamId) {
          const [stream] = await db.select().from(streams).where(eq(streams.id, solution.streamId));
          parentName = stream?.name;
        }
      } else if (tag.entityType === TagEntityType.ACTION) {
        const [action] = await db.select().from(actions).where(eq(actions.id, tag.entityId));
        entityName = action?.name || "Unknown Action";
        if (action?.solutionId) {
          const [solution] = await db.select().from(solutions).where(eq(solutions.id, action.solutionId));
          parentName = solution?.name;
          if (solution?.streamId) {
            const [stream] = await db.select().from(streams).where(eq(streams.id, solution.streamId));
            grandparentName = stream?.name;
          }
        }
      } else if (tag.entityType === TagEntityType.STEP) {
        const [step] = await db.select().from(steps).where(eq(steps.id, tag.entityId));
        entityName = step?.name || "Unknown Step";
        if (step?.actionId) {
          const [action] = await db.select().from(actions).where(eq(actions.id, step.actionId));
          parentName = action?.name;
          if (action?.solutionId) {
            const [solution] = await db.select().from(solutions).where(eq(solutions.id, action.solutionId));
            grandparentName = solution?.name;
          }
        }
      }
      
      taggedItems.push({
        tag: mapStakeholderTagFromDb(tag),
        entityType: tag.entityType as TagEntityTypeValue,
        entityId: tag.entityId,
        entityName,
        parentName,
        grandparentName,
      });
    }
    
    return taggedItems;
  }

  private async buildMeetingWithItems(meeting: Meeting, userId: string): Promise<MeetingWithItems> {
    const itemRows = await db.select().from(meetingItems).where(eq(meetingItems.meetingId, meeting.id));
    
    const items: MeetingItemWithEntity[] = [];
    const stakeholderNames: string[] = [];
    const stakeholderIds = new Set<string>();
    
    for (const item of itemRows) {
      let entityName = "";
      let parentName: string | undefined;
      
      if (item.entityType === TagEntityType.STREAM) {
        const [stream] = await db.select().from(streams).where(eq(streams.id, item.entityId));
        entityName = stream?.name || "Unknown Stream";
      } else if (item.entityType === TagEntityType.SOLUTION) {
        const [solution] = await db.select().from(solutions).where(eq(solutions.id, item.entityId));
        entityName = solution?.name || "Unknown Solution";
        if (solution?.streamId) {
          const [stream] = await db.select().from(streams).where(eq(streams.id, solution.streamId));
          parentName = stream?.name;
        }
      } else if (item.entityType === TagEntityType.ACTION) {
        const [action] = await db.select().from(actions).where(eq(actions.id, item.entityId));
        entityName = action?.name || "Unknown Action";
        if (action?.solutionId) {
          const [solution] = await db.select().from(solutions).where(eq(solutions.id, action.solutionId));
          parentName = solution?.name;
        }
      } else if (item.entityType === TagEntityType.STEP) {
        const [step] = await db.select().from(steps).where(eq(steps.id, item.entityId));
        entityName = step?.name || "Unknown Step";
        if (step?.actionId) {
          const [action] = await db.select().from(actions).where(eq(actions.id, step.actionId));
          parentName = action?.name;
        }
      }
      
      const [stakeholder] = await db.select().from(stakeholders).where(eq(stakeholders.id, item.stakeholderId));
      const stakeholderName = stakeholder ? `${stakeholder.firstName} ${stakeholder.lastName}` : "Unknown";
      
      if (!stakeholderIds.has(item.stakeholderId)) {
        stakeholderIds.add(item.stakeholderId);
        stakeholderNames.push(stakeholderName);
      }
      
      items.push({
        ...mapMeetingItemFromDb(item),
        entityName,
        parentName,
        stakeholderName,
      });
    }
    
    return {
      ...meeting,
      items,
      stakeholderNames,
    };
  }

  async getMeetings(userId: string): Promise<MeetingWithItems[]> {
    const rows = await db.select().from(meetings).where(eq(meetings.userId, userId));
    const results: MeetingWithItems[] = [];
    for (const row of rows) {
      const meeting = mapMeetingFromDb(row);
      results.push(await this.buildMeetingWithItems(meeting, userId));
    }
    return results;
  }

  async getMeeting(userId: string, id: string): Promise<MeetingWithItems | undefined> {
    const [row] = await db.select().from(meetings).where(
      and(eq(meetings.id, id), eq(meetings.userId, userId))
    );
    if (!row) return undefined;
    const meeting = mapMeetingFromDb(row);
    return this.buildMeetingWithItems(meeting, userId);
  }

  async createMeeting(userId: string, data: InsertMeeting): Promise<Meeting> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newMeeting = {
      id,
      userId,
      title: data.title,
      scheduledAt: data.scheduledAt || null,
      notes: data.notes || null,
      status: data.status || "planned",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(meetings).values(newMeeting);
    return mapMeetingFromDb(newMeeting);
  }

  async updateMeeting(userId: string, id: string, data: Partial<InsertMeeting>): Promise<Meeting> {
    const [existing] = await db.select().from(meetings).where(
      and(eq(meetings.id, id), eq(meetings.userId, userId))
    );
    if (!existing) {
      throw new Error("Meeting not found");
    }
    
    const updateData: any = { updatedAt: new Date().toISOString() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.status !== undefined) updateData.status = data.status;
    
    await db.update(meetings).set(updateData).where(eq(meetings.id, id));
    const [updated] = await db.select().from(meetings).where(eq(meetings.id, id));
    return mapMeetingFromDb(updated);
  }

  async deleteMeeting(userId: string, id: string): Promise<void> {
    await db.delete(meetingItems).where(eq(meetingItems.meetingId, id));
    await db.delete(meetings).where(
      and(eq(meetings.id, id), eq(meetings.userId, userId))
    );
  }

  async addMeetingItem(userId: string, data: InsertMeetingItem): Promise<MeetingItem> {
    const [meeting] = await db.select().from(meetings).where(
      and(eq(meetings.id, data.meetingId), eq(meetings.userId, userId))
    );
    if (!meeting) {
      throw new Error("Meeting not found");
    }
    
    const id = randomUUID();
    const newItem = {
      id,
      meetingId: data.meetingId,
      stakeholderId: data.stakeholderId,
      entityType: data.entityType,
      entityId: data.entityId,
      discussionNotes: data.discussionNotes || null,
      isResolved: data.isResolved || false,
      createdAt: new Date().toISOString(),
    };
    await db.insert(meetingItems).values(newItem);
    return mapMeetingItemFromDb(newItem);
  }

  async updateMeetingItem(userId: string, itemId: string, data: { discussionNotes?: string; isResolved?: boolean }): Promise<MeetingItem> {
    const [item] = await db.select().from(meetingItems).where(eq(meetingItems.id, itemId));
    if (!item) {
      throw new Error("Meeting item not found");
    }
    
    const [meeting] = await db.select().from(meetings).where(
      and(eq(meetings.id, item.meetingId), eq(meetings.userId, userId))
    );
    if (!meeting) {
      throw new Error("Meeting not found or access denied");
    }
    
    const updateData: any = {};
    if (data.discussionNotes !== undefined) updateData.discussionNotes = data.discussionNotes || null;
    if (data.isResolved !== undefined) updateData.isResolved = data.isResolved;
    
    await db.update(meetingItems).set(updateData).where(eq(meetingItems.id, itemId));
    const [updated] = await db.select().from(meetingItems).where(eq(meetingItems.id, itemId));
    return mapMeetingItemFromDb(updated);
  }

  async deleteMeetingItem(userId: string, itemId: string): Promise<void> {
    const [item] = await db.select().from(meetingItems).where(eq(meetingItems.id, itemId));
    if (!item) return;
    
    const [meeting] = await db.select().from(meetings).where(
      and(eq(meetings.id, item.meetingId), eq(meetings.userId, userId))
    );
    if (!meeting) return;
    
    await db.delete(meetingItems).where(eq(meetingItems.id, itemId));
  }
}
