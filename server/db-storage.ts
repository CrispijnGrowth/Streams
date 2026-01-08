import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, desc } from "drizzle-orm";
import { Pool } from "pg";
import {
  type Stream,
  type Solution,
  type Deliverable,
  type Action,
  type Step,
  type Comment,
  type TeamMember,
  type InsertStream,
  type InsertSolution,
  type InsertDeliverable,
  type InsertAction,
  type InsertStep,
  type InsertComment,
  type InsertTeamMember,
  type StreamWithProgress,
  type SolutionWithProgress,
  type SolutionWithBreakdownAndComment,
  type DeliverableBreakdown,
  type DeliverableWithActions,
  type ActionWithProgress,
  type ActionWithLastComment,
  type CommentEntityTypeValue,
  ActionStatus,
  MomentumStatus,
  SolutionStatus,
  CommentEntityType,
  streams,
  solutions,
  deliverables,
  actions,
  steps,
  comments,
  teamMembers,
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
    phases: row.phases || [],
    owners: row.owners || [],
    labels: row.labels || [],
    status: row.status as any,
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
    ordinal: row.ordinal,
    isDeleted: row.isDeleted,
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
      const inProgressSolutions: { name: string; progress: number; isEarliest: boolean; milestoneDate?: string }[] = [];

      const inProgressWithDates: { name: string; progress: number; milestoneDate?: string }[] = [];

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
      phases: data.phases || [],
      owners: data.owners || [],
      labels: data.labels || [],
      status: (data.status as any) || SolutionStatus.IN_PROGRESS,
      ordinal,
      isDeleted: false,
    };
    
    await db.insert(solutions).values(newSolution);
    await this.updateStreamMilestone(data.streamId, userId);
    await db.update(streams).set({ lastMovementAt: new Date().toISOString(), momentumStatus: MomentumStatus.ACTIVE }).where(eq(streams.id, data.streamId));
    return mapSolutionFromDb(newSolution);
  }

  async updateSolution(userId: string, id: string, data: Partial<InsertSolution & { isDeleted?: boolean }>): Promise<Solution | undefined> {
    const [existing] = await db.select().from(solutions).where(
      and(eq(solutions.id, id), eq(solutions.userId, userId))
    );
    if (!existing) return undefined;
    
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.milestoneDate !== undefined) updateData.milestoneDate = data.milestoneDate || null;
    if (data.phases !== undefined) updateData.phases = data.phases;
    if (data.owners !== undefined) updateData.owners = data.owners;
    if (data.labels !== undefined) updateData.labels = data.labels;
    if (data.status !== undefined) updateData.status = data.status;
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
    
    await db.update(deliverables).set(updateData).where(eq(deliverables.id, id));
    
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
}
