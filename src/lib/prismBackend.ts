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

type StoredLensSnapshot = Omit<LensSummary, "accentColor">;

interface TopicSessionRecord extends TopicSessionSummary {
  generatedLenses?: StoredLensSnapshot[];
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
  delete: (id: string) => Promise<unknown>;
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

type ActionName =
  | "createTopicSession"
  | "listLenses"
  | "selectLens"
  | "generateLensView"
  | "regenerateLensView"
  | "getGenerationStatus"
  | "getLensExplorationView"
  | "getTopicSession";

const base44Runtime = base44 as unknown as Base44ClientRuntime;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTopic(topicText: string): string {
  return topicText.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugToken(value: string): string {
  return normalizeTopic(value)
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 32);
}

function toDynamicLens(
  topicSlug: string,
  name: string,
  description: string,
  displayOrder: number,
): LensSummary {
  return {
    id: `lens_${topicSlug}_${displayOrder}`,
    key: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, ""),
    name,
    description,
    displayOrder,
    accentColor: null,
    isActive: true,
  };
}

interface GeneratedLensCandidate {
  name: string;
  description?: string;
}

function normalizeGeneratedLensCandidates(
  value: unknown,
): GeneratedLensCandidate[] {
  const envelope = value as
    | { ok: true; data?: unknown }
    | { ok: false }
    | { data?: unknown }
    | { lenses?: unknown }
    | { data: { lenses?: unknown } }
    | unknown[];

  const maybeData =
    typeof envelope === "object" && envelope !== null && "data" in envelope
      ? (envelope as { data: unknown }).data
      : envelope;

  const maybeLenses = (() => {
    if (Array.isArray(maybeData)) {
      return maybeData;
    }
    if (
      typeof maybeData === "object" &&
      maybeData !== null &&
      "lenses" in maybeData
    ) {
      return (maybeData as { lenses?: unknown }).lenses;
    }
    return null;
  })();

  if (!Array.isArray(maybeLenses)) {
    return [];
  }

  const mapped = maybeLenses
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed.length > 0
          ? { name: trimmed, description: "AI-generated perspective lens." }
          : null;
      }

      if (typeof item !== "object" || item === null) {
        return null;
      }

      const name =
        typeof (item as { name?: unknown }).name === "string"
          ? (item as { name: string }).name.trim()
          : "";
      const description =
        typeof (item as { description?: unknown }).description === "string"
          ? (item as { description: string }).description.trim()
          : "";

      if (name.length === 0) {
        return null;
      }

      return {
        name,
        description:
          description.length > 0
            ? description
            : "AI-generated perspective lens.",
      };
    })
    .filter((item) => item !== null)
    .slice(0, 6);

  return mapped as GeneratedLensCandidate[];
}

function toDynamicLensSetFromCandidates(
  topicSlug: string,
  candidates: GeneratedLensCandidate[],
): LensSummary[] {
  return candidates
    .slice(0, 6)
    .map((candidate, index) =>
      toDynamicLens(
        topicSlug,
        candidate.name,
        candidate.description ?? "AI-generated perspective lens.",
        index + 1,
      ),
    );
}

function toStoredLensSnapshot(lenses: LensSummary[]): StoredLensSnapshot[] {
  return lenses.map(({ accentColor: _accentColor, ...lens }) => lens);
}

function fromStoredLensSnapshot(
  lenses: StoredLensSnapshot[],
): LensSummary[] {
  return lenses.map((lens) => ({ ...lens, accentColor: null }));
}

async function tryGenerateTopicLensesWithAi(
  topicText: string,
): Promise<LensSummary[] | null> {
  const topicSlug = slugToken(topicText) || "topic";
  const payload = { topicText, count: 5 };

  const attempts: Array<{
    name: string;
    payloadData: Record<string, unknown>;
  }> = [
    {
      name: "generateTopicLenses",
      payloadData: payload,
    },
  ];

  for (const attempt of attempts) {
    try {
      const result = await base44Runtime.functions.invoke(
        attempt.name,
        attempt.payloadData,
      );
      console.log("generateTopicLenses raw result:", result);
      const candidates = normalizeGeneratedLensCandidates(result);
      if (candidates.length >= 4) {
        return toDynamicLensSetFromCandidates(topicSlug, candidates);
      }
    } catch (error) {
      console.error("Lens generation failed:", attempt.name, error);
      // Try next AI endpoint style, then fall back to deterministic synthesis.
    }
  }

  return null;
}

