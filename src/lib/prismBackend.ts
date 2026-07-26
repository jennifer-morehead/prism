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
  generatedLenses?: LensSummary[];
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
    return session.generatedLenses;
  }

  // Backfill sessions created before generated lenses were stored as a snapshot.
  const generatedLenses = await generateTopicLenses(session.topicText);
  await getEntity("TopicSession").update(session.id, {
    generatedLenses,
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

interface TopicProfile {
  focus: string;
  tradeoff: string;
  action: string;
  rationale: string;
}

function topicProfile(topicText: string): TopicProfile {
  const normalizedTopic = normalizeTopic(topicText);

  if (normalizedTopic.includes("dog") || normalizedTopic.includes("puppy")) {
    return {
      focus:
        "consistency of routines, positive reinforcement timing, and handler confidence",
      tradeoff:
        "fast behavior correction against stress-free learning for the animal",
      action:
        "Pick one training behavior, track completion daily, and reinforce at the same time windows.",
      rationale:
        "Consistent reinforcement quality controls whether behavior improvements hold in real settings.",
    };
  }
  if (normalizedTopic.includes("cat") || normalizedTopic.includes("feline")) {
    return {
      focus:
        "feeding schedule adherence, ingredient quality, and digestive tolerance",
      tradeoff: "diet optimization against cost and owner compliance over time",
      action:
        "Run a two-week feeding log, compare tolerance signals, and adjust one ingredient variable at a time.",
      rationale:
        "Nutrition outcomes depend on stable intake patterns and careful changes to avoid confounding signals.",
    };
  }
  if (normalizedTopic.includes("pet")) {
    return {
      focus: "care quality consistency, owner trust, and behavioral outcomes",
      tradeoff: "quality of care against daily effort and budget constraints",
      action:
        "Define baseline care metrics, review weekly, and iterate only on the weakest metric.",
      rationale:
        "Stable care loops make it easier to attribute outcome changes to specific interventions.",
    };
  }
  if (
    normalizedTopic.includes("health") ||
    normalizedTopic.includes("care") ||
    normalizedTopic.includes("clinic")
  ) {
    return {
      focus: "safety, workflow reliability, and access outcomes",
      tradeoff:
        "clinical quality against throughput and implementation complexity",
      action:
        "Pilot in one clinical workflow and publish a weekly safety and latency dashboard.",
      rationale:
        "Workflow and safety constraints determine whether improvements are sustainable at scale.",
    };
  }
  if (
    normalizedTopic.includes("school") ||
    normalizedTopic.includes("education") ||
    normalizedTopic.includes("learning")
  ) {
    return {
      focus: "learning impact, teacher workload, and equitable access",
      tradeoff: "personalization depth against teacher operating burden",
      action:
        "Start with one class segment and compare outcomes across two instruction cycles.",
      rationale:
        "Teacher capacity and access constraints shape which interventions are usable in practice.",
    };
  }
  if (
    normalizedTopic.includes("finance") ||
    normalizedTopic.includes("bank") ||
    normalizedTopic.includes("money")
  ) {
    return {
      focus: "risk controls, user confidence, and operational cost",
      tradeoff: "fraud prevention strictness against user friction",
      action:
        "Deploy progressive controls by risk tier and monitor false-positive drift weekly.",
      rationale:
        "Trust and risk outcomes move together when controls match transaction context.",
    };
  }

  return {
    focus: "adoption friction, trust, and measurable value",
    tradeoff: "speed of rollout against depth of quality assurance",
    action:
      "Run a constrained pilot, score outcomes weekly, and expand only after measurable gains.",
    rationale:
      "Early execution quality determines whether adoption compounds or stalls.",
  };
}

function lensActionBias(lensName: string, lensKey: string): string {
  const key = lensKey.toLowerCase();
  const name = lensName.toLowerCase();

  if (key.includes("policy") || name.includes("policy")) {
    return "governance checks and compliance-first rollout";
  }
  if (
    key.includes("builder") ||
    key.includes("technical") ||
    name.includes("builder")
  ) {
    return "architecture constraints and iterative implementation";
  }
  if (
    key.includes("econom") ||
    key.includes("market") ||
    name.includes("econom")
  ) {
    return "incentives, pricing pressure, and viability";
  }
  if (key.includes("risk") || name.includes("risk")) {
    return "failure modes, monitoring, and fallback plans";
  }

  return "day-to-day usability and practical outcomes";
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
  const profile = topicProfile(topic.topicText);
  const bias = lensActionBias(lens.name, lens.key);

  const conceptEntity = getEntity("Concept");
  const connectionEntity = getEntity("ConceptConnection");

  const concepts = await listConceptsForView(view.id);
  const connections = await listConnectionsForView(view.id);

  if (!view.summary) {
    await getEntity("RefractedView").update(view.id, {
      title: `${lens.name} Refracted View`,
      summary: `${lens.name} view: ${topic.topicText} is shaped by ${profile.focus}, with emphasis on ${bias}.`,
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
      title: "Primary Drivers",
      body: `For ${topic.topicText}, the ${lens.name.toLowerCase()} lens highlights ${profile.focus}.`,
      confidenceScore: 0.78,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await conceptEntity.create({
      refractedViewId: view.id,
      ordinal: 2,
      title: "Trade-offs",
      body: `The main tension is ${profile.tradeoff}, while preserving ${bias}.`,
      confidenceScore: 0.75,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await conceptEntity.create({
      refractedViewId: view.id,
      ordinal: 3,
      title: "Near-Term Actions",
      body: profile.action,
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
      rationale: `${profile.rationale} This sets the boundary for ${bias}.`,
      weight: 0.76,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await connectionEntity.create({
      refractedViewId: view.id,
      sourceConceptId: concepts[1].id,
      relationVerb: "prioritizes",
      targetConceptId: concepts[2].id,
      rationale:
        "The chosen trade-off profile determines the first practical action to execute.",
      weight: 0.72,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await getEntity("RefractedView").update(view.id, {
      status: "ready",
      retrievalSummary:
        "Generated through Base44 SDK entity workflow with topic-aware Prism logic.",
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

  const generatedLenses = await generateTopicLenses(payload.topicText);
  const created = (await getEntity("TopicSession").create({
    topicText: payload.topicText,
    normalizedTopic: normalizeTopic(payload.topicText),
    status: "created",
    selectedLensId: null,
    activeRefractedViewId: null,
    generatedLenses,
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
