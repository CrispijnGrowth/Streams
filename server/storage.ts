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
  getStreams(): Promise<StreamWithProgress[]>;
  getStream(id: string): Promise<Stream | undefined>;
  createStream(data: InsertStream): Promise<Stream>;
  updateStream(id: string, data: Partial<InsertStream>): Promise<Stream | undefined>;
  deleteStream(id: string): Promise<boolean>;

  getDeliverables(): Promise<DeliverableWithProgress[]>;
  getDeliverablesByStream(streamId: string): Promise<DeliverableWithProgress[]>;
  getDeliverable(id: string): Promise<Deliverable | undefined>;
  createDeliverable(data: InsertDeliverable): Promise<Deliverable>;
  updateDeliverable(id: string, data: Partial<InsertDeliverable>): Promise<Deliverable | undefined>;
  deleteDeliverable(id: string): Promise<boolean>;

  getActions(): Promise<ActionWithProgress[]>;
  getActionsByDeliverable(deliverableId: string): Promise<ActionWithProgress[]>;
  getAction(id: string): Promise<ActionWithProgress | undefined>;
  createAction(data: InsertAction): Promise<Action>;
  updateAction(id: string, data: Partial<InsertAction>): Promise<Action | undefined>;
  deleteAction(id: string): Promise<boolean>;

  getSteps(): Promise<Step[]>;
  getStepsByAction(actionId: string): Promise<Step[]>;
  getStep(id: string): Promise<Step | undefined>;
  createStep(data: InsertStep): Promise<Step>;
  updateStep(id: string, data: Partial<InsertStep>): Promise<Step | undefined>;
  deleteStep(id: string): Promise<boolean>;

  getDeletedItems(): Promise<{
    streams: Stream[];
    deliverables: Deliverable[];
    actions: Action[];
    steps: Step[];
  }>;
  restoreStream(id: string): Promise<boolean>;
  restoreDeliverable(id: string): Promise<boolean>;
  restoreAction(id: string): Promise<boolean>;
  restoreStep(id: string): Promise<boolean>;
}

function excelDateToISO(excelDate: number): string {
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  return date.toISOString().split("T")[0];
}

export class MemStorage implements IStorage {
  private streams: Map<string, Stream> = new Map();
  private deliverables: Map<string, Deliverable> = new Map();
  private actions: Map<string, Action> = new Map();
  private steps: Map<string, Step> = new Map();

  constructor() {
    this.loadDummyData();
  }

