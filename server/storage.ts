import {
  type Stream,
  type Deliverable,
  type Action,
  type Step,
  type InsertStream,
  type InsertDeliverable,
  type InsertAction,
  type InsertStep,
  type StreamWithProgress,
  type DeliverableWithProgress,
  type ActionWithProgress,
  ActionStatus,
  MomentumStatus,
  DeliverableStatus,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getStreams(userId: string): Promise<StreamWithProgress[]>;
  getStream(userId: string, id: string): Promise<Stream | undefined>;
  createStream(userId: string, data: InsertStream): Promise<Stream>;
  updateStream(userId: string, id: string, data: Partial<InsertStream>): Promise<Stream | undefined>;
  deleteStream(userId: string, id: string): Promise<boolean>;

  getDeliverables(userId: string): Promise<DeliverableWithProgress[]>;
  getDeliverablesByStream(userId: string, streamId: string): Promise<DeliverableWithProgress[]>;
  getDeliverable(userId: string, id: string): Promise<Deliverable | undefined>;
  createDeliverable(userId: string, data: InsertDeliverable): Promise<Deliverable>;
  updateDeliverable(userId: string, id: string, data: Partial<InsertDeliverable>): Promise<Deliverable | undefined>;
  deleteDeliverable(userId: string, id: string): Promise<boolean>;

  getActions(userId: string): Promise<ActionWithProgress[]>;
  getActionsByDeliverable(userId: string, deliverableId: string): Promise<ActionWithProgress[]>;
  getAction(userId: string, id: string): Promise<ActionWithProgress | undefined>;
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
    deliverables: Deliverable[];
    actions: Action[];
    steps: Step[];
  }>;
  restoreStream(userId: string, id: string): Promise<boolean>;
  restoreDeliverable(userId: string, id: string): Promise<boolean>;
  restoreAction(userId: string, id: string): Promise<boolean>;
  restoreStep(userId: string, id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private streams: Map<string, Stream> = new Map();
  private deliverables: Map<string, Deliverable> = new Map();
  private actions: Map<string, Action> = new Map();
  private steps: Map<string, Step> = new Map();

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

  private computeDeliverableProgress(deliverableId: string, userId: string): {
    progress: number;
    actionCount: number;
    doingCount: number;
    blockedCount: number;
    delegatedCount: number;
  } {
    const deliverableActions = Array.from(this.actions.values()).filter(
      (a) => a.deliverableId === deliverableId && a.userId === userId && !a.isDeleted
    );
    const actionCount = deliverableActions.length;
    const doingCount = deliverableActions.filter((a) => a.status === ActionStatus.EXECUTING).length;
    const blockedCount = deliverableActions.filter((a) => a.status === ActionStatus.BLOCKED).length;
    const delegatedCount = deliverableActions.filter((a) => a.status === ActionStatus.DELEGATED).length;
    
    if (actionCount === 0) {
      return { progress: 0, actionCount: 0, doingCount: 0, blockedCount: 0, delegatedCount: 0 };
    }
    
    let totalProgress = 0;
    for (const action of deliverableActions) {
      totalProgress += this.computeActionProgress(action.id, userId).progress;
    }
    
    return {
      progress: Math.round(totalProgress / actionCount),
      actionCount,
      doingCount,
      blockedCount,
      delegatedCount,
    };
  }

  private computeStreamProgress(streamId: string, userId: string): {
    progress: number;
    deliverableCount: number;
    doingCount: number;
    blockedCount: number;
    delegatedCount: number;
    inProgressDeliverables: { name: string; progress: number; isEarliest: boolean }[];
  } {
    const streamDeliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.streamId === streamId && d.userId === userId && !d.isDeleted
    );
    const deliverableCount = streamDeliverables.length;
    
    let totalProgress = 0;
    let doingCount = 0;
    let blockedCount = 0;
    let delegatedCount = 0;
    const inProgressDeliverables: { name: string; progress: number; milestoneDate: string | null }[] = [];
    
    for (const del of streamDeliverables) {
      const delStats = this.computeDeliverableProgress(del.id, userId);
      totalProgress += delStats.progress;
      doingCount += delStats.doingCount;
      blockedCount += delStats.blockedCount;
      delegatedCount += delStats.delegatedCount;
      if (del.status === DeliverableStatus.IN_PROGRESS) {
        inProgressDeliverables.push({
          name: del.name,
          progress: delStats.progress,
          milestoneDate: del.milestoneDate || null,
        });
      }
    }
    
    let earliestName: string | null = null;
    let earliestDate: Date | null = null;
    for (const d of inProgressDeliverables) {
      if (d.milestoneDate) {
        const date = new Date(d.milestoneDate);
        if (!earliestDate || date < earliestDate) {
          earliestDate = date;
          earliestName = d.name;
        }
      }
    }
    
    const result = inProgressDeliverables
      .sort((a, b) => {
        if (a.name === earliestName) return -1;
        if (b.name === earliestName) return 1;
        return 0;
      })
      .map((d) => ({
        name: d.name,
        progress: d.progress,
        isEarliest: d.name === earliestName,
      }));
    
    return {
      progress: deliverableCount > 0 ? Math.round(totalProgress / deliverableCount) : 0,
      deliverableCount,
      doingCount,
      blockedCount,
      delegatedCount,
      inProgressDeliverables: result,
    };
  }

  async getStreams(userId: string): Promise<StreamWithProgress[]> {
    const streams = Array.from(this.streams.values()).filter((s) => s.userId === userId && !s.isDeleted);
    return streams.map((stream) => {
      const stats = this.computeStreamProgress(stream.id, userId);
      return { ...stream, ...stats };
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
      momentumStatus: MomentumStatus.ACTIVE,
      ordinal,
      isDeleted: false,
    };
    this.streams.set(id, stream);
    return stream;
  }

  async updateStream(userId: string, id: string, data: Partial<InsertStream>): Promise<Stream | undefined> {
    const stream = this.streams.get(id);
    if (!stream || stream.userId !== userId || stream.isDeleted) return undefined;
    const updated = { ...stream, ...data };
    this.streams.set(id, updated);
    return updated;
  }

  async deleteStream(userId: string, id: string): Promise<boolean> {
    const stream = this.streams.get(id);
    if (!stream || stream.userId !== userId) return false;
    stream.isDeleted = true;
    for (const del of this.deliverables.values()) {
      if (del.streamId === id && del.userId === userId) {
        del.isDeleted = true;
        for (const action of this.actions.values()) {
          if (action.deliverableId === del.id && action.userId === userId) {
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

  async getDeliverables(userId: string): Promise<DeliverableWithProgress[]> {
    const deliverables = Array.from(this.deliverables.values()).filter((d) => d.userId === userId && !d.isDeleted);
    return deliverables.map((del) => {
      const stats = this.computeDeliverableProgress(del.id, userId);
      return { ...del, ...stats };
    });
  }

  async getDeliverablesByStream(userId: string, streamId: string): Promise<DeliverableWithProgress[]> {
    const deliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.streamId === streamId && d.userId === userId && !d.isDeleted
    );
    return deliverables.map((del) => {
      const stats = this.computeDeliverableProgress(del.id, userId);
      return { ...del, ...stats };
    });
  }

  async getDeliverable(userId: string, id: string): Promise<Deliverable | undefined> {
    const del = this.deliverables.get(id);
    if (!del || del.userId !== userId || del.isDeleted) return undefined;
    return del;
  }

  async createDeliverable(userId: string, data: InsertDeliverable): Promise<Deliverable> {
    const parentStream = this.streams.get(data.streamId);
    if (!parentStream || parentStream.userId !== userId || parentStream.isDeleted) {
      throw new Error("Parent stream not found or access denied");
    }
    const id = randomUUID();
    const streamDeliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.streamId === data.streamId && d.userId === userId
    );
    const ordinal = streamDeliverables.length + 1;
    const deliverable: Deliverable = {
      id,
      userId,
      key: `DLV${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description,
      streamId: data.streamId,
      milestoneDate: data.milestoneDate,
      phases: data.phases || [],
      owners: data.owners || [],
      labels: data.labels || [],
      status: (data.status as any) || DeliverableStatus.IN_PROGRESS,
      ordinal,
      isDeleted: false,
    };
    this.deliverables.set(id, deliverable);
    this.updateStreamMilestone(data.streamId, userId);
    this.updateStreamMomentum(data.streamId, userId);
    return deliverable;
  }

  private updateStreamMilestone(streamId: string, userId: string) {
    const stream = this.streams.get(streamId);
    if (!stream || stream.userId !== userId) return;
    const deliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.streamId === streamId && d.userId === userId && !d.isDeleted && d.milestoneDate
    );
    if (deliverables.length === 0) {
      stream.computedMilestoneDate = undefined;
      return;
    }
    const earliest = deliverables.reduce((min, d) => {
      if (!d.milestoneDate) return min;
      if (!min) return d.milestoneDate;
      return d.milestoneDate < min ? d.milestoneDate : min;
    }, deliverables[0].milestoneDate);
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

  private getStreamIdFromDeliverable(deliverableId: string): string | undefined {
    const deliverable = this.deliverables.get(deliverableId);
    return deliverable?.streamId;
  }

  private getStreamIdFromAction(actionId: string): string | undefined {
    const action = this.actions.get(actionId);
    if (!action) return undefined;
    return action.streamId;
  }

  async updateDeliverable(userId: string, id: string, data: Partial<InsertDeliverable>): Promise<Deliverable | undefined> {
    const del = this.deliverables.get(id);
    if (!del || del.userId !== userId || del.isDeleted) return undefined;
    if (data.streamId && data.streamId !== del.streamId) {
      const newParentStream = this.streams.get(data.streamId);
      if (!newParentStream || newParentStream.userId !== userId || newParentStream.isDeleted) {
        return undefined;
      }
    }
    const statusChanged = data.status !== undefined && data.status !== del.status;
    const oldStreamId = del.streamId;
    const updated: Deliverable = { ...del, ...data } as Deliverable;
    this.deliverables.set(id, updated);
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

  async deleteDeliverable(userId: string, id: string): Promise<boolean> {
    const del = this.deliverables.get(id);
    if (!del || del.userId !== userId) return false;
    del.isDeleted = true;
    for (const action of this.actions.values()) {
      if (action.deliverableId === id && action.userId === userId) {
        action.isDeleted = true;
        for (const step of this.steps.values()) {
          if (step.actionId === action.id && step.userId === userId) {
            step.isDeleted = true;
          }
        }
      }
    }
    this.updateStreamMilestone(del.streamId, userId);
    return true;
  }

  async getActions(userId: string): Promise<ActionWithProgress[]> {
    const actions = Array.from(this.actions.values()).filter((a) => a.userId === userId && !a.isDeleted);
    return actions.map((action) => {
      const stats = this.computeActionProgress(action.id, userId);
      return { ...action, ...stats };
    });
  }

  async getActionsByDeliverable(userId: string, deliverableId: string): Promise<ActionWithProgress[]> {
    const actions = Array.from(this.actions.values()).filter(
      (a) => a.deliverableId === deliverableId && a.userId === userId && !a.isDeleted
    );
    return actions.map((action) => {
      const stats = this.computeActionProgress(action.id, userId);
      return { ...action, ...stats };
    });
  }

  async getAction(userId: string, id: string): Promise<ActionWithProgress | undefined> {
    const action = this.actions.get(id);
    if (!action || action.userId !== userId || action.isDeleted) return undefined;
    const stats = this.computeActionProgress(id, userId);
    return { ...action, ...stats };
  }

  async createAction(userId: string, data: InsertAction): Promise<Action> {
    const parentDeliverable = this.deliverables.get(data.deliverableId);
    if (!parentDeliverable || parentDeliverable.userId !== userId || parentDeliverable.isDeleted) {
      throw new Error("Parent deliverable not found or access denied");
    }
    const parentStream = this.streams.get(data.streamId);
    if (!parentStream || parentStream.userId !== userId || parentStream.isDeleted) {
      throw new Error("Parent stream not found or access denied");
    }
    const id = randomUUID();
    const deliverableActions = Array.from(this.actions.values()).filter(
      (a) => a.deliverableId === data.deliverableId && a.userId === userId
    );
    const ordinal = deliverableActions.length + 1;
    const kanbanOrder = deliverableActions.filter((a) => a.status === data.status).length + 1;
    const action: Action = {
      id,
      userId,
      key: `ACT${String(ordinal).padStart(2, "0")}`,
      name: data.name,
      description: data.description,
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

  async updateAction(userId: string, id: string, data: Partial<InsertAction>): Promise<Action | undefined> {
    const action = this.actions.get(id);
    if (!action || action.userId !== userId || action.isDeleted) return undefined;
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
    const updated: Action = { ...action, ...data } as Action;
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
    deliverables: Deliverable[];
    actions: Action[];
    steps: Step[];
  }> {
    return {
      streams: Array.from(this.streams.values()).filter((s) => s.userId === userId && s.isDeleted),
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

  async restoreDeliverable(userId: string, id: string): Promise<boolean> {
    const del = this.deliverables.get(id);
    if (!del || del.userId !== userId || !del.isDeleted) return false;
    del.isDeleted = false;
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
}

export const storage = new MemStorage();
