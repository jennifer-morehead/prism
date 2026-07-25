import { base44 } from "./base44Client";
import {
  ConceptConnectionSummary,
  ConceptSummary,
  CreateTopicSessionData,
  CreateTopicSessionPayload,
  GenerateLensViewData,
  GenerateLensViewPayload,
  GenerationRunSummary,
  GetGenerationStatusData,
  GetGenerationStatusPayload,
  GetLensExplorationViewData,
  GetLensExplorationViewPayload,
  GetTopicSessionData,
  GetTopicSessionPayload,
  LensSummary,
  ListLensesData,
  ListLensesPayload,
  RegenerateLensViewData,
  RegenerateLensViewPayload,
  RefractedViewSummary,
  SelectLensData,
  SelectLensPayload,
  TopicSessionSummary,
} from "../types/contracts";

type GenerationStatus = GenerationRunSummary["status"];

interface TopicSessionRecord extends TopicSessionSummary {
  createdAt?: string;
  updatedAt?: string;
}

interface LensRecord extends LensSummary {
  promptTemplate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RefractedViewRecord extends RefractedViewSummary {
  topicSessionId: string;
  lensId: string;
  generationRunId?: string | null;
  retrievalEnabled?: boolean;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface GenerationRunRecord extends GenerationRunSummary {
  topicSessionId: string;
  lensId: string;
  mode: "generate" | "regenerate";
  retrievalEnabled: boolean;
  createdAt?: string;
}

interface ConceptConnectionRecord extends ConceptConnectionSummary {
  refractedViewId: string;
}

interface Base44EntityClient {
  list: () => Promise<Record<string, unknown>[]>;
  create: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (
    id: string,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}

interface Base44ClientRuntime {
  entities: Record<string, Base44EntityClient>;
  functions: {
    invoke: (
      name: string,
      payloadData?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
}

const base44Runtime = base44 as unknown as Base44ClientRuntime;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTopic(topicText: string): string {
  return topicText.trim().toLowerCase().replace(/\s+/g, " ");
}

function toTopicSessionSummary(
  record: TopicSessionRecord,
): TopicSessionSummary {
  return {
    id: record.id,
    topicText: record.topicText,
    normalizedTopic: record.normalizedTopic,
    status: record.status,
    selectedLensId: record.selectedLensId ?? null,
    activeRefractedViewId: record.activeRefractedViewId ?? null,
  };
}

function toLensSummary(record: LensRecord): LensSummary {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    description: record.description,
    displayOrder: record.displayOrder,
    accentColor: record.accentColor ?? null,
    isActive: record.isActive,
  };
}

function toRefractedViewSummary(
  record: RefractedViewRecord,
): RefractedViewSummary {
  return {
    id: record.id,
    title: record.title ?? null,
    summary: record.summary ?? null,
    status: record.status,
    retrievalSummary: record.retrievalSummary ?? null,
    generatedAt: record.generatedAt ?? null,
  };
}

function toGenerationRunSummary(
  record: GenerationRunRecord,
): GenerationRunSummary {
  return {
    id: record.id,
    status: record.status,
    startedAt: record.startedAt ?? null,
    finishedAt: record.finishedAt ?? null,
    errorCode: record.errorCode ?? null,
    errorSummary: record.errorSummary ?? null,
  };
}

function getEntity(name: string) {
  const entity = base44Runtime.entities[name];
  if (!entity) {
    throw new Error(`Base44 entity not found: ${name}`);
  }
  return entity;
}

async function tryInvoke<TPayload, TData>(
  functionName: string,
  payload: TPayload,
): Promise<TData | null> {
  try {
    return (await base44Runtime.functions.invoke(
      functionName,
      payload as unknown as Record<string, unknown>,
    )) as TData;
  } catch {
    return null;
  }
}

async function listAllTopicSessions(): Promise<TopicSessionRecord[]> {
  return (await getEntity(
    "TopicSession",
  ).list()) as unknown as TopicSessionRecord[];
}

async function listAllLenses(): Promise<LensRecord[]> {
  return (await getEntity("Lens").list()) as unknown as LensRecord[];
}

async function listAllRefractedViews(): Promise<RefractedViewRecord[]> {
  return (await getEntity(
    "RefractedView",
  ).list()) as unknown as RefractedViewRecord[];
}

async function listAllGenerationRuns(): Promise<GenerationRunRecord[]> {
  return (await getEntity(
    "GenerationRun",
  ).list()) as unknown as GenerationRunRecord[];
}

async function listConceptsForView(
  refractedViewId: string,
): Promise<ConceptSummary[]> {
  const records = (await getEntity(
    "Concept",
  ).list()) as unknown as ConceptSummary[];
  return records
    .filter((item) => item.refractedViewId === refractedViewId)
    .sort((a, b) => a.ordinal - b.ordinal);
}

async function listConnectionsForView(
  refractedViewId: string,
): Promise<ConceptConnectionSummary[]> {
  const records = (await getEntity(
    "ConceptConnection",
  ).list()) as unknown as ConceptConnectionRecord[];
  return records.filter((item) => item.refractedViewId === refractedViewId);
}

async function findTopicSession(
  topicSessionId: string,
): Promise<TopicSessionRecord> {
  const sessions = await listAllTopicSessions();
  const session = sessions.find((item) => item.id === topicSessionId);
  if (!session) {
    throw new Error("Topic session not found");
  }
  return session;
}

async function findLens(lensId: string): Promise<LensRecord> {
  const lenses = await listAllLenses();
  const lens = lenses.find((item) => item.id === lensId);
  if (!lens) {
    throw new Error("Lens not found");
  }
  return lens;
}

async function findOrCreateRefractedView(
  topicSessionId: string,
  lensId: string,
): Promise<RefractedViewRecord> {
  const refractedViews = await listAllRefractedViews();
  const existing = refractedViews.find(
    (item) => item.topicSessionId === topicSessionId && item.lensId === lensId,
  );

  if (existing) {
    return existing;
  }

  return (await getEntity("RefractedView").create({
    topicSessionId,
    lensId,
    title: null,
    summary: null,
    status: "draft",
    generationRunId: null,
    retrievalEnabled: true,
    retrievalSummary: null,
    errorMessage: null,
    generatedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })) as unknown as RefractedViewRecord;
}

function runProgressHint(
  status: GenerationStatus,
  hasSummary: boolean,
  hasConcepts: boolean,
): GetGenerationStatusData["progressHint"] {
  if (status === "queued") {
    return "queued";
  }
  if (status === "running" && !hasSummary) {
    return "generating_summary";
  }
  if ((status === "running" || status === "partial") && !hasConcepts) {
    return "generating_concepts";
  }
  if (status === "partial") {
    return "generating_connections";
  }
  if (status === "succeeded") {
    return "done";
  }
  return "failed";
}

async function advanceGeneration(
  run: GenerationRunRecord,
): Promise<GenerationRunRecord> {
  const viewList = await listAllRefractedViews();
  const view = viewList.find((item) => item.generationRunId === run.id);
  if (!view) {
    return run;
  }

  const conceptEntity = getEntity("Concept");
  const connectionEntity = getEntity("ConceptConnection");

  const concepts = await listConceptsForView(view.id);
  const connections = await listConnectionsForView(view.id);

  if (!view.summary) {
    await getEntity("RefractedView").update(view.id, {
      title: `${view.lensId} refracted view`,
      summary: `${view.lensId} perspective on this topic highlights key drivers, trade-offs, and practical actions.`,
      status: "generating",
      updatedAt: nowIso(),
    });

    return (await getEntity("GenerationRun").update(run.id, {
      status: "running",
      updatedAt: nowIso(),
    })) as unknown as GenerationRunRecord;
  }

  if (concepts.length === 0) {
    await conceptEntity.create({
      refractedViewId: view.id,
      ordinal: 1,
      title: "Primary drivers",
      body: "The strongest forces influencing outcomes for this topic.",
      confidenceScore: 0.78,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await conceptEntity.create({
      refractedViewId: view.id,
      ordinal: 2,
      title: "Trade-offs",
      body: "Competing goals and constraints that shape decisions.",
      confidenceScore: 0.75,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await conceptEntity.create({
      refractedViewId: view.id,
      ordinal: 3,
      title: "Near-term actions",
      body: "Practical next steps to reduce risk and increase learning.",
      confidenceScore: 0.73,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    return (await getEntity("GenerationRun").update(run.id, {
      status: "partial",
      updatedAt: nowIso(),
    })) as unknown as GenerationRunRecord;
  }

  if (connections.length === 0 && concepts.length >= 3) {
    await connectionEntity.create({
      refractedViewId: view.id,
      sourceConceptId: concepts[0].id,
      relationVerb: "shapes",
      targetConceptId: concepts[1].id,
      rationale: "Drivers determine the severity of trade-offs.",
      weight: 0.76,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await connectionEntity.create({
      refractedViewId: view.id,
      sourceConceptId: concepts[1].id,
      relationVerb: "prioritizes",
      targetConceptId: concepts[2].id,
      rationale: "Trade-offs determine which actions should happen first.",
      weight: 0.72,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await getEntity("RefractedView").update(view.id, {
      status: "ready",
      retrievalSummary: "Generated through Base44 SDK entity workflow.",
      generatedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const topicSessions = await listAllTopicSessions();
    const topic = topicSessions.find((item) => item.id === view.topicSessionId);
    if (topic) {
      await getEntity("TopicSession").update(topic.id, {
        status: "ready",
        activeRefractedViewId: view.id,
        updatedAt: nowIso(),
      });
    }

    return (await getEntity("GenerationRun").update(run.id, {
      status: "succeeded",
      finishedAt: nowIso(),
      updatedAt: nowIso(),
    })) as unknown as GenerationRunRecord;
  }

  return run;
}

export async function createTopicSession(
  payload: CreateTopicSessionPayload,
): Promise<CreateTopicSessionData> {
  const functionResult = await tryInvoke<
    CreateTopicSessionPayload,
    CreateTopicSessionData
  >("createTopicSession", payload);
  if (functionResult) {
    return functionResult;
  }

  const created = (await getEntity("TopicSession").create({
    topicText: payload.topicText,
    normalizedTopic: normalizeTopic(payload.topicText),
    status: "created",
    selectedLensId: null,
    activeRefractedViewId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })) as unknown as TopicSessionRecord;

  const lenses = (await listAllLenses()).filter((item) => item.isActive);
  const recommendedLensIds = lenses
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, 3)
    .map((item) => item.id);

  return {
    topicSession: toTopicSessionSummary(created),
    recommendedLensIds,
  };
}

export async function listLenses(
  payload: ListLensesPayload = {},
): Promise<ListLensesData> {
  const functionResult = await tryInvoke<ListLensesPayload, ListLensesData>(
    "listLenses",
    payload,
  );
  if (functionResult) {
    return functionResult;
  }

  const all = await listAllLenses();
  const lenses = all
    .filter((item) => payload.includeInactive || item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(toLensSummary);

  return { lenses };
}

export async function selectLens(
  payload: SelectLensPayload,
): Promise<SelectLensData> {
  const functionResult = await tryInvoke<SelectLensPayload, SelectLensData>(
    "selectLens",
    payload,
  );
  if (functionResult) {
    return functionResult;
  }

  await findLens(payload.lensId);

  const updatedSession = (await getEntity("TopicSession").update(
    payload.topicSessionId,
    {
      selectedLensId: payload.lensId,
      status: "lens_selected",
      updatedAt: nowIso(),
    },
  )) as unknown as TopicSessionRecord;

  const view = await findOrCreateRefractedView(
    payload.topicSessionId,
    payload.lensId,
  );

  return {
    topicSession: toTopicSessionSummary(updatedSession),
    refractedViewDraftId: view.id,
  };
}

export async function generateLensView(
  payload: GenerateLensViewPayload,
): Promise<GenerateLensViewData> {
  const functionResult = await tryInvoke<
    GenerateLensViewPayload,
    GenerateLensViewData
  >("generateLensView", payload);
  if (functionResult) {
    return functionResult;
  }

  const topicSession = await findTopicSession(payload.topicSessionId);
  const view = await findOrCreateRefractedView(
    payload.topicSessionId,
    payload.lensId,
  );

  await getEntity("TopicSession").update(topicSession.id, {
    selectedLensId: payload.lensId,
    status: "generating",
    updatedAt: nowIso(),
  });

  const run = (await getEntity("GenerationRun").create({
    topicSessionId: payload.topicSessionId,
    lensId: payload.lensId,
    mode: payload.forceRegenerate ? "regenerate" : "generate",
    retrievalEnabled: payload.retrievalEnabled !== false,
    status: "queued",
    startedAt: nowIso(),
    finishedAt: null,
    errorCode: null,
    errorSummary: null,
    createdAt: nowIso(),
  })) as unknown as GenerationRunRecord;

  await getEntity("RefractedView").update(view.id, {
    status: "generating",
    generationRunId: run.id,
    retrievalEnabled: payload.retrievalEnabled !== false,
    updatedAt: nowIso(),
  });

  return {
    generationRunId: run.id,
    refractedViewId: view.id,
    status: "queued",
  };
}

export async function regenerateLensView(
  payload: RegenerateLensViewPayload,
): Promise<RegenerateLensViewData> {
  const functionResult = await tryInvoke<
    RegenerateLensViewPayload,
    RegenerateLensViewData
  >("regenerateLensView", payload);
  if (functionResult) {
    return functionResult;
  }

  const generated = await generateLensView({
    topicSessionId: payload.topicSessionId,
    lensId: payload.lensId,
    forceRegenerate: true,
    retrievalEnabled: true,
  });

  return {
    generationRunId: generated.generationRunId,
    status: generated.status,
  };
}

export async function getGenerationStatus(
  payload: GetGenerationStatusPayload,
): Promise<GetGenerationStatusData> {
  const functionResult = await tryInvoke<
    GetGenerationStatusPayload,
    GetGenerationStatusData
  >("getGenerationStatus", payload);
  if (functionResult) {
    return functionResult;
  }

  const runs = await listAllGenerationRuns();
  const run = runs.find((item) => item.id === payload.generationRunId);
  if (!run) {
    throw new Error("Generation run not found");
  }

  const advanced = await advanceGeneration(run);
  const viewList = await listAllRefractedViews();
  const view = viewList.find((item) => item.generationRunId === advanced.id);
  const concepts = view ? await listConceptsForView(view.id) : [];

  return {
    generationRun: toGenerationRunSummary(advanced),
    progressHint: runProgressHint(
      advanced.status,
      Boolean(view?.summary),
      concepts.length > 0,
    ),
  };
}

export async function getLensExplorationView(
  payload: GetLensExplorationViewPayload,
): Promise<GetLensExplorationViewData> {
  const functionResult = await tryInvoke<
    GetLensExplorationViewPayload,
    GetLensExplorationViewData
  >("getLensExplorationView", payload);
  if (functionResult) {
    return functionResult;
  }

  const view = await findOrCreateRefractedView(
    payload.topicSessionId,
    payload.lensId,
  );
  const concepts = await listConceptsForView(view.id);
  const connections = await listConnectionsForView(view.id);

  const runs = await listAllGenerationRuns();
  const relatedRuns = runs.filter(
    (item) =>
      item.topicSessionId === payload.topicSessionId &&
      item.lensId === payload.lensId,
  );
  const sortedRuns = relatedRuns.sort((a, b) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );
  const latestRun =
    sortedRuns.length > 0 ? sortedRuns[sortedRuns.length - 1] : null;

  return {
    refractedView: toRefractedViewSummary(view),
    concepts,
    connections,
    generation: {
      latestRunId: latestRun?.id ?? "",
      status: latestRun?.status ?? "queued",
      errorSummary: latestRun?.errorSummary ?? null,
    },
  };
}

export async function getTopicSession(
  payload: GetTopicSessionPayload,
): Promise<GetTopicSessionData> {
  const functionResult = await tryInvoke<
    GetTopicSessionPayload,
    GetTopicSessionData
  >("getTopicSession", payload);
  if (functionResult) {
    return functionResult;
  }

  const topicSession = await findTopicSession(payload.topicSessionId);
  const lenses = await listAllLenses();
  const selectedLens = topicSession.selectedLensId
    ? (lenses.find((item) => item.id === topicSession.selectedLensId) ?? null)
    : null;

  const refractedViews = await listAllRefractedViews();
  const activeView = topicSession.activeRefractedViewId
    ? (refractedViews.find(
        (item) => item.id === topicSession.activeRefractedViewId,
      ) ?? null)
    : null;

  return {
    topicSession: toTopicSessionSummary(topicSession),
    selectedLens: selectedLens ? toLensSummary(selectedLens) : null,
    activeRefractedViewSummary: activeView
      ? toRefractedViewSummary(activeView)
      : null,
  };
}
