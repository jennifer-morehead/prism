import { base44 } from "./base44Client";
import { isDemoTopic } from "./demoTopics";
import {
  ConceptConnectionSummary,
  ConceptSummary,
  CreateTopicSessionData,
  CreateTopicSessionPayload,
  GenerateLensViewData,
  GenerateLensViewPayload,
  GenerateFollowOnLensesData,
  GenerateFollowOnLensesPayload,
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
const MAX_TOPIC_LENSES = 4;
const cacheOnlyMode = import.meta.env.VITE_PRISM_CACHE_ONLY === "true";

type StoredLensSnapshot = Omit<LensSummary, "accentColor">;

interface TopicSessionRecord extends TopicSessionSummary {
  generatedLenses?: StoredLensSnapshot[];
  createdAt?: string;
  updatedAt?: string;
}

interface TopicLensCacheRecord {
  id: string;
  normalizedTopic: string;
  lenses: StoredLensSnapshot[];
  status: "succeeded";
  source: "ai";
  generatedAt: string;
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

interface TopicLensGeneration {
  lenses: LensSummary[];
  source: "ai" | "deterministic";
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
    .slice(0, MAX_TOPIC_LENSES);

  return mapped as GeneratedLensCandidate[];
}

function toDynamicLensSetFromCandidates(
  topicSlug: string,
  candidates: GeneratedLensCandidate[],
  startDisplayOrder = 1,
): LensSummary[] {
  return candidates
    .slice(0, MAX_TOPIC_LENSES)
    .map((candidate, index) =>
      toDynamicLens(
        topicSlug,
        candidate.name,
        candidate.description ?? "AI-generated perspective lens.",
        startDisplayOrder + index,
      ),
    );
}

function toStoredLensSnapshot(lenses: LensSummary[]): StoredLensSnapshot[] {
  return lenses
    .slice(0, MAX_TOPIC_LENSES)
    .map(({ accentColor: _accentColor, ...lens }) => lens);
}

function fromStoredLensSnapshot(
  lenses: StoredLensSnapshot[],
): LensSummary[] {
  return lenses
    .slice(0, MAX_TOPIC_LENSES)
    .map((lens) => ({ ...lens, accentColor: null }));
}

async function tryGenerateTopicLensesWithAi(
  topicText: string,
): Promise<LensSummary[] | null> {
  const topicSlug = slugToken(topicText) || "topic";
  const payload = { topicText, count: MAX_TOPIC_LENSES };

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
    searchQuery: string;
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

interface LensExplorationCacheRecord extends GeneratedExploration {
  id: string;
  normalizedTopic: string;
  lensKey: string;
  status: "succeeded";
  source: "ai";
  generatedAt: string;
  createdAt?: string;
  updatedAt?: string;
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

  const concepts = result.concepts.flatMap((concept) => {
    if (
      typeof concept !== "object" ||
      concept === null ||
      typeof concept.title !== "string" ||
      !concept.title.trim() ||
      typeof concept.body !== "string" ||
      !concept.body.trim() ||
      typeof concept.confidenceScore !== "number" ||
      concept.confidenceScore < 0 ||
      concept.confidenceScore > 1
    ) {
      return [];
    }

    const searchQuery =
      typeof concept.searchQuery === "string" && concept.searchQuery.trim()
        ? concept.searchQuery.trim()
        : `${concept.title} ${concept.body}`.split(/\s+/).slice(0, 12).join(" ");
    return [{ ...concept, searchQuery }];
  });
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

function contextualFallbackLenses(
  topicSlug: string,
  topicText: string,
): LensSummary[] {
  const normalized = normalizeTopic(topicText);

  if (
    normalized.includes("yoga") ||
    normalized.includes("meditation") ||
    normalized.includes("mindfulness")
  ) {
    return [
      toDynamicLens(
        topicSlug,
        "Movement and Alignment",
        "Instruction quality, progression pacing, and student adaptation.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Physical Safety",
        "Mobility, injury prevention, and recovery constraints.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Breath and Attention",
        "Breathwork integration, focus outcomes, and mental steadiness.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Practice Access",
        "Class operations, retention, and sustainable business delivery.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Tradition and Meaning",
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
        "Protocol Design",
        "Protocol design, scalability limits, and implementation risk.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Everyday Use",
        "Volatility tolerance, usability, and portfolio decision pressure.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Market Dynamics",
        "Market structure, liquidity behavior, and macro incentives.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Rules and Accountability",
        "Compliance constraints, policy direction, and legal uncertainty.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Security and Custody",
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
        "Daily Habits",
        "Daily practice design, motivation loops, and consistency barriers.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Safety and Outcomes",
        "Safety bounds, contraindications, and measurable outcomes.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Long-Term Fit",
        "Adherence, lifestyle fit, and practical trade-offs.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Care Delivery",
        "Service delivery, staffing, and quality control at scale.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Evidence and Uncertainty",
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
        "Product Mechanics",
        "System design choices, operational constraints, and reliability.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Household Risk",
        "Accessibility, trust, and risk-adjusted value.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Market Incentives",
        "Incentive alignment, externalities, and systemic effects.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Consumer Protection",
        "Consumer protection requirements and compliance burden.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Fraud and Resilience",
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
        "System Design",
        "Architecture decisions, failure handling, and maintainability trade-offs.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "User Experience",
        "User value clarity, roadmap sequencing, and delivery scope.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Everyday Use",
        "Adoption friction, usability, and trust signals.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Trust and Safety",
        "Misuse risk, fairness, and governance controls.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Operating at Scale",
        "Cost, latency, observability, and uptime accountability.",
        5,
      ),
    ];
  }

  // Deterministic fallback for local or unavailable AI generation.
  return [
    toDynamicLens(
      topicSlug,
      "Practical Dimensions",
      "Hands-on workflows, constraints, and practical decisions.",
      1,
    ),
    toDynamicLens(
      topicSlug,
      "Evidence and Unknowns",
      "Evidence quality, uncertainty, and open questions.",
      2,
    ),
    toDynamicLens(
      topicSlug,
      "Resources and Trade-Offs",
      "Economic viability, resource planning, and execution risks.",
      3,
    ),
    toDynamicLens(
      topicSlug,
      "Rules and Consequences",
      "Regulatory context, accountability, and societal impact.",
      4,
    ),
    toDynamicLens(
      topicSlug,
      "Access and Inclusion",
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
        "Home Routines",
        "Daily routines, behavior basics, and what is manageable at home.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Learning and Reinforcement",
        "Training progression, reinforcement design, and skill transfer.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Health and Behavior",
        "Medical and behavioral contributors to difficult patterns.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Animal Wellbeing",
        "Stress minimization, humane methods, and wellbeing outcomes.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Distraction and Reliability",
        "Reliability under distraction, consistency, and task performance.",
        5,
      ),
    ];
  }

  if (normalized.includes("coffee")) {
    return [
      toDynamicLens(
        topicSlug,
        "Everyday Ritual",
        "Taste, convenience, cost, and day-to-day ritual value.",
        1,
      ),
      toDynamicLens(
        topicSlug,
        "Flavor and Quality",
        "Bean quality, roast profile control, and consistency standards.",
        2,
      ),
      toDynamicLens(
        topicSlug,
        "Growing Conditions",
        "Yield stability, pricing pressure, and climate exposure.",
        3,
      ),
      toDynamicLens(
        topicSlug,
        "Environmental Footprint",
        "Environmental impact, traceability, and long-term resilience.",
        4,
      ),
      toDynamicLens(
        topicSlug,
        "Cafe Economics",
        "Margins, customer retention, and operational throughput.",
        5,
      ),
    ];
  }

  return contextualFallbackLenses(topicSlug, topicText);
}

async function generateTopicLenses(
  topicText: string,
): Promise<TopicLensGeneration> {
  const aiLenses = await tryGenerateTopicLensesWithAi(topicText);
  if (aiLenses && aiLenses.length >= 4) {
    return {
      lenses: aiLenses.slice(0, MAX_TOPIC_LENSES),
      source: "ai",
    };
  }

  return {
    lenses: generateTopicLensesDeterministic(topicText).slice(
      0,
      MAX_TOPIC_LENSES,
    ),
    source: "deterministic",
  };
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

async function findInitialLensCache(
  normalizedTopic: string,
): Promise<LensSummary[] | null> {
  const caches = (await getEntity("TopicLensCache").list()) as unknown as TopicLensCacheRecord[];
  const cache = caches
    .filter(
      (item) =>
        item.normalizedTopic === normalizedTopic &&
        item.status === "succeeded" &&
        item.source === "ai" &&
        item.lenses.length >= MAX_TOPIC_LENSES,
    )
    .sort((a, b) => (b.updatedAt ?? b.generatedAt).localeCompare(a.updatedAt ?? a.generatedAt))[0];

  return cache ? fromStoredLensSnapshot(cache.lenses) : null;
}

async function saveInitialLensCache(
  normalizedTopic: string,
  lenses: LensSummary[],
): Promise<void> {
  const entity = getEntity("TopicLensCache");
  const caches = (await entity.list()) as unknown as TopicLensCacheRecord[];
  const existing = caches
    .filter((item) => item.normalizedTopic === normalizedTopic)
    .sort((a, b) => (b.updatedAt ?? b.generatedAt).localeCompare(a.updatedAt ?? a.generatedAt))[0];
  const timestamp = nowIso();
  const record = {
    normalizedTopic,
    lenses: toStoredLensSnapshot(lenses),
    status: "succeeded",
    source: "ai",
    generatedAt: timestamp,
    updatedAt: timestamp,
  };

  if (existing) {
    await entity.update(existing.id, record);
    return;
  }

  await entity.create({ ...record, createdAt: timestamp });
}

async function findLensExplorationCache(
  normalizedTopic: string,
  lensKey: string,
): Promise<GeneratedExploration | null> {
  const records = (await getEntity(
    "LensExplorationCache",
  ).list()) as unknown as LensExplorationCacheRecord[];
  const cache = records
    .filter(
      (item) =>
        item.normalizedTopic === normalizedTopic &&
        item.lensKey === lensKey &&
        item.status === "succeeded" &&
        item.source === "ai",
    )
    .sort((a, b) =>
      (b.updatedAt ?? b.generatedAt).localeCompare(
        a.updatedAt ?? a.generatedAt,
      ),
    )[0];

  return cache ? normalizeGeneratedExploration(cache) : null;
}

async function saveLensExplorationCache(
  normalizedTopic: string,
  lensKey: string,
  exploration: GeneratedExploration,
): Promise<void> {
  const entity = getEntity("LensExplorationCache");
  const records = (await entity.list()) as unknown as LensExplorationCacheRecord[];
  const existing = records
    .filter(
      (item) =>
        item.normalizedTopic === normalizedTopic && item.lensKey === lensKey,
    )
    .sort((a, b) =>
      (b.updatedAt ?? b.generatedAt).localeCompare(
        a.updatedAt ?? a.generatedAt,
      ),
    )[0];
  const timestamp = nowIso();
  const record = {
    normalizedTopic,
    lensKey,
    title: exploration.title,
    summary: exploration.summary,
    concepts: exploration.concepts,
    connections: exploration.connections,
    status: "succeeded",
    source: "ai",
    generatedAt: timestamp,
    updatedAt: timestamp,
  };

  if (existing) {
    await entity.update(existing.id, record);
    return;
  }

  await entity.create({ ...record, createdAt: timestamp });
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

async function persistExploration(
  topicSessionId: string,
  view: RefractedViewRecord,
  exploration: GeneratedExploration,
): Promise<void> {
  const conceptEntity = getEntity("Concept");
  const connectionEntity = getEntity("ConceptConnection");
  const oldConnections = await listConnectionsForView(view.id);
  const oldConcepts = await listConceptsForView(view.id);
  await Promise.all(
    oldConnections.map((connection) => connectionEntity.delete(connection.id)),
  );
  await Promise.all(oldConcepts.map((concept) => conceptEntity.delete(concept.id)));

  const createdConcepts: ConceptSummary[] = [];
  for (const [index, concept] of exploration.concepts.entries()) {
    const created = (await conceptEntity.create({
      refractedViewId: view.id,
      ordinal: index + 1,
      title: concept.title,
      body: concept.body,
      searchQuery: concept.searchQuery,
      confidenceScore: concept.confidenceScore,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })) as unknown as ConceptSummary;
    createdConcepts.push(created);
  }

  for (const connection of exploration.connections) {
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
    title: exploration.title,
    summary: exploration.summary,
    status: "ready",
    retrievalSummary: "AI-generated exploration through the selected lens.",
    errorMessage: null,
    generatedAt: nowIso(),
    updatedAt: nowIso(),
  });
  await getEntity("TopicSession").update(topicSessionId, {
    status: "ready",
    activeRefractedViewId: view.id,
    updatedAt: nowIso(),
  });
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

async function getTopicLenses(topicSessionId: string): Promise<LensSummary[]> {
  const session = await findTopicSession(topicSessionId);
  if (session.generatedLenses && session.generatedLenses.length > 0) {
    const lenses = fromStoredLensSnapshot(session.generatedLenses);
    if (session.generatedLenses.length > MAX_TOPIC_LENSES) {
      await getEntity("TopicSession").update(session.id, {
        generatedLenses: toStoredLensSnapshot(lenses),
        updatedAt: nowIso(),
      });
    }
    return lenses;
  }

  // Backfill sessions created before generated lenses were stored as a snapshot.
  const generation = await generateTopicLenses(session.topicText);
  if (generation.source === "ai") {
    await saveInitialLensCache(normalizeTopic(session.topicText), generation.lenses);
  }
  await getEntity("TopicSession").update(session.id, {
    generatedLenses: toStoredLensSnapshot(generation.lenses),
    updatedAt: nowIso(),
  });
  return generation.lenses;
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

  throw new Error("Lens not found in this topic session");
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

  try {
    await getEntity("GenerationRun").update(run.id, {
      status: "running",
      updatedAt: nowIso(),
    });
    const generated = await generateLensExplorationWithAi(topic.topicText, lens);
    await persistExploration(topic.id, view, generated);
    await saveLensExplorationCache(
      normalizeTopic(topic.topicText),
      lens.key,
      generated,
    );

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
  if (payload.topicText.trim().length > 120) {
    throw new Error("topicText must be 120 characters or fewer");
  }
  if (!isDemoTopic(payload.topicText)) {
    throw new Error("Choose one of the featured Prism topics.");
  }

  const functionResult = await tryInvoke<
    CreateTopicSessionPayload,
    CreateTopicSessionData
  >("createTopicSession", payload);
  if (functionResult) {
    return functionResult;
  }

  const normalizedTopic = normalizeTopic(payload.topicText);
  const cachedLenses = payload.forceRefresh
    ? null
    : await findInitialLensCache(normalizedTopic);
  if (!cachedLenses && cacheOnlyMode) {
    throw new Error("This topic is not prepared for the public Prism demo.");
  }
  const generation = cachedLenses
    ? null
    : await generateTopicLenses(payload.topicText);
  const generatedLenses = (cachedLenses ?? generation?.lenses ?? []).slice(
    0,
    MAX_TOPIC_LENSES,
  );
  if (generation?.source === "ai") {
    await saveInitialLensCache(normalizedTopic, generatedLenses);
  }
  const created = (await getEntity("TopicSession").create({
    topicText: payload.topicText,
    normalizedTopic,
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
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, MAX_TOPIC_LENSES);
    return { lenses };
  }

  return { lenses: [] };
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

  const lens = await findLensForTopicSession(
    payload.topicSessionId,
    payload.lensId,
  );

  const topicSession = await findTopicSession(payload.topicSessionId);
  const view = await findOrCreateRefractedView(
    payload.topicSessionId,
    payload.lensId,
  );

  const cachedExploration = payload.forceRegenerate
    ? null
    : await findLensExplorationCache(
        normalizeTopic(topicSession.topicText),
        lens.key,
      );
  if (!cachedExploration && cacheOnlyMode) {
    throw new Error("This lens is not prepared for the public Prism demo.");
  }

  await getEntity("TopicSession").update(topicSession.id, {
    selectedLensId: payload.lensId,
    status: "generating",
    updatedAt: nowIso(),
  });

  if (cachedExploration) {
    const timestamp = nowIso();
    const run = (await getEntity("GenerationRun").create({
      topicSessionId: payload.topicSessionId,
      lensId: payload.lensId,
      mode: "generate",
      retrievalEnabled: payload.retrievalEnabled !== false,
      status: "succeeded",
      startedAt: timestamp,
      finishedAt: timestamp,
      errorCode: null,
      errorSummary: null,
      modelName: "Prism LensExplorationCache",
      createdAt: timestamp,
    })) as unknown as GenerationRunRecord;

    await getEntity("RefractedView").update(view.id, {
      status: "generating",
      generationRunId: run.id,
      retrievalEnabled: payload.retrievalEnabled !== false,
      updatedAt: timestamp,
    });
    await persistExploration(topicSession.id, view, cachedExploration);

    return {
      generationRunId: run.id,
      refractedViewId: view.id,
      status: "queued",
    };
  }

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

export async function generateFollowOnLenses(
  payload: GenerateFollowOnLensesPayload,
): Promise<GenerateFollowOnLensesData> {
  const topicSession = await findTopicSession(payload.topicSessionId);
  const sourceLens = await findLensForTopicSession(
    payload.topicSessionId,
    payload.lensId,
  );
  const views = await listAllRefractedViews();
  const view = views.find(
    (item) =>
      item.id === payload.refractedViewId &&
      item.topicSessionId === payload.topicSessionId &&
      item.lensId === payload.lensId,
  );
  if (!view || !view.summary) {
    throw new Error("A completed refraction is required to generate new lenses");
  }

  const concepts = await listConceptsForView(view.id);
  const result = await base44Runtime.functions.invoke("generateFollowOnLenses", {
    topicText: topicSession.topicText,
    lens: { name: sourceLens.name, description: sourceLens.description },
    refraction: {
      title: view.title,
      summary: view.summary,
      concepts: concepts.map((concept) => ({
        title: concept.title,
        body: concept.body,
      })),
    },
    count: 4,
  });
  const candidates = normalizeGeneratedLensCandidates(result);
  if (candidates.length < 4) {
    throw new Error("Follow-on lens function returned an invalid response");
  }

  const existingLenses = await getTopicLenses(topicSession.id);
  const nextDisplayOrder =
    Math.max(0, ...existingLenses.map((lens) => lens.displayOrder)) + 1;
  const followOnLenses = toDynamicLensSetFromCandidates(
    slugToken(topicSession.topicText) || "topic",
    candidates.slice(0, 4),
    nextDisplayOrder,
  );
  await getEntity("TopicSession").update(topicSession.id, {
    generatedLenses: toStoredLensSnapshot(followOnLenses),
    updatedAt: nowIso(),
  });

  return { lenses: followOnLenses };
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