  private loadDummyData() {
    const streamsData = [
      { key: "STRM01", name: "Stream Alpha", description: "Primary initiative for modernizing core platform infrastructure and migrating legacy systems to cloud-native architecture.", phases: ["DESIGN", "MODERNIZATION & MIGRATION"], owners: ["Owner J"], labels: ["Priority:High", "Priority:Low", "Region:US"], momentumStatus: "Active", computedMilestoneDate: 46034 },
      { key: "STRM02", name: "Stream Beta", description: "Strategic transformation program focusing on process optimization.", phases: ["MODERNIZATION & MIGRATION", "STRATEGY"], owners: ["Owner B", "Owner F"], labels: ["Priority:Low", "Region:US", "Region:EU"], momentumStatus: "Active", computedMilestoneDate: 46025 },
      { key: "STRM03", name: "Stream Gamma", description: "Cross-functional initiative to improve operational efficiency and reduce technical debt across multiple business units.", phases: ["STRATEGY", "MODERNIZATION & MIGRATION"], owners: ["Owner K", "Owner I"], labels: ["Risk:Normal", "Priority:Low"], momentumStatus: "Active", computedMilestoneDate: 46142 },
      { key: "STRM04", name: "Stream Delta", description: "Infrastructure modernization effort.", phases: ["MODERNIZATION & MIGRATION"], owners: ["Owner C", "Owner A"], labels: ["Priority:Medium"], momentumStatus: "Stalled", computedMilestoneDate: 46041 },
      { key: "STRM05", name: "Stream Epsilon", description: "Design-led initiative to reimagine customer experience and establish new strategic partnerships for market expansion.", phases: ["STRATEGY", "DESIGN"], owners: ["Owner E"], labels: ["Priority:Low", "Risk:Normal"], momentumStatus: "Active", computedMilestoneDate: 46148 },
      { key: "STRM06", name: "Stream Zeta", description: "Operational management and migration program.", phases: ["MANAGE", "MODERNIZATION & MIGRATION"], owners: ["Owner J"], labels: ["Priority:Medium", "Risk:At-Risk", "Risk:Normal"], momentumStatus: "Stalled", computedMilestoneDate: 46200 },
      { key: "STRM07", name: "Stream Eta", description: "European market expansion initiative combining design thinking with system modernization to deliver localized solutions.", phases: ["MODERNIZATION & MIGRATION", "DESIGN"], owners: ["Owner F"], labels: ["Region:EU", "Priority:High", "Risk:Normal"], momentumStatus: "Active", computedMilestoneDate: 46023 },
      { key: "STRM08", name: "Stream Theta", description: "Strategic design program for next-gen products.", phases: ["DESIGN", "STRATEGY"], owners: ["Owner B", "Owner C"], labels: ["Priority:Medium", "Region:EU"], momentumStatus: "Active", computedMilestoneDate: 46026 },
      { key: "STRM09", name: "Stream Iota", description: "Design and operations management stream.", phases: ["DESIGN", "MANAGE"], owners: ["Owner L"], labels: ["Region:EU", "Risk:Normal"], momentumStatus: "Active", computedMilestoneDate: 46072 },
    ];

    for (let i = 0; i < streamsData.length; i++) {
      const s = streamsData[i];
      const id = randomUUID();
      this.streams.set(id, {
        id,
        key: s.key,
        name: s.name,
        description: s.description,
        phases: s.phases,
        owners: s.owners,
        labels: s.labels,
        momentumStatus: s.momentumStatus as any,
        computedMilestoneDate: s.computedMilestoneDate ? excelDateToISO(s.computedMilestoneDate) : undefined,
        ordinal: i + 1,
        isDeleted: false,
      });
    }

    const deliverablesData = [
      { key: "DLV01-01", name: "Deliverable A1", description: "Complete migration of authentication services to new identity platform with enhanced security features.", streamKey: "STRM01", milestoneDate: 46387, phases: ["MODERNIZATION & MIGRATION"], owners: ["Owner D"], labels: ["Priority:Medium"], status: "In Progress", ordinal: 1 },
      { key: "DLV01-02", name: "Deliverable A2", description: "Database optimization and migration.", streamKey: "STRM01", milestoneDate: 46240, phases: ["MODERNIZATION & MIGRATION"], owners: ["Owner B"], labels: ["Region:EU", "Risk:At-Risk"], status: "In Progress", ordinal: 2 },
      { key: "DLV01-03", name: "Deliverable A3", description: "Strategic roadmap development for Q3-Q4 initiatives including resource allocation and timeline planning.", streamKey: "STRM01", milestoneDate: 46283, phases: ["STRATEGY"], owners: ["Owner F"], labels: [], status: "On Hold", ordinal: 3 },
      { key: "DLV02-01", name: "Deliverable B1", description: "Market analysis and competitive positioning strategy.", streamKey: "STRM02", milestoneDate: 46373, phases: ["STRATEGY"], owners: ["Owner L"], labels: [], status: "In Progress", ordinal: 1 },
      { key: "DLV02-02", name: "Deliverable B2", description: "User interface redesign for improved accessibility and modern aesthetics aligned with brand guidelines.", streamKey: "STRM02", milestoneDate: 46344, phases: ["DESIGN"], owners: ["Owner L"], labels: ["Priority:Medium", "Region:US"], status: "In Progress", ordinal: 2 },
      { key: "DLV02-03", name: "Deliverable B3", description: "Legacy system migration.", streamKey: "STRM02", milestoneDate: 46025, phases: ["MODERNIZATION & MIGRATION"], owners: ["Owner H"], labels: [], status: "On Hold", ordinal: 3 },
      { key: "DLV03-01", name: "Deliverable C1", description: "Design system implementation with reusable components for EU market.", streamKey: "STRM03", milestoneDate: 46257, phases: ["DESIGN"], owners: ["Owner F"], labels: ["Region:EU"], status: "In Progress", ordinal: 1 },
      { key: "DLV03-02", name: "Deliverable C2", description: "Mobile-first responsive design implementation ensuring seamless experience across all device types and screen sizes.", streamKey: "STRM03", milestoneDate: 46142, phases: ["DESIGN"], owners: ["Owner E"], labels: [], status: "In Progress", ordinal: 2 },
      { key: "DLV04-01", name: "Deliverable D1", description: "Cloud infrastructure setup.", streamKey: "STRM04", milestoneDate: 46231, phases: ["MODERNIZATION & MIGRATION"], owners: ["Owner E"], labels: ["Region:US", "Risk:Normal"], status: "In Progress", ordinal: 1 },
      { key: "DLV04-02", name: "Deliverable D2", description: "API gateway implementation with rate limiting, authentication, and comprehensive monitoring capabilities.", streamKey: "STRM04", milestoneDate: 46074, phases: ["MODERNIZATION & MIGRATION"], owners: ["Owner J"], labels: ["Priority:Medium"], status: "In Progress", ordinal: 2 },
      { key: "DLV05-01", name: "Deliverable E1", description: "Customer journey mapping and experience optimization.", streamKey: "STRM05", milestoneDate: 46220, phases: ["MANAGE"], owners: ["Owner A"], labels: ["Priority:Medium", "Risk:At-Risk"], status: "In Progress", ordinal: 1 },
      { key: "DLV06-01", name: "Deliverable F1", description: "Operational process automation using modern workflow tools to reduce manual intervention and improve efficiency.", streamKey: "STRM06", milestoneDate: 46259, phases: ["MODERNIZATION & MIGRATION"], owners: ["Owner G"], labels: ["Region:EU", "Risk:At-Risk"], status: "On Hold", ordinal: 1 },
      { key: "DLV07-01", name: "Deliverable G1", description: "Localized design for EU compliance.", streamKey: "STRM07", milestoneDate: 46023, phases: ["DESIGN"], owners: ["Owner C"], labels: ["Priority:Low"], status: "In Progress", ordinal: 1 },
      { key: "DLV08-01", name: "Deliverable H1", description: "Strategic planning workshop series.", streamKey: "STRM08", milestoneDate: 46026, phases: ["STRATEGY"], owners: ["Owner E"], labels: [], status: "In Progress", ordinal: 1 },
      { key: "DLV09-01", name: "Deliverable I1", description: "Operational dashboard design and implementation for real-time monitoring of key performance indicators.", streamKey: "STRM09", milestoneDate: 46072, phases: ["MANAGE"], owners: ["Owner L"], labels: ["Region:EU"], status: "In Progress", ordinal: 1 },
    ];

    const streamIdByKey = new Map<string, string>();
    for (const [id, stream] of this.streams) {
      streamIdByKey.set(stream.key, id);
    }

    for (const d of deliverablesData) {
      const id = randomUUID();
      const streamId = streamIdByKey.get(d.streamKey);
      if (!streamId) continue;
      this.deliverables.set(id, {
        id,
        key: d.key,
        name: d.name,
        description: d.description,
        streamId,
        milestoneDate: d.milestoneDate ? excelDateToISO(d.milestoneDate) : undefined,
        phases: d.phases,
        owners: d.owners,
        labels: d.labels,
        status: d.status as any,
        ordinal: d.ordinal,
        isDeleted: false,
      });
    }

    const deliverableIdByKey = new Map<string, string>();
    for (const [id, del] of this.deliverables) {
      deliverableIdByKey.set(del.key, id);
    }

    const actionsData = [
      { key: "ACT01-01-01", name: "Action A1-1", description: "Configure OAuth2 providers and integrate with SSO.", deliverableKey: "DLV01-01", streamKey: "STRM01", status: "Executing", dueDate: 46367, effort: 7, owners: ["Owner E"], labels: ["Region:US", "Priority:Medium"], kanbanOrder: 1, ordinal: 1 },
      { key: "ACT01-01-02", name: "Action A1-2", description: "Implement token refresh mechanism and session management with proper expiration handling and secure storage.", deliverableKey: "DLV01-01", streamKey: "STRM01", status: "Executing", dueDate: 46404, effort: 4, owners: ["Owner I"], labels: ["Region:EU"], kanbanOrder: 2, ordinal: 2 },
      { key: "ACT01-01-03", name: "Action A1-3", description: "Set up multi-factor authentication flows.", deliverableKey: "DLV01-01", streamKey: "STRM01", status: "To Execute", dueDate: null, effort: 11, owners: ["Owner B"], labels: ["Priority:High"], kanbanOrder: 3, ordinal: 3 },
      { key: "ACT01-02-01", name: "Action A2-1", description: "Analyze current database schema and identify optimization opportunities for improved query performance.", deliverableKey: "DLV01-02", streamKey: "STRM01", status: "Executing", dueDate: 46211, effort: 12, owners: ["Owner D"], labels: ["Risk:Normal"], kanbanOrder: 1, ordinal: 1 },
      { key: "ACT01-02-02", name: "Action A2-2", description: "Create database indexes and tune queries.", deliverableKey: "DLV01-02", streamKey: "STRM01", status: "Executing", dueDate: 46260, effort: 6, owners: ["Owner L"], labels: [], kanbanOrder: 2, ordinal: 2 },
      { key: "ACT02-01-01", name: "Action B1-1", description: "Conduct competitive analysis research.", deliverableKey: "DLV02-01", streamKey: "STRM02", status: "Backlog", dueDate: 46380, effort: 5, owners: ["Owner H"], labels: [], kanbanOrder: 1, ordinal: 1 },
      { key: "ACT02-01-02", name: "Action B1-2", description: "Define market positioning strategy and develop messaging framework aligned with brand values and target audience.", deliverableKey: "DLV02-01", streamKey: "STRM02", status: "To Execute", dueDate: 46390, effort: 8, owners: ["Owner I"], labels: ["Priority:Low"], kanbanOrder: 2, ordinal: 2 },
      { key: "ACT02-02-01", name: "Action B2-1", description: "Complete UI component library with accessibility support.", deliverableKey: "DLV02-02", streamKey: "STRM02", status: "Done", dueDate: 46350, effort: 6, owners: ["Owner L"], labels: [], kanbanOrder: 1, ordinal: 1 },
      { key: "ACT03-01-01", name: "Action C1-1", description: "Build component library for EU region.", deliverableKey: "DLV03-01", streamKey: "STRM03", status: "Executing", dueDate: 46260, effort: 10, owners: ["Owner F"], labels: ["Region:EU"], kanbanOrder: 1, ordinal: 1 },
      { key: "ACT03-01-02", name: "Action C1-2", description: "Implement responsive layouts and breakpoints ensuring consistent experience across desktop, tablet, and mobile devices.", deliverableKey: "DLV03-01", streamKey: "STRM03", status: "Blocked", dueDate: 46270, effort: 5, owners: ["Owner E"], labels: [], kanbanOrder: 2, ordinal: 2 },
      { key: "ACT04-01-01", name: "Action D1-1", description: "Provision cloud resources and configure networking.", deliverableKey: "DLV04-01", streamKey: "STRM04", status: "Executing", dueDate: 46235, effort: 8, owners: ["Owner E"], labels: [], kanbanOrder: 1, ordinal: 1 },
      { key: "ACT04-01-02", name: "Action D1-2", description: "Set up CI/CD pipeline.", deliverableKey: "DLV04-01", streamKey: "STRM04", status: "Delegated", dueDate: null, effort: 4, owners: ["Owner C"], labels: ["Priority:High"], kanbanOrder: 2, ordinal: 2 },
      { key: "ACT05-01-01", name: "Action E1-1", description: "Map customer touchpoints and identify pain points through user research and analytics data analysis.", deliverableKey: "DLV05-01", streamKey: "STRM05", status: "Executing", dueDate: 46225, effort: 7, owners: ["Owner A"], labels: [], kanbanOrder: 1, ordinal: 1 },
      { key: "ACT06-01-01", name: "Action F1-1", description: "Document current workflows for automation.", deliverableKey: "DLV06-01", streamKey: "STRM06", status: "Backlog", dueDate: 46265, effort: 6, owners: ["Owner G"], labels: [], kanbanOrder: 1, ordinal: 1 },
      { key: "ACT07-01-01", name: "Action G1-1", description: "Adapt design system for GDPR compliance and EU accessibility standards including proper consent management.", deliverableKey: "DLV07-01", streamKey: "STRM07", status: "Executing", dueDate: 46030, effort: 9, owners: ["Owner C"], labels: [], kanbanOrder: 1, ordinal: 1 },
    ];

    for (const a of actionsData) {
      const id = randomUUID();
      const deliverableId = deliverableIdByKey.get(a.deliverableKey);
      const streamId = streamIdByKey.get(a.streamKey);
      if (!deliverableId || !streamId) continue;
      this.actions.set(id, {
        id,
        key: a.key,
        name: a.name,
        description: a.description,
        deliverableId,
        streamId,
        status: a.status as any,
        dueDate: a.dueDate ? excelDateToISO(a.dueDate) : undefined,
        effort: a.effort,
        owners: a.owners,
        labels: a.labels,
        kanbanOrder: a.kanbanOrder,
        ordinal: a.ordinal,
        isDeleted: false,
      });
    }

    const actionIdByKey = new Map<string, string>();
    for (const [id, action] of this.actions) {
      actionIdByKey.set(action.key, id);
    }

    const stepsData = [
      { key: "STP01-01-01-01", name: "Step A1-1.1", note: "Register OAuth2 application with identity provider.", actionKey: "ACT01-01-01", isDone: true, dueDate: 46370, owner: "Owner I" },
      { key: "STP01-01-01-02", name: "Step A1-1.2", note: "Configure callback URLs and scopes.", actionKey: "ACT01-01-01", isDone: true, dueDate: 46369, owner: "Owner L" },
      { key: "STP01-01-01-03", name: "Step A1-1.3", note: "Test SSO flow end-to-end with all configured providers and verify proper token handling.", actionKey: "ACT01-01-01", isDone: false, dueDate: null, owner: "Owner D" },
      { key: "STP01-01-02-01", name: "Step A1-2.1", note: "Implement token storage mechanism.", actionKey: "ACT01-01-02", isDone: true, dueDate: null, owner: "Owner C" },
      { key: "STP01-01-02-02", name: "Step A1-2.2", note: "Add refresh token rotation logic with proper error handling and retry mechanisms.", actionKey: "ACT01-01-02", isDone: true, dueDate: 46414, owner: "Owner B" },
      { key: "STP01-01-02-03", name: "Step A1-2.3", note: "Test session expiration scenarios.", actionKey: "ACT01-01-02", isDone: false, dueDate: 46399, owner: "Owner I" },
      { key: "STP01-02-01-01", name: "Step A2-1.1", note: "Document current schema structure.", actionKey: "ACT01-02-01", isDone: false, dueDate: null, owner: "Owner D" },
      { key: "STP01-02-01-02", name: "Step A2-1.2", note: "Run query analysis tools.", actionKey: "ACT01-02-01", isDone: false, dueDate: 46217, owner: "Owner L" },
      { key: "STP01-02-01-03", name: "Step A2-1.3", note: "Identify slow queries using database profiling tools and create optimization recommendations.", actionKey: "ACT01-02-01", isDone: true, dueDate: 46218, owner: "Owner B" },
      { key: "STP02-01-01-01", name: "Step B1-1.1", note: "Gather competitor product data.", actionKey: "ACT02-01-01", isDone: false, dueDate: 46385, owner: "Owner H" },
      { key: "STP02-01-01-02", name: "Step B1-1.2", note: "Create comparison matrix for features, pricing, and market positioning.", actionKey: "ACT02-01-01", isDone: false, dueDate: null, owner: "Owner I" },
      { key: "STP03-01-01-01", name: "Step C1-1.1", note: "Set up component library project.", actionKey: "ACT03-01-01", isDone: true, dueDate: 46265, owner: "Owner F" },
      { key: "STP03-01-01-02", name: "Step C1-1.2", note: "Build core button and input components.", actionKey: "ACT03-01-01", isDone: false, dueDate: 46268, owner: "Owner E" },
      { key: "STP04-01-01-01", name: "Step D1-1.1", note: "Create infrastructure as code templates for cloud resource provisioning.", actionKey: "ACT04-01-01", isDone: true, dueDate: 46240, owner: "Owner E" },
      { key: "STP04-01-01-02", name: "Step D1-1.2", note: "Configure network security groups.", actionKey: "ACT04-01-01", isDone: true, dueDate: 46238, owner: "Owner C" },
    ];

    for (let i = 0; i < stepsData.length; i++) {
      const s = stepsData[i];
      const id = randomUUID();
      const actionId = actionIdByKey.get(s.actionKey);
      if (!actionId) continue;
      this.steps.set(id, {
        id,
        key: s.key,
        name: s.name,
        note: s.note,
        actionId,
        isDone: s.isDone,
        dueDate: s.dueDate ? excelDateToISO(s.dueDate) : undefined,
        owner: s.owner,
        ordinal: i + 1,
        isDeleted: false,
      });
    }
  }

