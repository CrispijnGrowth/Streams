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
  type SolutionWithDeliverableBreakdown,
  type SolutionWithBreakdownAndComment,
  type DeliverableBreakdown,
  type DeliverableWithActions,
  type ActionWithProgress,
  type ActionWithLastComment,
  type CommentEntityTypeValue,
  type MomentumStatusType,
  ActionStatus,
  MomentumStatus,
  SolutionStatus,
  CommentEntityType,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getStreams(userId: string): Promise<StreamWithProgress[]>;
  getStream(userId: string, id: string): Promise<Stream | undefined>;
  createStream(userId: string, data: InsertStream): Promise<Stream>;
  updateStream(userId: string, id: string, data: Partial<InsertStream>): Promise<Stream | undefined>;
  deleteStream(userId: string, id: string): Promise<boolean>;

  getSolutions(userId: string): Promise<SolutionWithProgress[]>;
  getSolutionsByStream(userId: string, streamId: string): Promise<SolutionWithProgress[]>;
  getSolutionsByStreamWithBreakdown(userId: string, streamId: string): Promise<SolutionWithBreakdownAndComment[]>;
  getAllSolutionsWithBreakdown(userId: string): Promise<SolutionWithBreakdownAndComment[]>;
  getSolution(userId: string, id: string): Promise<Solution | undefined>;
  createSolution(userId: string, data: InsertSolution): Promise<Solution>;
  updateSolution(userId: string, id: string, data: Partial<InsertSolution>): Promise<Solution | undefined>;
  deleteSolution(userId: string, id: string): Promise<boolean>;

  getDeliverables(userId: string): Promise<Deliverable[]>;
  getDeliverablesBySolution(userId: string, solutionId: string): Promise<DeliverableWithActions[]>;
  getDeliverable(userId: string, id: string): Promise<Deliverable | undefined>;
  createDeliverable(userId: string, data: InsertDeliverable): Promise<Deliverable>;
  updateDeliverable(userId: string, id: string, data: Partial<InsertDeliverable>): Promise<Deliverable | undefined>;
  deleteDeliverable(userId: string, id: string): Promise<boolean>;

  getActions(userId: string): Promise<ActionWithLastComment[]>;
  getActionsBySolution(userId: string, solutionId: string): Promise<ActionWithLastComment[]>;
  getAction(userId: string, id: string): Promise<ActionWithLastComment | undefined>;
  createAction(userId: string, data: InsertAction): Promise<Action>;
  updateAction(userId: string, id: string, data: Partial<InsertAction>): Promise<Action | undefined>;
  deleteAction(userId: string, id: string): Promise<boolean>;

  getSteps(userId: string): Promise<Step[]>;
  getStepsByAction(userId: string, actionId: string): Promise<Step[]>;
  getStep(userId: string, id: string): Promise<Step | undefined>;
  createStep(userId: string, data: InsertStep): Promise<Step>;
  updateStep(userId: string, id: string, data: Partial<InsertStep>): Promise<Step | undefined>;
  deleteStep(userId: string, id: string): Promise<boolean>;

  getDeletedItems(userId: string): Promise<{
    streams: Stream[];
    solutions: Solution[];
    deliverables: Deliverable[];
    actions: Action[];
    steps: Step[];
  }>;
  restoreStream(userId: string, id: string): Promise<boolean>;
  restoreSolution(userId: string, id: string): Promise<boolean>;
  restoreDeliverable(userId: string, id: string): Promise<boolean>;
  restoreAction(userId: string, id: string): Promise<boolean>;
  restoreStep(userId: string, id: string): Promise<boolean>;
  emptyRecycleBin(userId: string): Promise<{ streams: number; solutions: number; deliverables: number; actions: number; steps: number }>;

  seedExampleData(userId: string): Promise<void>;
  hasExampleData(userId: string): Promise<boolean>;

  getComments(userId: string, entityType: CommentEntityTypeValue, entityId: string): Promise<Comment[]>;
  getLastComment(userId: string, entityType: CommentEntityTypeValue, entityId: string): Promise<Comment | undefined>;
  createComment(userId: string, data: InsertComment): Promise<Comment>;
  updateComment(userId: string, id: string, content: string): Promise<Comment | undefined>;
  deleteComment(userId: string, id: string): Promise<boolean>;

  getTeamMembers(userId: string): Promise<TeamMember[]>;
  getTeamMember(userId: string, id: string): Promise<TeamMember | undefined>;
  createTeamMember(userId: string, data: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(userId: string, id: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(userId: string, id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private streams: Map<string, Stream> = new Map();
  private solutions: Map<string, Solution> = new Map();
  private deliverables: Map<string, Deliverable> = new Map();
  private actions: Map<string, Action> = new Map();
  private steps: Map<string, Step> = new Map();
  private comments: Map<string, Comment> = new Map();
  private teamMembers: Map<string, TeamMember> = new Map();
  private seededUsers: Set<string> = new Set();

  constructor() {
  }

  private computeActionProgress(actionId: string, userId: string): { progress: number; stepCount: number; doneStepCount: number } {
    const actionSteps = Array.from(this.steps.values()).filter(
      (s) => s.actionId === actionId && s.userId === userId && !s.isDeleted
    );
    const doneStepCount = actionSteps.filter((s) => s.isDone).length;
    const stepCount = actionSteps.length;
    
    if (stepCount === 0) {
      const action = this.actions.get(actionId);
      if (!action || action.userId !== userId) return { progress: 0, stepCount: 0, doneStepCount: 0 };
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

  private computeSolutionProgress(solutionId: string, userId: string): {
    progress: number;
    actionCount: number;
    deliverableCount: number;
    doingCount: number;
    blockedCount: number;
    delegatedCount: number;
  } {
    const solutionActions = Array.from(this.actions.values()).filter(
      (a) => a.solutionId === solutionId && a.userId === userId && !a.isDeleted
    );
    const solutionDeliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.solutionId === solutionId && d.userId === userId && !d.isDeleted
    );
    const actionCount = solutionActions.length;
    const deliverableCount = solutionDeliverables.length;
    const doingCount = solutionActions.filter((a) => a.status === ActionStatus.EXECUTING).length;
    const blockedCount = solutionActions.filter((a) => a.status === ActionStatus.BLOCKED).length;
    const delegatedCount = solutionActions.filter((a) => a.status === ActionStatus.DELEGATED).length;
    
    if (actionCount === 0) {
      return { progress: 0, actionCount: 0, deliverableCount, doingCount: 0, blockedCount: 0, delegatedCount: 0 };
    }
    
    let totalProgress = 0;
    for (const action of solutionActions) {
      totalProgress += this.computeActionProgress(action.id, userId).progress;
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

  private computeStreamProgress(streamId: string, userId: string): {
    progress: number;
    solutionCount: number;
    doingCount: number;
    blockedCount: number;
    delegatedCount: number;
    inProgressSolutions: { name: string; progress: number; isEarliest: boolean; milestoneDate?: string; priority?: number }[];
  } {
    const streamSolutions = Array.from(this.solutions.values()).filter(
      (s) => s.streamId === streamId && s.userId === userId && !s.isDeleted
    );
    const solutionCount = streamSolutions.length;
    
    let totalProgress = 0;
    let doingCount = 0;
    let blockedCount = 0;
    let delegatedCount = 0;
    const inProgressSolutions: { name: string; progress: number; milestoneDate: string | null; priority?: number }[] = [];
    
    for (const sol of streamSolutions) {
      const solStats = this.computeSolutionProgress(sol.id, userId);
      totalProgress += solStats.progress;
      doingCount += solStats.doingCount;
      blockedCount += solStats.blockedCount;
      delegatedCount += solStats.delegatedCount;
      if (sol.status === SolutionStatus.IN_PROGRESS) {
        inProgressSolutions.push({
          name: sol.name,
          progress: solStats.progress,
          milestoneDate: sol.milestoneDate || null,
          priority: sol.priority || undefined,
        });
      }
    }
    
    let earliestName: string | null = null;
    let earliestDate: Date | null = null;
    for (const s of inProgressSolutions) {
      if (s.milestoneDate) {
        const date = new Date(s.milestoneDate);
        if (!earliestDate || date < earliestDate) {
          earliestDate = date;
          earliestName = s.name;
        }
      }
    }
    
    const result = inProgressSolutions
      .sort((a, b) => {
        if (a.name === earliestName) return -1;
        if (b.name === earliestName) return 1;
        return 0;
      })
      .map((s) => ({
        name: s.name,
        progress: s.progress,
        isEarliest: s.name === earliestName,
        milestoneDate: s.milestoneDate || undefined,
        priority: s.priority,
      }));
    
    return {
      progress: solutionCount > 0 ? Math.round(totalProgress / solutionCount) : 0,
      solutionCount,
      doingCount,
      blockedCount,
      delegatedCount,
      inProgressSolutions: result,
    };
  }

  async getStreams(userId: string): Promise<StreamWithProgress[]> {
    const streams = Array.from(this.streams.values())
      .filter((s) => s.userId === userId && !s.isDeleted)
      .sort((a, b) => a.ordinal - b.ordinal);
    return streams.map((stream, index) => {
      const stats = this.computeStreamProgress(stream.id, userId);
      return { ...stream, ...stats, displayKey: `Stream ${index + 1}` };
    });
  }

  async getStream(userId: string, id: string): Promise<Stream | undefined> {
    const stream = this.streams.get(id);
    if (!stream || stream.userId !== userId || stream.isDeleted) return undefined;
    return stream;
  }

  async createStream(userId: string, data: InsertStream): Promise<Stream> {
    const id = randomUUID();
    const userStreams = Array.from(this.streams.values()).filter((s) => s.userId === userId);
    const ordinal = userStreams.length + 1;
    const stream: Stream = {
      id,
      userId,
      key: `STRM${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description,
      phases: data.phases || [],
      owners: data.owners || [],
      labels: data.labels || [],
      status: data.status ?? SolutionStatus.IN_PROGRESS,
      momentumStatus: MomentumStatus.ACTIVE,
      ordinal,
      isDeleted: false,
    };
    this.streams.set(id, stream);
    return stream;
  }

  async updateStream(userId: string, id: string, data: Partial<InsertStream> & { momentumStatus?: string; lastMovementAt?: string }): Promise<Stream | undefined> {
    const stream = this.streams.get(id);
    if (!stream || stream.userId !== userId || stream.isDeleted) return undefined;
    const updated: Stream = {
      ...stream,
      name: data.name ?? stream.name,
      description: data.description ?? stream.description,
      phases: data.phases ?? stream.phases,
      owners: data.owners ?? stream.owners,
      labels: data.labels ?? stream.labels,
      status: data.status ?? stream.status ?? SolutionStatus.IN_PROGRESS,
      momentumStatus: (data.momentumStatus as MomentumStatusType) ?? stream.momentumStatus,
      lastMovementAt: data.lastMovementAt ?? stream.lastMovementAt,
    };
    this.streams.set(id, updated);
    return updated;
  }

  async deleteStream(userId: string, id: string): Promise<boolean> {
    const stream = this.streams.get(id);
    if (!stream || stream.userId !== userId) return false;
    stream.isDeleted = true;
    for (const sol of this.solutions.values()) {
      if (sol.streamId === id && sol.userId === userId) {
        sol.isDeleted = true;
        for (const action of this.actions.values()) {
          if (action.solutionId === sol.id && action.userId === userId) {
            action.isDeleted = true;
            for (const step of this.steps.values()) {
              if (step.actionId === action.id && step.userId === userId) {
                step.isDeleted = true;
              }
            }
          }
        }
      }
    }
    return true;
  }

  async getSolutions(userId: string): Promise<SolutionWithProgress[]> {
    const solutions = Array.from(this.solutions.values())
      .filter((s) => s.userId === userId && !s.isDeleted)
      .sort((a, b) => a.ordinal - b.ordinal);
    
    const byStream = new Map<string, typeof solutions>();
    for (const sol of solutions) {
      const group = byStream.get(sol.streamId) || [];
      group.push(sol);
      byStream.set(sol.streamId, group);
    }
    
    const result: SolutionWithProgress[] = [];
    for (const [, streamSolutions] of byStream) {
      streamSolutions.sort((a, b) => a.ordinal - b.ordinal);
      streamSolutions.forEach((sol, index) => {
        const stats = this.computeSolutionProgress(sol.id, userId);
        result.push({ ...sol, ...stats, displayKey: `Solution ${index + 1}` });
      });
    }
    return result;
  }

  async getSolutionsByStream(userId: string, streamId: string): Promise<SolutionWithProgress[]> {
    const solutions = Array.from(this.solutions.values())
      .filter((s) => s.streamId === streamId && s.userId === userId && !s.isDeleted)
      .sort((a, b) => a.ordinal - b.ordinal);
    return solutions.map((sol, index) => {
      const stats = this.computeSolutionProgress(sol.id, userId);
      return { ...sol, ...stats, displayKey: `Solution ${index + 1}` };
    });
  }

  async getSolutionsByStreamWithBreakdown(userId: string, streamId: string): Promise<SolutionWithBreakdownAndComment[]> {
    const solutions = Array.from(this.solutions.values())
      .filter((s) => s.streamId === streamId && s.userId === userId && !s.isDeleted)
      .sort((a, b) => a.ordinal - b.ordinal);
    
    const activeStatuses = [ActionStatus.EXECUTING, ActionStatus.BLOCKED, ActionStatus.DELEGATED];
    
    const results: SolutionWithBreakdownAndComment[] = [];
    
    for (let i = 0; i < solutions.length; i++) {
      const sol = solutions[i];
      const stats = this.computeSolutionProgress(sol.id, userId);
      
      const solutionDeliverables = Array.from(this.deliverables.values())
        .filter((d) => d.solutionId === sol.id && d.userId === userId && !d.isDeleted)
        .sort((a, b) => a.ordinal - b.ordinal);
      
      const solutionActions = Array.from(this.actions.values())
        .filter((a) => a.solutionId === sol.id && a.userId === userId && !a.isDeleted);
      
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
      
      results.push({ ...sol, ...stats, deliverableBreakdown, lastComment, displayKey: `Solution ${i + 1}` });
    }
    
    return results;
  }

  async getAllSolutionsWithBreakdown(userId: string): Promise<SolutionWithBreakdownAndComment[]> {
    const allSolutions = Array.from(this.solutions.values())
      .filter((s) => s.userId === userId && !s.isDeleted);
    
    // Group by streamId and maintain ordinal ordering
    const byStream = new Map<string, Solution[]>();
    for (const sol of allSolutions) {
      const group = byStream.get(sol.streamId) || [];
      group.push(sol);
      byStream.set(sol.streamId, group);
    }
    
    const activeStatuses = [ActionStatus.EXECUTING, ActionStatus.BLOCKED, ActionStatus.DELEGATED];
    const results: SolutionWithBreakdownAndComment[] = [];
    let globalDisplayIndex = 1;
    
    for (const [streamId, streamSolutions] of byStream) {
      streamSolutions.sort((a, b) => a.ordinal - b.ordinal);
      
      for (const sol of streamSolutions) {
        const displayIndex = globalDisplayIndex++;
        const stats = this.computeSolutionProgress(sol.id, userId);
        
        const solutionDeliverables = Array.from(this.deliverables.values())
          .filter((d) => d.solutionId === sol.id && d.userId === userId && !d.isDeleted)
          .sort((a, b) => a.ordinal - b.ordinal);
        
        const solutionActions = Array.from(this.actions.values())
          .filter((a) => a.solutionId === sol.id && a.userId === userId && !a.isDeleted);
        
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
    const sol = this.solutions.get(id);
    if (!sol || sol.userId !== userId || sol.isDeleted) return undefined;
    return sol;
  }

  async createSolution(userId: string, data: InsertSolution): Promise<Solution> {
    const parentStream = this.streams.get(data.streamId);
    if (!parentStream || parentStream.userId !== userId || parentStream.isDeleted) {
      throw new Error("Parent stream not found or access denied");
    }
    const id = randomUUID();
    const streamSolutions = Array.from(this.solutions.values()).filter(
      (s) => s.streamId === data.streamId && s.userId === userId
    );
    const ordinal = streamSolutions.length + 1;
    const solution: Solution = {
      id,
      userId,
      key: `SOL${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description,
      streamId: data.streamId,
      milestoneDate: data.milestoneDate,
      priority: data.priority ?? undefined,
      phases: data.phases || [],
      owners: data.owners || [],
      labels: data.labels || [],
      status: (data.status as any) || SolutionStatus.IN_PROGRESS,
      momentumStatus: MomentumStatus.ACTIVE,
      lastMovementAt: new Date().toISOString(),
      ordinal,
      isDeleted: false,
    };
    this.solutions.set(id, solution);
    this.updateStreamMilestone(data.streamId, userId);
    this.updateStreamMomentum(data.streamId, userId);
    return solution;
  }

  private updateStreamMilestone(streamId: string, userId: string) {
    const stream = this.streams.get(streamId);
    if (!stream || stream.userId !== userId) return;
    const solutions = Array.from(this.solutions.values()).filter(
      (s) => s.streamId === streamId && s.userId === userId && !s.isDeleted && s.milestoneDate
    );
    if (solutions.length === 0) {
      stream.computedMilestoneDate = undefined;
      return;
    }
    const earliest = solutions.reduce((min, s) => {
      if (!s.milestoneDate) return min;
      if (!min) return s.milestoneDate;
      return s.milestoneDate < min ? s.milestoneDate : min;
    }, solutions[0].milestoneDate);
    stream.computedMilestoneDate = earliest;
  }

  private updateStreamMomentum(streamId: string, userId: string) {
    const stream = this.streams.get(streamId);
    if (!stream || stream.userId !== userId) return;
    
    const now = new Date();
    stream.lastMovementAt = now.toISOString();
    
    const daysSinceMovement = 0;
    
    if (daysSinceMovement <= 7) {
      stream.momentumStatus = MomentumStatus.ACTIVE;
    } else if (daysSinceMovement <= 14) {
      stream.momentumStatus = MomentumStatus.SLOWING;
    } else {
      stream.momentumStatus = MomentumStatus.STALLED;
    }
  }

  private getStreamIdFromSolution(solutionId: string): string | undefined {
    const solution = this.solutions.get(solutionId);
    return solution?.streamId;
  }

  private getStreamIdFromAction(actionId: string): string | undefined {
    const action = this.actions.get(actionId);
    if (!action) return undefined;
    return action.streamId;
  }

  async updateSolution(userId: string, id: string, data: Partial<InsertSolution>): Promise<Solution | undefined> {
    const sol = this.solutions.get(id);
    if (!sol || sol.userId !== userId || sol.isDeleted) return undefined;
    if (data.streamId && data.streamId !== sol.streamId) {
      const newParentStream = this.streams.get(data.streamId);
      if (!newParentStream || newParentStream.userId !== userId || newParentStream.isDeleted) {
        return undefined;
      }
    }
    const statusChanged = data.status !== undefined && data.status !== sol.status;
    const milestoneDateChanged = data.milestoneDate !== undefined && data.milestoneDate !== sol.milestoneDate;
    const oldStreamId = sol.streamId;
    const updated: Solution = { ...sol, ...data } as Solution;
    this.solutions.set(id, updated);
    if (milestoneDateChanged) {
      for (const deliverable of this.deliverables.values()) {
        if (deliverable.solutionId === id && deliverable.userId === userId && !deliverable.isDeleted && deliverable.isMilestoneLinked) {
          deliverable.dueDate = updated.milestoneDate;
        }
      }
    }
    this.updateStreamMilestone(oldStreamId, userId);
    if (data.streamId && data.streamId !== oldStreamId) {
      this.updateStreamMilestone(data.streamId, userId);
      this.updateStreamMomentum(data.streamId, userId);
    }
    if (statusChanged) {
      this.updateStreamMomentum(updated.streamId, userId);
    }
    return updated;
  }

  async deleteSolution(userId: string, id: string): Promise<boolean> {
    const sol = this.solutions.get(id);
    if (!sol || sol.userId !== userId) return false;
    sol.isDeleted = true;
    for (const deliverable of this.deliverables.values()) {
      if (deliverable.solutionId === id && deliverable.userId === userId) {
        deliverable.isDeleted = true;
      }
    }
    for (const action of this.actions.values()) {
      if (action.solutionId === id && action.userId === userId) {
        action.isDeleted = true;
        for (const step of this.steps.values()) {
          if (step.actionId === action.id && step.userId === userId) {
            step.isDeleted = true;
          }
        }
      }
    }
    this.updateStreamMilestone(sol.streamId, userId);
    return true;
  }

  async getDeliverables(userId: string): Promise<Deliverable[]> {
    return Array.from(this.deliverables.values()).filter((d) => d.userId === userId && !d.isDeleted);
  }

  async getDeliverablesBySolution(userId: string, solutionId: string): Promise<DeliverableWithActions[]> {
    const deliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.solutionId === solutionId && d.userId === userId && !d.isDeleted
    );
    return deliverables.map((deliverable) => {
      const actions = Array.from(this.actions.values())
        .filter((a) => a.deliverableId === deliverable.id && a.userId === userId && !a.isDeleted)
        .map((action) => {
          const stats = this.computeActionProgress(action.id, userId);
          return { ...action, ...stats };
        });
      return { ...deliverable, actions };
    });
  }

  async getDeliverable(userId: string, id: string): Promise<Deliverable | undefined> {
    const deliverable = this.deliverables.get(id);
    if (!deliverable || deliverable.userId !== userId || deliverable.isDeleted) return undefined;
    return deliverable;
  }

  async createDeliverable(userId: string, data: InsertDeliverable): Promise<Deliverable> {
    const parentSolution = this.solutions.get(data.solutionId);
    if (!parentSolution || parentSolution.userId !== userId || parentSolution.isDeleted) {
      throw new Error("Parent solution not found or access denied");
    }
    const id = randomUUID();
    const solutionDeliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.solutionId === data.solutionId && d.userId === userId
    );
    const ordinal = solutionDeliverables.length + 1;
    const isMilestoneLinked = data.isMilestoneLinked !== false;
    let dueDate = data.dueDate;
    if (isMilestoneLinked && parentSolution.milestoneDate) {
      dueDate = parentSolution.milestoneDate;
    }
    if (isMilestoneLinked && dueDate && parentSolution.milestoneDate) {
      if (new Date(dueDate) > new Date(parentSolution.milestoneDate)) {
        dueDate = parentSolution.milestoneDate;
      }
    }
    const deliverable: Deliverable = {
      id,
      userId,
      key: `DLV${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description,
      solutionId: data.solutionId,
      streamId: data.streamId,
      borderColor: (data.borderColor || "cyan") as Deliverable["borderColor"],
      owners: data.owners || [],
      ordinal,
      isMilestoneLinked,
      dueDate,
      isDeleted: false,
    };
    this.deliverables.set(id, deliverable);
    return deliverable;
  }

  async updateDeliverable(userId: string, id: string, data: Partial<InsertDeliverable>): Promise<Deliverable | undefined> {
    const deliverable = this.deliverables.get(id);
    if (!deliverable || deliverable.userId !== userId || deliverable.isDeleted) return undefined;
    const solutionId = data.solutionId || deliverable.solutionId;
    const parentSolution = this.solutions.get(solutionId);
    if (!parentSolution || parentSolution.userId !== userId || parentSolution.isDeleted) {
      return undefined;
    }
    
    if (data.ordinal !== undefined && data.ordinal !== deliverable.ordinal) {
      const solutionDeliverables = Array.from(this.deliverables.values())
        .filter((d) => d.solutionId === deliverable.solutionId && d.userId === userId && !d.isDeleted)
        .sort((a, b) => a.ordinal - b.ordinal);
      
      const oldOrdinal = deliverable.ordinal;
      const newOrdinal = data.ordinal;
      
      for (const d of solutionDeliverables) {
        if (d.id === id) continue;
        
        if (oldOrdinal < newOrdinal) {
          if (d.ordinal > oldOrdinal && d.ordinal <= newOrdinal) {
            d.ordinal = d.ordinal - 1;
          }
        } else {
          if (d.ordinal >= newOrdinal && d.ordinal < oldOrdinal) {
            d.ordinal = d.ordinal + 1;
          }
        }
      }
    }
    
    const isMilestoneLinked = data.isMilestoneLinked ?? deliverable.isMilestoneLinked;
    let dueDate = data.dueDate ?? deliverable.dueDate;
    if (isMilestoneLinked && parentSolution.milestoneDate) {
      dueDate = parentSolution.milestoneDate;
    }
    if (isMilestoneLinked && dueDate && parentSolution.milestoneDate) {
      if (new Date(dueDate) > new Date(parentSolution.milestoneDate)) {
        dueDate = parentSolution.milestoneDate;
      }
    }
    
    const updated: Deliverable = { 
      ...deliverable, 
      ...data,
      isMilestoneLinked,
      dueDate,
    } as Deliverable;
    this.deliverables.set(id, updated);
    return updated;
  }

  async deleteDeliverable(userId: string, id: string): Promise<boolean> {
    const deliverable = this.deliverables.get(id);
    if (!deliverable || deliverable.userId !== userId) return false;
    deliverable.isDeleted = true;
    for (const action of this.actions.values()) {
      if (action.deliverableId === id && action.userId === userId) {
        action.deliverableId = undefined;
      }
    }
    return true;
  }

  async getActions(userId: string): Promise<ActionWithLastComment[]> {
    const actions = Array.from(this.actions.values()).filter((a) => a.userId === userId && !a.isDeleted);
    const result: ActionWithLastComment[] = [];
    for (const action of actions) {
      const stats = this.computeActionProgress(action.id, userId);
      const lastComment = await this.getLastComment(userId, "action", action.id);
      result.push({ ...action, ...stats, lastComment });
    }
    return result;
  }

  async getActionsBySolution(userId: string, solutionId: string): Promise<ActionWithLastComment[]> {
    const actions = Array.from(this.actions.values()).filter(
      (a) => a.solutionId === solutionId && a.userId === userId && !a.isDeleted
    );
    const result: ActionWithLastComment[] = [];
    for (const action of actions) {
      const stats = this.computeActionProgress(action.id, userId);
      const lastComment = await this.getLastComment(userId, "action", action.id);
      result.push({ ...action, ...stats, lastComment });
    }
    return result;
  }

  async getAction(userId: string, id: string): Promise<ActionWithLastComment | undefined> {
    const action = this.actions.get(id);
    if (!action || action.userId !== userId || action.isDeleted) return undefined;
    const stats = this.computeActionProgress(id, userId);
    const lastComment = await this.getLastComment(userId, "action", action.id);
    return { ...action, ...stats, lastComment };
  }

  async createAction(userId: string, data: InsertAction): Promise<Action> {
    const parentSolution = this.solutions.get(data.solutionId);
    if (!parentSolution || parentSolution.userId !== userId || parentSolution.isDeleted) {
      throw new Error("Parent solution not found or access denied");
    }
    const parentStream = this.streams.get(data.streamId);
    if (!parentStream || parentStream.userId !== userId || parentStream.isDeleted) {
      throw new Error("Parent stream not found or access denied");
    }
    if (data.deliverableId) {
      const parentDeliverable = this.deliverables.get(data.deliverableId);
      if (!parentDeliverable || parentDeliverable.userId !== userId || parentDeliverable.isDeleted) {
        throw new Error("Parent deliverable not found or access denied");
      }
    }
    const id = randomUUID();
    const solutionActions = Array.from(this.actions.values()).filter(
      (a) => a.solutionId === data.solutionId && a.userId === userId
    );
    const ordinal = solutionActions.length + 1;
    const kanbanOrder = solutionActions.filter((a) => a.status === data.status).length + 1;
    const action: Action = {
      id,
      userId,
      key: `ACT${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description,
      solutionId: data.solutionId,
      deliverableId: data.deliverableId,
      streamId: data.streamId,
      status: (data.status as any) || ActionStatus.BACKLOG,
      dueDate: data.dueDate,
      effort: data.effort,
      owners: data.owners || [],
      labels: data.labels || [],
      kanbanOrder,
      ordinal,
      isDeleted: false,
    };
    this.actions.set(id, action);
    if (data.streamId) {
      this.updateStreamMomentum(data.streamId, userId);
    }
    return action;
  }

  async updateAction(userId: string, id: string, data: Partial<InsertAction> & { deliverableId?: string | null }): Promise<Action | undefined> {
    const action = this.actions.get(id);
    if (!action || action.userId !== userId || action.isDeleted) return undefined;
    if (data.solutionId && data.solutionId !== action.solutionId) {
      const newParentSolution = this.solutions.get(data.solutionId);
      if (!newParentSolution || newParentSolution.userId !== userId || newParentSolution.isDeleted) {
        return undefined;
      }
    }
    if (data.deliverableId && data.deliverableId !== action.deliverableId) {
      const newParentDeliverable = this.deliverables.get(data.deliverableId);
      if (!newParentDeliverable || newParentDeliverable.userId !== userId || newParentDeliverable.isDeleted) {
        return undefined;
      }
    }
    if (data.streamId && data.streamId !== action.streamId) {
      const newParentStream = this.streams.get(data.streamId);
      if (!newParentStream || newParentStream.userId !== userId || newParentStream.isDeleted) {
        return undefined;
      }
    }
    const statusChanged = data.status !== undefined && data.status !== action.status;
    const updateData = { ...data };
    if (data.deliverableId === null) {
      updateData.deliverableId = undefined;
    }
    const updated: Action = { ...action, ...updateData } as Action;
    this.actions.set(id, updated);
    if (statusChanged && action.streamId) {
      this.updateStreamMomentum(action.streamId, userId);
    }
    return updated;
  }

  async deleteAction(userId: string, id: string): Promise<boolean> {
    const action = this.actions.get(id);
    if (!action || action.userId !== userId) return false;
    action.isDeleted = true;
    for (const step of this.steps.values()) {
      if (step.actionId === id && step.userId === userId) {
        step.isDeleted = true;
      }
    }
    return true;
  }

  async getSteps(userId: string): Promise<Step[]> {
    return Array.from(this.steps.values()).filter((s) => s.userId === userId && !s.isDeleted);
  }

  async getStepsByAction(userId: string, actionId: string): Promise<Step[]> {
    return Array.from(this.steps.values()).filter(
      (s) => s.actionId === actionId && s.userId === userId && !s.isDeleted
    );
  }

  async getStep(userId: string, id: string): Promise<Step | undefined> {
    const step = this.steps.get(id);
    if (!step || step.userId !== userId || step.isDeleted) return undefined;
    return step;
  }

  async createStep(userId: string, data: InsertStep): Promise<Step> {
    const parentAction = this.actions.get(data.actionId);
    if (!parentAction || parentAction.userId !== userId || parentAction.isDeleted) {
      throw new Error("Parent action not found or access denied");
    }
    const id = randomUUID();
    const actionSteps = Array.from(this.steps.values()).filter(
      (s) => s.actionId === data.actionId && s.userId === userId
    );
    const ordinal = actionSteps.length + 1;
    const step: Step = {
      id,
      userId,
      key: `STP${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      note: data.note,
      actionId: data.actionId,
      isDone: data.isDone || false,
      dueDate: data.dueDate,
      owner: data.owner,
      ordinal,
      isDeleted: false,
    };
    this.steps.set(id, step);
    const streamId = this.getStreamIdFromAction(data.actionId);
    if (streamId) {
      this.updateStreamMomentum(streamId, userId);
    }
    return step;
  }

  async updateStep(userId: string, id: string, data: Partial<InsertStep>): Promise<Step | undefined> {
    const step = this.steps.get(id);
    if (!step || step.userId !== userId || step.isDeleted) return undefined;
    if (data.actionId && data.actionId !== step.actionId) {
      const newParentAction = this.actions.get(data.actionId);
      if (!newParentAction || newParentAction.userId !== userId || newParentAction.isDeleted) {
        return undefined;
      }
    }
    const isDoneChanged = data.isDone !== undefined && data.isDone !== step.isDone;
    const updated = { ...step, ...data };
    this.steps.set(id, updated);
    if (isDoneChanged) {
      const streamId = this.getStreamIdFromAction(step.actionId);
      if (streamId) {
        this.updateStreamMomentum(streamId, userId);
      }
    }
    return updated;
  }

  async deleteStep(userId: string, id: string): Promise<boolean> {
    const step = this.steps.get(id);
    if (!step || step.userId !== userId) return false;
    step.isDeleted = true;
    return true;
  }

  async getDeletedItems(userId: string): Promise<{
    streams: Stream[];
    solutions: Solution[];
    deliverables: Deliverable[];
    actions: Action[];
    steps: Step[];
  }> {
    return {
      streams: Array.from(this.streams.values()).filter((s) => s.userId === userId && s.isDeleted),
      solutions: Array.from(this.solutions.values()).filter((s) => s.userId === userId && s.isDeleted),
      deliverables: Array.from(this.deliverables.values()).filter((d) => d.userId === userId && d.isDeleted),
      actions: Array.from(this.actions.values()).filter((a) => a.userId === userId && a.isDeleted),
      steps: Array.from(this.steps.values()).filter((s) => s.userId === userId && s.isDeleted),
    };
  }

  async restoreStream(userId: string, id: string): Promise<boolean> {
    const stream = this.streams.get(id);
    if (!stream || stream.userId !== userId || !stream.isDeleted) return false;
    stream.isDeleted = false;
    return true;
  }

  async restoreSolution(userId: string, id: string): Promise<boolean> {
    const sol = this.solutions.get(id);
    if (!sol || sol.userId !== userId || !sol.isDeleted) return false;
    sol.isDeleted = false;
    return true;
  }

  async restoreDeliverable(userId: string, id: string): Promise<boolean> {
    const deliverable = this.deliverables.get(id);
    if (!deliverable || deliverable.userId !== userId || !deliverable.isDeleted) return false;
    deliverable.isDeleted = false;
    return true;
  }

  async restoreAction(userId: string, id: string): Promise<boolean> {
    const action = this.actions.get(id);
    if (!action || action.userId !== userId || !action.isDeleted) return false;
    action.isDeleted = false;
    return true;
  }

  async restoreStep(userId: string, id: string): Promise<boolean> {
    const step = this.steps.get(id);
    if (!step || step.userId !== userId || !step.isDeleted) return false;
    step.isDeleted = false;
    return true;
  }

  async emptyRecycleBin(userId: string): Promise<{ streams: number; solutions: number; deliverables: number; actions: number; steps: number }> {
    let streamCount = 0, solutionCount = 0, deliverableCount = 0, actionCount = 0, stepCount = 0;
    
    for (const [id, step] of this.steps) {
      if (step.userId === userId && step.isDeleted) {
        this.steps.delete(id);
        stepCount++;
      }
    }
    for (const [id, action] of this.actions) {
      if (action.userId === userId && action.isDeleted) {
        this.actions.delete(id);
        actionCount++;
      }
    }
    for (const [id, deliverable] of this.deliverables) {
      if (deliverable.userId === userId && deliverable.isDeleted) {
        this.deliverables.delete(id);
        deliverableCount++;
      }
    }
    for (const [id, solution] of this.solutions) {
      if (solution.userId === userId && solution.isDeleted) {
        this.solutions.delete(id);
        solutionCount++;
      }
    }
    for (const [id, stream] of this.streams) {
      if (stream.userId === userId && stream.isDeleted) {
        this.streams.delete(id);
        streamCount++;
      }
    }
    
    return { streams: streamCount, solutions: solutionCount, deliverables: deliverableCount, actions: actionCount, steps: stepCount };
  }

  async hasExampleData(userId: string): Promise<boolean> {
    return this.seededUsers.has(userId);
  }

  async seedExampleData(userId: string): Promise<void> {
    if (this.seededUsers.has(userId)) return;
    this.seededUsers.add(userId);

    const exampleStreams = [
      {
        name: "[Example] Marketing Campaign Launch",
        description: "A product launch marketing campaign with digital and print strategies",
        phases: ["Execution"],
        owners: ["Marketing Lead"],
        labels: ["marketing", "launch"],
        solutions: [
          {
            name: "Digital Marketing",
            description: "Online advertising and social media campaigns",
            deliverables: [
              {
                name: "Social Media",
                actions: [
                  { name: "Create content calendar", status: ActionStatus.DONE, steps: ["Define themes", "Schedule posts", "Create assets"] },
                  { name: "Design social media graphics", status: ActionStatus.EXECUTING, steps: ["Brand guidelines", "Template designs", "Review cycle"] },
                  { name: "Set up ad campaigns", status: ActionStatus.TO_EXECUTE, steps: ["Define audiences", "Set budgets", "Create ads"] },
                ],
              },
              {
                name: "Email Marketing",
                actions: [
                  { name: "Build email list segments", status: ActionStatus.DONE, steps: ["Export contacts", "Clean data", "Create segments"] },
                  { name: "Design email templates", status: ActionStatus.EXECUTING, steps: ["Header design", "Body layout", "Mobile responsive"] },
                ],
              },
            ],
          },
          {
            name: "Print Materials",
            description: "Brochures and promotional materials for events",
            deliverables: [
              {
                name: "Brochures",
                actions: [
                  { name: "Write copy for brochures", status: ActionStatus.BACKLOG, steps: ["Draft content", "Review messaging", "Final approval"] },
                  { name: "Design brochure layout", status: ActionStatus.BACKLOG, steps: ["Concept sketches", "Digital mockup", "Print proof"] },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "[Example] Build a Sailboat",
        description: "Construct a small wooden sailboat for recreational use",
        phases: ["Planning"],
        owners: ["Project Manager"],
        labels: ["construction", "hobby"],
        solutions: [
          {
            name: "Hull Construction",
            description: "Build the main body of the boat",
            deliverables: [
              {
                name: "Frame Assembly",
                actions: [
                  { name: "Source lumber materials", status: ActionStatus.DONE, steps: ["Research suppliers", "Compare prices", "Place order"] },
                  { name: "Cut frame pieces", status: ActionStatus.EXECUTING, steps: ["Mark measurements", "Cut to size", "Sand edges"] },
                  { name: "Assemble keel and ribs", status: ActionStatus.TO_EXECUTE, steps: ["Prepare joints", "Apply glue", "Secure with clamps"] },
                ],
              },
              {
                name: "Planking",
                actions: [
                  { name: "Steam bend planks", status: ActionStatus.BACKLOG, steps: ["Set up steam box", "Heat planks", "Bend to shape"] },
                  { name: "Attach planking to frame", status: ActionStatus.BACKLOG, steps: ["Dry fit", "Apply sealant", "Fasten permanently"] },
                ],
              },
            ],
          },
          {
            name: "Rigging and Sails",
            description: "Install mast, boom, and sails",
            deliverables: [
              {
                name: "Mast and Boom",
                actions: [
                  { name: "Shape mast from spar", status: ActionStatus.BACKLOG, steps: ["Select wood", "Plane to shape", "Apply finish"] },
                  { name: "Install mast step and partners", status: ActionStatus.BACKLOG, steps: ["Mark position", "Cut openings", "Reinforce structure"] },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "[Example] Company Christmas Party",
        description: "Organize the annual company holiday celebration",
        phases: ["Planning"],
        owners: ["HR Team"],
        labels: ["event", "company-wide"],
        solutions: [
          {
            name: "Venue and Catering",
            description: "Secure location and food arrangements",
            deliverables: [
              {
                name: "Venue Selection",
                actions: [
                  { name: "Research venue options", status: ActionStatus.DONE, steps: ["List potential venues", "Check availability", "Compare pricing"] },
                  { name: "Visit and book venue", status: ActionStatus.EXECUTING, steps: ["Schedule tours", "Negotiate contract", "Pay deposit"] },
                ],
              },
              {
                name: "Catering",
                actions: [
                  { name: "Select catering company", status: ActionStatus.TO_EXECUTE, steps: ["Request quotes", "Review menus", "Check references"] },
                  { name: "Plan menu with dietary options", status: ActionStatus.BACKLOG, steps: ["Survey preferences", "Design menu", "Confirm with caterer"] },
                ],
              },
            ],
          },
          {
            name: "Entertainment and Activities",
            description: "Plan fun activities for the party",
            deliverables: [
              {
                name: "Entertainment",
                actions: [
                  { name: "Book DJ or band", status: ActionStatus.BACKLOG, steps: ["Research options", "Listen to demos", "Sign contract"] },
                  { name: "Plan party games", status: ActionStatus.BACKLOG, steps: ["Brainstorm ideas", "Prepare materials", "Assign hosts"] },
                  { name: "Organize Secret Santa", status: ActionStatus.EXECUTING, steps: ["Send signup form", "Draw names", "Set budget"] },
                ],
              },
            ],
          },
          {
            name: "Invitations and RSVPs",
            description: "Handle guest communications",
            deliverables: [
              {
                name: "Communications",
                actions: [
                  { name: "Design invitation", status: ActionStatus.DONE, steps: ["Create design", "Write copy", "Get approval"] },
                  { name: "Send invitations", status: ActionStatus.DONE, steps: ["Compile email list", "Schedule send", "Track opens"] },
                  { name: "Track RSVPs", status: ActionStatus.EXECUTING, steps: ["Set up form", "Send reminders", "Finalize headcount"] },
                ],
              },
            ],
          },
        ],
      },
    ];

    for (const streamData of exampleStreams) {
      const stream = await this.createStream(userId, {
        name: streamData.name,
        description: streamData.description,
        phases: streamData.phases,
        owners: streamData.owners,
        labels: streamData.labels,
      });

      for (const solutionData of streamData.solutions) {
        const solution = await this.createSolution(userId, {
          name: solutionData.name,
          description: solutionData.description,
          streamId: stream.id,
          status: SolutionStatus.IN_PROGRESS,
          phases: [],
          owners: [],
          labels: [],
        });

        for (const deliverableData of solutionData.deliverables) {
          const deliverable = await this.createDeliverable(userId, {
            name: deliverableData.name,
            solutionId: solution.id,
            streamId: stream.id,
            borderColor: "cyan",
            owners: [],
            isMilestoneLinked: true,
          });

          for (const actionData of deliverableData.actions) {
            const action = await this.createAction(userId, {
              name: actionData.name,
              status: actionData.status,
              solutionId: solution.id,
              streamId: stream.id,
              deliverableId: deliverable.id,
              owners: [],
              labels: [],
            });

            for (const stepName of actionData.steps) {
              await this.createStep(userId, {
                name: stepName,
                actionId: action.id,
                isDone: actionData.status === ActionStatus.DONE,
              });
            }
          }
        }
      }
    }
  }

  async getComments(userId: string, entityType: CommentEntityTypeValue, entityId: string): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter((c) => c.userId === userId && c.entityType === entityType && c.entityId === entityId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getLastComment(userId: string, entityType: CommentEntityTypeValue, entityId: string): Promise<Comment | undefined> {
    const comments = await this.getComments(userId, entityType, entityId);
    return comments.length > 0 ? comments[comments.length - 1] : undefined;
  }

  async createComment(userId: string, data: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = {
      id,
      userId,
      entityType: data.entityType as CommentEntityTypeValue,
      entityId: data.entityId,
      content: data.content,
      createdAt: new Date().toISOString(),
    };
    this.comments.set(id, comment);
    return comment;
  }

  async updateComment(userId: string, id: string, content: string): Promise<Comment | undefined> {
    const comment = this.comments.get(id);
    if (!comment) return undefined;
    if (comment.userId !== userId) return undefined;
    const updated = { ...comment, content };
    this.comments.set(id, updated);
    return updated;
  }

  async deleteComment(userId: string, id: string): Promise<boolean> {
    const comment = this.comments.get(id);
    if (!comment) return false;
    if (comment.userId !== userId) return false;
    this.comments.delete(id);
    return true;
  }

  async getTeamMembers(userId: string): Promise<TeamMember[]> {
    return Array.from(this.teamMembers.values())
      .filter((m) => m.userId === userId && !m.isDeleted)
      .sort((a, b) => a.ordinal - b.ordinal);
  }

  async getTeamMember(userId: string, id: string): Promise<TeamMember | undefined> {
    const member = this.teamMembers.get(id);
    if (!member || member.userId !== userId || member.isDeleted) return undefined;
    return member;
  }

  async createTeamMember(userId: string, data: InsertTeamMember): Promise<TeamMember> {
    const id = randomUUID();
    const userMembers = Array.from(this.teamMembers.values()).filter((m) => m.userId === userId);
    const ordinal = userMembers.length + 1;
    const member: TeamMember = {
      id,
      userId,
      name: data.name,
      role: data.role,
      photoUrl: data.photoUrl,
      ordinal,
      isDeleted: false,
    };
    this.teamMembers.set(id, member);
    return member;
  }

  async updateTeamMember(userId: string, id: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const member = this.teamMembers.get(id);
    if (!member || member.userId !== userId || member.isDeleted) return undefined;
    const updated = { ...member, ...data };
    this.teamMembers.set(id, updated);
    return updated;
  }

  async deleteTeamMember(userId: string, id: string): Promise<boolean> {
    const member = this.teamMembers.get(id);
    if (!member || member.userId !== userId) return false;
    member.isDeleted = true;
    return true;
  }
}

import { DatabaseStorage } from "./db-storage";

export const storage = new DatabaseStorage();