interface GeneratedExploration {
  title: string;
  summary: string;
  concepts: Array<{
    title: string;
    body: string;
    confidenceScore: number;
  }>;
  connections: Array<{
    sourceOrdinal: number;
    relationVerb: string;
    targetOrdinal: number;
    rationale: string;
    weight: number;
  }>;
}

function normalizeGeneratedExploration(value: unknown): GeneratedExploration | null {
  const payload =
    typeof value === "object" && value !== null && "data" in value
      ? (value as { data: unknown }).data
      : value;
  if (typeof payload !== "object" || payload === null) return null;

  const result = payload as Partial<GeneratedExploration>;
  if (
    typeof result.title !== "string" ||
    !result.title.trim() ||
    typeof result.summary !== "string" ||
    !result.summary.trim() ||
    !Array.isArray(result.concepts) ||
    result.concepts.length < 4 ||
    result.concepts.length > 5 ||
    !Array.isArray(result.connections)
  ) {
    return null;
  }

  const concepts = result.concepts.filter(
    (concept): concept is GeneratedExploration["concepts"][number] =>
      typeof concept === "object" &&
      concept !== null &&
      typeof concept.title === "string" &&
      concept.title.trim().length > 0 &&
      typeof concept.body === "string" &&
      concept.body.trim().length > 0 &&
      typeof concept.confidenceScore === "number" &&
      concept.confidenceScore >= 0 &&
      concept.confidenceScore <= 1,
  );
  const connections = result.connections.filter(
    (connection): connection is GeneratedExploration["connections"][number] =>
      typeof connection === "object" &&
      connection !== null &&
      Number.isInteger(connection.sourceOrdinal) &&
      Number.isInteger(connection.targetOrdinal) &&
      typeof connection.relationVerb === "string" &&
      connection.relationVerb.trim().length > 0 &&
      typeof connection.rationale === "string" &&
      connection.rationale.trim().length > 0 &&
      typeof connection.weight === "number" &&
      connection.weight >= 0 &&
      connection.weight <= 1,
  );

  if (concepts.length !== result.concepts.length || connections.length < 3) {
    return null;
  }
  return { title: result.title, summary: result.summary, concepts, connections };
}

async function generateLensExplorationWithAi(
  topicText: string,
  lens: LensSummary,
): Promise<GeneratedExploration> {
  const result = await base44Runtime.functions.invoke("generateLensExploration", {
    topicText,
    lens: { name: lens.name, description: lens.description },
  });
  const exploration = normalizeGeneratedExploration(result);
  if (!exploration) {
    throw new Error("Lens exploration function returned an invalid response");
  }
  return exploration;
}