  private computeActionProgress(actionId: string): { progress: number; stepCount: number; doneStepCount: number } {
    const actionSteps = Array.from(this.steps.values()).filter(
      (s) => s.actionId === actionId && !s.isDeleted
    );
    const doneStepCount = actionSteps.filter((s) => s.isDone).length;
    const stepCount = actionSteps.length;
    
    if (stepCount === 0) {
      const action = this.actions.get(actionId);
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

  private computeDeliverableProgress(deliverableId: string): {
    progress: number;
    actionCount: number;
    doingCount: number;
    blockedCount: number;
    delegatedCount: number;
  } {
    const deliverableActions = Array.from(this.actions.values()).filter(
      (a) => a.deliverableId === deliverableId && !a.isDeleted
    );
    const actionCount = deliverableActions.length;
    const doingCount = deliverableActions.filter((a) => a.status === ActionStatus.EXECUTING).length;
    const blockedCount = deliverableActions.filter((a) => a.status === ActionStatus.BLOCKED).length;
    const delegatedCount = deliverableActions.filter((a) => a.status === ActionStatus.DELEGATED).length;
    
    if (actionCount === 0) {
      const deliverable = this.deliverables.get(deliverableId);
      if (!deliverable) return { progress: 0, actionCount: 0, doingCount: 0, blockedCount: 0, delegatedCount: 0 };
      switch (deliverable.status) {
        case ActionStatus.DONE:
          return { progress: 100, actionCount: 0, doingCount: 0, blockedCount: 0, delegatedCount: 0 };
        case ActionStatus.EXECUTING:
          return { progress: 50, actionCount: 0, doingCount: 0, blockedCount: 0, delegatedCount: 0 };
        default:
          return { progress: 0, actionCount: 0, doingCount: 0, blockedCount: 0, delegatedCount: 0 };
      }
    }
    
    let totalProgress = 0;
    for (const action of deliverableActions) {
      totalProgress += this.computeActionProgress(action.id).progress;
    }
    
    return {
      progress: Math.round(totalProgress / actionCount),
      actionCount,
      doingCount,
      blockedCount,
      delegatedCount,
    };
  }

  private computeStreamProgress(streamId: string): {
    progress: number;
    deliverableCount: number;
    doingCount: number;
    blockedCount: number;
    delegatedCount: number;
  } {
    const streamDeliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.streamId === streamId && !d.isDeleted
    );
    const deliverableCount = streamDeliverables.length;
    
    let totalProgress = 0;
    let doingCount = 0;
    let blockedCount = 0;
    let delegatedCount = 0;
    
    for (const del of streamDeliverables) {
      const delStats = this.computeDeliverableProgress(del.id);
      totalProgress += delStats.progress;
      doingCount += delStats.doingCount;
      blockedCount += delStats.blockedCount;
      delegatedCount += delStats.delegatedCount;
    }
    
    return {
      progress: deliverableCount > 0 ? Math.round(totalProgress / deliverableCount) : 0,
      deliverableCount,
      doingCount,
      blockedCount,
      delegatedCount,
    };
  }

  async getStreams(): Promise<StreamWithProgress[]> {
    const streams = Array.from(this.streams.values()).filter((s) => !s.isDeleted);
    return streams.map((stream) => {
      const stats = this.computeStreamProgress(stream.id);
      return { ...stream, ...stats };
    });
  }

  async getStream(id: string): Promise<Stream | undefined> {
    const stream = this.streams.get(id);
    return stream && !stream.isDeleted ? stream : undefined;
  }

  async createStream(data: InsertStream): Promise<Stream> {
    const id = randomUUID();
    const ordinal = this.streams.size + 1;
    const stream: Stream = {
      id,
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

  async updateStream(id: string, data: Partial<InsertStream>): Promise<Stream | undefined> {
    const stream = this.streams.get(id);
    if (!stream || stream.isDeleted) return undefined;
    const updated = { ...stream, ...data };
    this.streams.set(id, updated);
    return updated;
  }

  async deleteStream(id: string): Promise<boolean> {
    const stream = this.streams.get(id);
    if (!stream) return false;
    stream.isDeleted = true;
    for (const del of this.deliverables.values()) {
      if (del.streamId === id) {
        del.isDeleted = true;
        for (const action of this.actions.values()) {
          if (action.deliverableId === del.id) {
            action.isDeleted = true;
            for (const step of this.steps.values()) {
              if (step.actionId === action.id) {
                step.isDeleted = true;
              }
            }
          }
        }
      }
    }
    return true;
  }

  async getDeliverables(): Promise<DeliverableWithProgress[]> {
    const deliverables = Array.from(this.deliverables.values()).filter((d) => !d.isDeleted);
    return deliverables.map((del) => {
      const stats = this.computeDeliverableProgress(del.id);
      return { ...del, ...stats };
    });
  }

  async getDeliverablesByStream(streamId: string): Promise<DeliverableWithProgress[]> {
    const deliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.streamId === streamId && !d.isDeleted
    );
    return deliverables.map((del) => {
      const stats = this.computeDeliverableProgress(del.id);
      return { ...del, ...stats };
    });
  }

  async getDeliverable(id: string): Promise<Deliverable | undefined> {
    const del = this.deliverables.get(id);
    return del && !del.isDeleted ? del : undefined;
  }

  async createDeliverable(data: InsertDeliverable): Promise<Deliverable> {
    const id = randomUUID();
    const streamDeliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.streamId === data.streamId
    );
    const ordinal = streamDeliverables.length + 1;
    const deliverable: Deliverable = {
      id,
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
    this.updateStreamMilestone(data.streamId);
    this.updateStreamMomentum(data.streamId);
    return deliverable;
  }

  private updateStreamMilestone(streamId: string) {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    const deliverables = Array.from(this.deliverables.values()).filter(
      (d) => d.streamId === streamId && !d.isDeleted && d.milestoneDate
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

  private updateStreamMomentum(streamId: string) {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    
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

  async activateStream(id: string): Promise<StreamWithProgress | undefined> {
    const stream = this.streams.get(id);
    if (!stream || stream.isDeleted) return undefined;
    
    stream.lastMovementAt = new Date().toISOString();
    stream.momentumStatus = MomentumStatus.ACTIVE;
    
    const stats = this.computeStreamProgress(id);
    return { ...stream, ...stats };
  }

  async updateDeliverable(id: string, data: Partial<InsertDeliverable>): Promise<Deliverable | undefined> {
    const del = this.deliverables.get(id);
    if (!del || del.isDeleted) return undefined;
    const statusChanged = data.status !== undefined && data.status !== del.status;
    const updated: Deliverable = { ...del, ...data } as Deliverable;
    this.deliverables.set(id, updated);
    this.updateStreamMilestone(del.streamId);
    if (statusChanged) {
      this.updateStreamMomentum(del.streamId);
    }
    return updated;
  }

  async deleteDeliverable(id: string): Promise<boolean> {
    const del = this.deliverables.get(id);
    if (!del) return false;
    del.isDeleted = true;
    for (const action of this.actions.values()) {
      if (action.deliverableId === id) {
        action.isDeleted = true;
        for (const step of this.steps.values()) {
          if (step.actionId === action.id) {
            step.isDeleted = true;
          }
        }
      }
    }
    this.updateStreamMilestone(del.streamId);
    return true;
  }

  async getActions(): Promise<ActionWithProgress[]> {
    const actions = Array.from(this.actions.values()).filter((a) => !a.isDeleted);
    return actions.map((action) => {
      const stats = this.computeActionProgress(action.id);
      return { ...action, ...stats };
    });
  }

  async getActionsByDeliverable(deliverableId: string): Promise<ActionWithProgress[]> {
    const actions = Array.from(this.actions.values()).filter(
      (a) => a.deliverableId === deliverableId && !a.isDeleted
    );
    return actions.map((action) => {
      const stats = this.computeActionProgress(action.id);
      return { ...action, ...stats };
    });
  }

  async getAction(id: string): Promise<ActionWithProgress | undefined> {
    const action = this.actions.get(id);
    if (!action || action.isDeleted) return undefined;
    const stats = this.computeActionProgress(id);
    return { ...action, ...stats };
  }

  async createAction(data: InsertAction): Promise<Action> {
    const id = randomUUID();
    const deliverableActions = Array.from(this.actions.values()).filter(
      (a) => a.deliverableId === data.deliverableId
    );
    const ordinal = deliverableActions.length + 1;
    const kanbanOrder = deliverableActions.filter((a) => a.status === data.status).length + 1;
    const action: Action = {
      id,
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
      this.updateStreamMomentum(data.streamId);
    }
    return action;
  }

  async updateAction(id: string, data: Partial<InsertAction>): Promise<Action | undefined> {
    const action = this.actions.get(id);
    if (!action || action.isDeleted) return undefined;
    const statusChanged = data.status !== undefined && data.status !== action.status;
    const updated: Action = { ...action, ...data } as Action;
    this.actions.set(id, updated);
    if (statusChanged && action.streamId) {
      this.updateStreamMomentum(action.streamId);
    }
    return updated;
  }

  async deleteAction(id: string): Promise<boolean> {
    const action = this.actions.get(id);
    if (!action) return false;
    action.isDeleted = true;
    for (const step of this.steps.values()) {
      if (step.actionId === id) {
        step.isDeleted = true;
      }
    }
    return true;
  }

  async getSteps(): Promise<Step[]> {
    return Array.from(this.steps.values()).filter((s) => !s.isDeleted);
  }

  async getStepsByAction(actionId: string): Promise<Step[]> {
    return Array.from(this.steps.values()).filter(
      (s) => s.actionId === actionId && !s.isDeleted
    );
  }

  async getStep(id: string): Promise<Step | undefined> {
    const step = this.steps.get(id);
    return step && !step.isDeleted ? step : undefined;
  }

  async createStep(data: InsertStep): Promise<Step> {
    const id = randomUUID();
    const actionSteps = Array.from(this.steps.values()).filter(
      (s) => s.actionId === data.actionId
    );
    const ordinal = actionSteps.length + 1;
    const step: Step = {
      id,
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
      this.updateStreamMomentum(streamId);
    }
    return step;
  }

  async updateStep(id: string, data: Partial<InsertStep>): Promise<Step | undefined> {
    const step = this.steps.get(id);
    if (!step || step.isDeleted) return undefined;
    const isDoneChanged = data.isDone !== undefined && data.isDone !== step.isDone;
    const updated = { ...step, ...data };
    this.steps.set(id, updated);
    if (isDoneChanged) {
      const streamId = this.getStreamIdFromAction(step.actionId);
      if (streamId) {
        this.updateStreamMomentum(streamId);
      }
    }
    return updated;
  }

  async deleteStep(id: string): Promise<boolean> {
    const step = this.steps.get(id);
    if (!step) return false;
    step.isDeleted = true;
    return true;
  }

  async getDeletedItems(): Promise<{
    streams: Stream[];
    deliverables: Deliverable[];
    actions: Action[];
    steps: Step[];
  }> {
    return {
      streams: Array.from(this.streams.values()).filter((s) => s.isDeleted),
      deliverables: Array.from(this.deliverables.values()).filter((d) => d.isDeleted),
      actions: Array.from(this.actions.values()).filter((a) => a.isDeleted),
      steps: Array.from(this.steps.values()).filter((s) => s.isDeleted),
    };
  }

  async restoreStream(id: string): Promise<boolean> {
    const stream = this.streams.get(id);
    if (!stream || !stream.isDeleted) return false;
    stream.isDeleted = false;
    return true;
  }

  async restoreDeliverable(id: string): Promise<boolean> {
    const del = this.deliverables.get(id);
    if (!del || !del.isDeleted) return false;
    del.isDeleted = false;
    return true;
  }

  async restoreAction(id: string): Promise<boolean> {
    const action = this.actions.get(id);
    if (!action || !action.isDeleted) return false;
    action.isDeleted = false;
    return true;
  }

  async restoreStep(id: string): Promise<boolean> {
    const step = this.steps.get(id);
    if (!step || !step.isDeleted) return false;
    step.isDeleted = false;
    return true;
  }
}

export const storage = new MemStorage();