function titleCaseTopic(topicText: string): string {
  const cleaned = topicText.trim();
  if (!cleaned) {
    return "Topic";
  }

  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function contextualFallbackLenses(
  topicSlug: string,
  topicText: string,
): LensSummary[] {
  const normalized = normalizeTopic(topicText);
  const topicTitle = titleCaseTopic(topicText);

  if (
    normalized.includes("yoga") ||
    normalized.includes("meditation") ||
    normalized.includes("mindfulness")
  ) {
    return [
      toDynamicLens(
        topicSlug,
        "Movement instructor",
        "Instruction quality, progression pacing, and student adaptation.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Sports medicine specialist",
        "Mobility, injury prevention, and recovery constraints.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Meditation practitioner",
        "Breathwork integration, focus outcomes, and mental steadiness.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Studio owner",
        "Class operations, retention, and sustainable business delivery.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Yoga philosophy scholar",
        "Tradition alignment, ethics, and interpretation integrity.",
        5,
      ),
    ];
  }

  if (
    normalized.includes("crypto") ||
    normalized.includes("blockchain") ||
    normalized.includes("bitcoin") ||
    normalized.includes("ethereum")
  ) {
    return [
      toDynamicLens(
        topicSlug,
        "Blockchain developer",
        "Protocol design, scalability limits, and implementation risk.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Retail investor",
        "Volatility tolerance, usability, and portfolio decision pressure.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Monetary economist",
        "Market structure, liquidity behavior, and macro incentives.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Regulatory analyst",
        "Compliance constraints, policy direction, and legal uncertainty.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Cybersecurity researcher",
        "Threat models, custody risks, and exploit mitigation.",
        5,
      ),
    ];
  }

  if (
    normalized.includes("health") ||
    normalized.includes("fitness") ||
    normalized.includes("therapy")
  ) {
    return [
      toDynamicLens(
        topicSlug,
        `${topicTitle} coach`,
        "Daily practice design, motivation loops, and consistency barriers.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Clinical specialist",
        "Safety bounds, contraindications, and measurable outcomes.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Long-term practitioner",
        "Adherence, lifestyle fit, and practical trade-offs.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Program operator",
        "Service delivery, staffing, and quality control at scale.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Outcomes researcher",
        "Evidence strength, confounders, and evaluation design.",
        5,
      ),
    ];
  }

  if (
    normalized.includes("finance") ||
    normalized.includes("econom") ||
    normalized.includes("market")
  ) {
    return [
      toDynamicLens(
        topicSlug,
        `${topicTitle} product builder`,
        "System design choices, operational constraints, and reliability.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Retail participant",
        "Accessibility, trust, and risk-adjusted value.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Monetary economist",
        "Incentive alignment, externalities, and systemic effects.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Regulatory reviewer",
        "Consumer protection requirements and compliance burden.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Fraud and security analyst",
        "Attack paths, controls, and incident response readiness.",
        5,
      ),
    ];
  }

  if (
    normalized.includes("ai") ||
    normalized.includes("software") ||
    normalized.includes("data") ||
    normalized.includes("app")
  ) {
    return [
      toDynamicLens(
        topicSlug,
        `${topicTitle} engineer`,
        "Architecture decisions, failure handling, and maintainability trade-offs.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Product manager",
        "User value clarity, roadmap sequencing, and delivery scope.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Everyday end user",
        "Adoption friction, usability, and trust signals.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Safety and ethics reviewer",
        "Misuse risk, fairness, and governance controls.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Platform operator",
        "Cost, latency, observability, and uptime accountability.",
        5,
      ),
    ];
  }

  // Placeholder abstraction: deterministic now, swappable with model-based role generation later.
  return [
    toDynamicLens(
      topicSlug,
      `${topicTitle} practitioner`,
      "Hands-on workflows, constraints, and practical decisions.",
      1,
    ),
    toDynamicLens(
      topicSlug,
      `${topicTitle} researcher`,
      "Evidence quality, uncertainty, and open questions.",
      2,
    ),
    toDynamicLens(
      topicSlug,
      "Business operator",
      "Economic viability, resource planning, and execution risks.",
      3,
    ),
    toDynamicLens(
      topicSlug,
      "Policy and governance analyst",
      "Regulatory context, accountability, and societal impact.",
      4,
    ),
    toDynamicLens(
      topicSlug,
      "Community advocate",
      "Accessibility, inclusion, and long-term public outcomes.",
      5,
    ),
  ];
}

function generateTopicLensesDeterministic(topicText: string): LensSummary[] {
  const topicSlug = slugToken(topicText) || "topic";
  const normalized = normalizeTopic(topicText);

  if (normalized.includes("dog") || normalized.includes("puppy")) {
    return [
      toDynamicLens(
        topicSlug,
        "First-time dog owner",
        "Daily routines, behavior basics, and what is manageable at home.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Professional trainer",
        "Training progression, reinforcement design, and skill transfer.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Veterinary behavior specialist",
        "Medical and behavioral contributors to difficult patterns.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Animal welfare advocate",
        "Stress minimization, humane methods, and wellbeing outcomes.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Working dog handler",
        "Reliability under distraction, consistency, and task performance.",
        5,
      ),
    ];
  }

  if (normalized.includes("coffee")) {
    return [
      toDynamicLens(
        topicSlug,
        "Coffee drinker",
        "Taste, convenience, cost, and day-to-day ritual value.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Specialty roaster",
        "Bean quality, roast profile control, and consistency standards.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Coffee farmer",
        "Yield stability, pricing pressure, and climate exposure.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Sustainability researcher",
        "Environmental impact, traceability, and long-term resilience.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Cafe owner",
        "Margins, customer retention, and operational throughput.",
        5,
      ),
    ];
  }

  return contextualFallbackLenses(topicSlug, topicText);
}

async function generateTopicLenses(topicText: string): Promise<LensSummary[]> {
  const aiLenses = await tryGenerateTopicLensesWithAi(topicText);
  if (aiLenses && aiLenses.length >= 4) {
    return aiLenses;
  }

  return generateTopicLensesDeterministic(topicText);
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

function isReadAction(actionName: ActionName): boolean {
  return (
    actionName === "listLenses" ||
    actionName === "getTopicSession" ||
    actionName === "getLensExplorationView" ||
    actionName === "getGenerationStatus"
  );
}

function unwrapActionResult<TData>(result: unknown): TData {
  const maybeEnvelope = result as
    | { ok: true; data: TData }
    | { ok: false; error?: { message?: string } }
    | TData;

  if (
    typeof maybeEnvelope === "object" &&
    maybeEnvelope !== null &&
    "ok" in maybeEnvelope
  ) {
    if (maybeEnvelope.ok) {
      return maybeEnvelope.data;
    }

    const message = maybeEnvelope.error?.message ?? "Base44 action failed";
    throw new Error(message);
  }

  return maybeEnvelope as TData;
}

function getEntity(name: string) {
  const entity = base44Runtime.entities[name];
  if (!entity) {
    throw new Error(`Base44 entity not found: ${name}`);
  }
  return entity;
}

async function tryInvoke<TPayload, TData>(
  functionName: ActionName,
  payload: TPayload,
): Promise<TData | null> {
  const agentName = isReadAction(functionName)
    ? "prism_reader"
    : "prism_orchestrator";

  const invocationAttempts: Array<{
    name: string;
    payloadData: Record<string, unknown>;
  }> = [
    {
      name: functionName,
      payloadData: payload as unknown as Record<string, unknown>,
    },
    {
      name: agentName,
      payloadData: {
        action: functionName,
        payload: payload as unknown as Record<string, unknown>,
      },
    },
  ];

  for (const attempt of invocationAttempts) {
    try {
      const result = await base44Runtime.functions.invoke(
        attempt.name,
        attempt.payloadData,
      );
      return unwrapActionResult<TData>(result);
    } catch {
      // Try the next invocation style before falling back to entity workflow.
    }
  }

  return null;
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

async function getTopicLenses(topicSessionId: string): Promise<LensSummary[]> {
  const session = await findTopicSession(topicSessionId);
  if (session.generatedLenses && session.generatedLenses.length > 0) {
    return fromStoredLensSnapshot(session.generatedLenses);
  }

  // Backfill sessions created before generated lenses were stored as a snapshot.
  const generatedLenses = await generateTopicLenses(session.topicText);
  await getEntity("TopicSession").update(session.id, {
    generatedLenses: toStoredLensSnapshot(generatedLenses),
    updatedAt: nowIso(),
  });
  return generatedLenses;
}

async function findLensForTopicSession(
  topicSessionId: string,
  lensId: string,
): Promise<LensSummary> {
  const topicLenses = await getTopicLenses(topicSessionId);
  const topicLens = topicLenses.find((item) => item.id === lensId);
  if (topicLens) {
    return topicLens;
  }

  try {
    return toLensSummary(await findLens(lensId));
  } catch {
    throw new Error("Lens not found");
  }
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

  const topic = await findTopicSession(view.topicSessionId);
  const lens = await findLensForTopicSession(view.topicSessionId, view.lensId);
  const conceptEntity = getEntity("Concept");
  const connectionEntity = getEntity("ConceptConnection");

  try {
    await getEntity("GenerationRun").update(run.id, {
      status: "running",
      updatedAt: nowIso(),
    });
    const generated = await generateLensExplorationWithAi(topic.topicText, lens);

    // Regeneration reuses the view, so remove its old graph before saving the new one.
    const oldConnections = await listConnectionsForView(view.id);
    const oldConcepts = await listConceptsForView(view.id);
    await Promise.all(oldConnections.map((connection) => connectionEntity.delete(connection.id)));
    await Promise.all(oldConcepts.map((concept) => conceptEntity.delete(concept.id)));

    const createdConcepts: ConceptSummary[] = [];
    for (const [index, concept] of generated.concepts.entries()) {
      const created = (await conceptEntity.create({
        refractedViewId: view.id,
        ordinal: index + 1,
        title: concept.title,
        body: concept.body,
        confidenceScore: concept.confidenceScore,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })) as unknown as ConceptSummary;
      createdConcepts.push(created);
    }

    for (const connection of generated.connections) {
      const source = createdConcepts[connection.sourceOrdinal - 1];
      const target = createdConcepts[connection.targetOrdinal - 1];
      if (!source || !target || source.id === target.id) continue;
      await connectionEntity.create({
        refractedViewId: view.id,
        sourceConceptId: source.id,
        relationVerb: connection.relationVerb,
        targetConceptId: target.id,
        rationale: connection.rationale,
        weight: connection.weight,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    await getEntity("RefractedView").update(view.id, {
      title: generated.title,
      summary: generated.summary,
      status: "ready",
      retrievalSummary: "AI-generated exploration through the selected lens.",
      errorMessage: null,
      generatedAt: nowIso(),
      updatedAt: nowIso(),
    });
    await getEntity("TopicSession").update(topic.id, {
      status: "ready",
      activeRefractedViewId: view.id,
      updatedAt: nowIso(),
    });

    return (await getEntity("GenerationRun").update(run.id, {
      status: "succeeded",
      finishedAt: nowIso(),
      modelName: "Base44 Core InvokeLLM",
      updatedAt: nowIso(),
    })) as unknown as GenerationRunRecord;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lens exploration generation failed";
    await getEntity("RefractedView").update(view.id, {
      status: "failed",
      errorMessage: message,
      updatedAt: nowIso(),
    });
    await getEntity("TopicSession").update(topic.id, {
      status: "failed",
      updatedAt: nowIso(),
    });
    return (await getEntity("GenerationRun").update(run.id, {
      status: "failed",
      finishedAt: nowIso(),
      errorCode: "LENS_EXPLORATION_FAILED",
      errorSummary: message,
      updatedAt: nowIso(),
    })) as unknown as GenerationRunRecord;
  }
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

  const generatedLenses = await generateTopicLenses(payload.topicText);
  const created = (await getEntity("TopicSession").create({
    topicText: payload.topicText,
    normalizedTopic: normalizeTopic(payload.topicText),
    status: "created",
    selectedLensId: null,
    activeRefractedViewId: null,
    generatedLenses: toStoredLensSnapshot(generatedLenses),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })) as unknown as TopicSessionRecord;

  const recommendedLensIds = generatedLenses
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

  if (payload.topicSessionId) {
    const lenses = (await getTopicLenses(payload.topicSessionId))
      .filter((item) => payload.includeInactive || item.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    return { lenses };
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

  await findLensForTopicSession(payload.topicSessionId, payload.lensId);

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

  await findLensForTopicSession(payload.topicSessionId, payload.lensId);

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
  const topicLenses = await getTopicLenses(payload.topicSessionId);
  const selectedLens = topicSession.selectedLensId
    ? (topicLenses.find((item) => item.id === topicSession.selectedLensId) ??
      null)
    : null;

  const refractedViews = await listAllRefractedViews();
  const activeView = topicSession.activeRefractedViewId
    ? (refractedViews.find(
        (item) => item.id === topicSession.activeRefractedViewId,
      ) ?? null)
    : null;

  return {
    topicSession: toTopicSessionSummary(topicSession),
    selectedLens,
    activeRefractedViewSummary: activeView
      ? toRefractedViewSummary(activeView)
      : null,
  };
}
