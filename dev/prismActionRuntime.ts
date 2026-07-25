import fs from "node:fs";
import path from "node:path";

type TopicSessionStatus =
  | "created"
  | "lens_selected"
  | "generating"
  | "ready"
  | "failed";
type RefractedViewStatus = "draft" | "generating" | "ready" | "failed";
type GenerationRunStatus =
  | "queued"
  | "running"
  | "partial"
  | "succeeded"
  | "failed";

type ProgressHint =
  | "queued"
  | "generating_summary"
  | "generating_concepts"
  | "generating_connections"
  | "finalizing"
  | "done"
  | "failed";

interface Lens {
  id: string;
  key: string;
  name: string;
  description: string;
  displayOrder: number;
  accentColor: string | null;
  isActive: boolean;
}

interface TopicSession {
  id: string;
  topicText: string;
  normalizedTopic: string;
  status: TopicSessionStatus;
  selectedLensId: string | null;
  activeRefractedViewId: string | null;
}

interface RefractedView {
  id: string;
  topicSessionId: string;
  lensId: string;
  title: string | null;
  summary: string | null;
  status: RefractedViewStatus;
  retrievalSummary: string | null;
  generatedAt: string | null;
  generationRunId: string | null;
}

interface Concept {
  id: string;
  refractedViewId: string;
  ordinal: number;
  title: string;
  body: string;
  confidenceScore: number | null;
}

interface ConceptConnection {
  id: string;
  refractedViewId: string;
  sourceConceptId: string;
  relationVerb: string;
  targetConceptId: string;
  rationale: string | null;
  weight: number | null;
}

interface GenerationRun {
  id: string;
  topicSessionId: string;
  lensId: string;
  mode: "generate" | "regenerate";
  retrievalEnabled: boolean;
  status: GenerationRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorSummary: string | null;
  progressHint: ProgressHint;
  step: number;
  refractedViewId: string;
}

interface ActionRequestEnvelope {
  action: string;
  payload: Record<string, unknown>;
  requestId?: string;
}

// Shared Prism action core used by the local dev bridge, tests, and the future Base44 transport.

interface StoreState {
  lenses: Lens[];
  topicSessions: Map<string, TopicSession>;
  refractedViews: Map<string, RefractedView>;
  concepts: Map<string, Concept[]>;
  connections: Map<string, ConceptConnection[]>;
  generationRuns: Map<string, GenerationRun>;
}

const store: StoreState = {
  lenses: loadLenses(),
  topicSessions: new Map<string, TopicSession>(),
  refractedViews: new Map<string, RefractedView>(),
  concepts: new Map<string, Concept[]>(),
  connections: new Map<string, ConceptConnection[]>(),
  generationRuns: new Map<string, GenerationRun>(),
};

let idCounter = 1;

export function resetPrismActionStore() {
  store.topicSessions.clear();
  store.refractedViews.clear();
  store.concepts.clear();
  store.connections.clear();
  store.generationRuns.clear();
  store.lenses = loadLenses();
  idCounter = 1;
}

function nextId(prefix: string): string {
  const value = `${prefix}_${idCounter.toString().padStart(6, "0")}`;
  idCounter += 1;
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTopic(topicText: string): string {
  return topicText.trim().toLowerCase().replace(/\s+/g, " ");
}

function loadLenses(): Lens[] {
  const seedPath = path.resolve(process.cwd(), "base44/seeds/lenses.json");

  try {
    const raw = fs.readFileSync(seedPath, "utf8");
    const parsed = JSON.parse(raw) as Lens[];
    return parsed.sort((a, b) => a.displayOrder - b.displayOrder);
  } catch {
    return [
      {
        id: "lens_fallback",
        key: "everyday_user",
        name: "Everyday User",
        description: "Practical impacts and user experience perspective.",
        displayOrder: 1,
        accentColor: "#f4b83f",
        isActive: true,
      },
    ];
  }
}

function ok<T>(requestId: string | undefined, data: T) {
  return {
    ok: true as const,
    data,
    meta: {
      requestId,
      serverTs: nowIso(),
    },
  };
}

function fail(
  requestId: string | undefined,
  code: string,
  message: string,
  retriable = false,
  details?: Record<string, unknown>,
) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      retriable,
      details,
    },
    meta: {
      requestId,
      serverTs: nowIso(),
    },
  };
}

function ensureTopicSession(topicSessionId: unknown): TopicSession {
  if (typeof topicSessionId !== "string") {
    throw new Error("topicSessionId must be a string");
  }

  const session = store.topicSessions.get(topicSessionId);
  if (!session) {
    throw new Error("Topic session not found");
  }

  return session;
}

function ensureLens(lensId: unknown): Lens {
  if (typeof lensId !== "string") {
    throw new Error("lensId must be a string");
  }

  const lens = store.lenses.find((item) => item.id === lensId);
  if (!lens) {
    throw new Error("Lens not found");
  }

  return lens;
}

function ensureRefractedView(
  topicSessionId: string,
  lensId: string,
): RefractedView {
  const existing = Array.from(store.refractedViews.values()).find(
    (item) => item.topicSessionId === topicSessionId && item.lensId === lensId,
  );

  if (existing) {
    return existing;
  }

  const view: RefractedView = {
    id: nextId("view"),
    topicSessionId,
    lensId,
    title: null,
    summary: null,
    status: "draft",
    retrievalSummary: null,
    generatedAt: null,
    generationRunId: null,
  };

  store.refractedViews.set(view.id, view);
  return view;
}

interface TopicProfile {
  focus: string;
  tradeoff: string;
  action: string;
  rationale: string;
}

function topicProfile(topic: TopicSession): TopicProfile {
  const normalizedTopic = topic.normalizedTopic;

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

function lensActionBias(lens: Lens): string {
  const key = lens.key.toLowerCase();

  if (key.includes("policy")) {
    return "governance checks and compliance-first rollout";
  }
  if (key.includes("builder") || key.includes("technical")) {
    return "architecture constraints and iterative implementation";
  }
  if (key.includes("econom") || key.includes("market")) {
    return "incentives, pricing pressure, and viability";
  }
  if (key.includes("risk")) {
    return "failure modes, monitoring, and fallback plans";
  }

  return "day-to-day usability and practical outcomes";
}

function conceptSet(
  topic: TopicSession,
  lens: Lens,
): Array<{ title: string; body: string }> {
  const profile = topicProfile(topic);
  const bias = lensActionBias(lens);

  return [
    {
      title: "Primary Drivers",
      body: `For ${topic.topicText}, the ${lens.name.toLowerCase()} lens highlights ${profile.focus}.`,
    },
    {
      title: "Trade-offs",
      body: `The main tension is ${profile.tradeoff}, while preserving ${bias}.`,
    },
    {
      title: "Near-Term Actions",
      body: profile.action,
    },
  ];
}

function stageGenerationArtifacts(
  run: GenerationRun,
  topic: TopicSession,
  lens: Lens,
  view: RefractedView,
) {
  if (run.step === 1) {
    const profile = topicProfile(topic);
    const bias = lensActionBias(lens);
    view.summary = `${lens.name} view: ${topic.topicText} is shaped by ${profile.focus}, with emphasis on ${bias}.`;
    view.title = `${lens.name} Refracted View`;
    view.status = "generating";
    run.status = "partial";
    run.progressHint = "generating_summary";
    return;
  }

  if (run.step === 2) {
    const dynamicConcepts = conceptSet(topic, lens);
    const concepts: Concept[] = [
      {
        id: nextId("concept"),
        refractedViewId: view.id,
        ordinal: 1,
        title: dynamicConcepts[0].title,
        body: dynamicConcepts[0].body,
        confidenceScore: 0.77,
      },
      {
        id: nextId("concept"),
        refractedViewId: view.id,
        ordinal: 2,
        title: dynamicConcepts[1].title,
        body: dynamicConcepts[1].body,
        confidenceScore: 0.74,
      },
      {
        id: nextId("concept"),
        refractedViewId: view.id,
        ordinal: 3,
        title: dynamicConcepts[2].title,
        body: dynamicConcepts[2].body,
        confidenceScore: 0.72,
      },
    ];

    store.concepts.set(view.id, concepts);
    run.status = "partial";
    run.progressHint = "generating_concepts";
    return;
  }

  if (run.step >= 3) {
    const concepts = store.concepts.get(view.id) ?? [];
    if (concepts.length >= 3) {
      const profile = topicProfile(topic);
      const bias = lensActionBias(lens);
      const connections: ConceptConnection[] = [
        {
          id: nextId("conn"),
          refractedViewId: view.id,
          sourceConceptId: concepts[0].id,
          relationVerb: "shapes",
          targetConceptId: concepts[1].id,
          rationale: `${profile.rationale} This sets the boundary for ${bias}.`,
          weight: 0.78,
        },
        {
          id: nextId("conn"),
          refractedViewId: view.id,
          sourceConceptId: concepts[1].id,
          relationVerb: "prioritizes",
          targetConceptId: concepts[2].id,
          rationale: `The chosen trade-off profile determines the first practical action to execute.`,
          weight: 0.73,
        },
      ];

      store.connections.set(view.id, connections);
    }

    view.retrievalSummary =
      "Web retrieval enabled: synthesized from high-level public context and generated reasoning.";
    view.status = "ready";
    view.generatedAt = nowIso();

    topic.status = "ready";
    topic.activeRefractedViewId = view.id;

    run.status = "succeeded";
    run.progressHint = "done";
    run.finishedAt = nowIso();
  }
}

function advanceRun(run: GenerationRun): GenerationRun {
  if (run.status === "succeeded" || run.status === "failed") {
    return run;
  }

  const topic = store.topicSessions.get(run.topicSessionId);
  const view = store.refractedViews.get(run.refractedViewId);
  const lens = store.lenses.find((item) => item.id === run.lensId);

  if (!topic || !view || !lens) {
    run.status = "failed";
    run.progressHint = "failed";
    run.errorCode = "NOT_FOUND";
    run.errorSummary = "Generation references missing entities.";
    run.finishedAt = nowIso();
    return run;
  }

  run.status = "running";
  run.progressHint = run.step === 0 ? "queued" : run.progressHint;

  run.step += 1;
  stageGenerationArtifacts(run, topic, lens, view);
  return run;
}

function getLatestRunForView(viewId: string): GenerationRun | null {
  const runs = Array.from(store.generationRuns.values()).filter(
    (run) => run.refractedViewId === viewId,
  );
  if (runs.length === 0) {
    return null;
  }

  return runs[runs.length - 1];
}

export function executeAction(
  action: string,
  payload: Record<string, unknown>,
  requestId: string | undefined,
) {
  if (action === "createTopicSession") {
    if (
      typeof payload.topicText !== "string" ||
      payload.topicText.trim().length === 0
    ) {
      return fail(
        requestId,
        "VALIDATION_ERROR",
        "topicText is required",
        false,
        { field: "topicText" },
      );
    }

    const topicSession: TopicSession = {
      id: nextId("topic"),
      topicText: payload.topicText,
      normalizedTopic: normalizeTopic(payload.topicText),
      status: "created",
      selectedLensId: null,
      activeRefractedViewId: null,
    };

    store.topicSessions.set(topicSession.id, topicSession);

    const recommendedLensIds = store.lenses
      .filter((lens) => lens.isActive)
      .slice(0, 3)
      .map((lens) => lens.id);
    return ok(requestId, { topicSession, recommendedLensIds });
  }

  if (action === "listLenses") {
    const includeInactive = payload.includeInactive === true;
    const lenses = store.lenses
      .filter((lens) => includeInactive || lens.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    return ok(requestId, { lenses });
  }

  if (action === "selectLens") {
    try {
      const topicSession = ensureTopicSession(payload.topicSessionId);
      const lens = ensureLens(payload.lensId);
      const view = ensureRefractedView(topicSession.id, lens.id);

      topicSession.selectedLensId = lens.id;
      topicSession.status = "lens_selected";

      return ok(requestId, {
        topicSession,
        refractedViewDraftId: view.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Select lens failed";
      return fail(requestId, "NOT_FOUND", message);
    }
  }

  if (action === "generateLensView" || action === "regenerateLensView") {
    try {
      const topicSession = ensureTopicSession(payload.topicSessionId);
      const lens = ensureLens(payload.lensId);
      const view = ensureRefractedView(topicSession.id, lens.id);

      topicSession.selectedLensId = lens.id;
      topicSession.status = "generating";
      view.status = "generating";
      view.generationRunId = nextId("run");

      const run: GenerationRun = {
        id: view.generationRunId,
        topicSessionId: topicSession.id,
        lensId: lens.id,
        mode: action === "regenerateLensView" ? "regenerate" : "generate",
        retrievalEnabled: payload.retrievalEnabled !== false,
        status: "queued",
        startedAt: nowIso(),
        finishedAt: null,
        errorCode: null,
        errorSummary: null,
        progressHint: "queued",
        step: 0,
        refractedViewId: view.id,
      };

      store.generationRuns.set(run.id, run);

      return ok(requestId, {
        generationRunId: run.id,
        refractedViewId: view.id,
        status: "queued",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Generation start failed";
      return fail(requestId, "NOT_FOUND", message);
    }
  }

  if (action === "getGenerationStatus") {
    if (typeof payload.generationRunId !== "string") {
      return fail(
        requestId,
        "VALIDATION_ERROR",
        "generationRunId is required",
        false,
        {
          field: "generationRunId",
        },
      );
    }

    const run = store.generationRuns.get(payload.generationRunId);
    if (!run) {
      return fail(requestId, "NOT_FOUND", "Generation run not found");
    }

    const updatedRun = advanceRun(run);
    return ok(requestId, {
      generationRun: {
        id: updatedRun.id,
        status: updatedRun.status,
        startedAt: updatedRun.startedAt,
        finishedAt: updatedRun.finishedAt,
        errorCode: updatedRun.errorCode,
        errorSummary: updatedRun.errorSummary,
      },
      progressHint: updatedRun.progressHint,
    });
  }

  if (action === "getLensExplorationView") {
    try {
      const topicSession = ensureTopicSession(payload.topicSessionId);
      const lens = ensureLens(payload.lensId);
      const view = ensureRefractedView(topicSession.id, lens.id);

      const latestRun = getLatestRunForView(view.id);
      const concepts = (store.concepts.get(view.id) ?? [])
        .slice()
        .sort((a, b) => a.ordinal - b.ordinal);
      const connections = store.connections.get(view.id) ?? [];

      return ok(requestId, {
        refractedView: {
          id: view.id,
          title: view.title,
          summary: view.summary,
          status: view.status,
          retrievalSummary: view.retrievalSummary,
          generatedAt: view.generatedAt,
        },
        concepts,
        connections,
        generation: {
          latestRunId: latestRun?.id ?? "",
          status: latestRun?.status ?? "queued",
          errorSummary: latestRun?.errorSummary ?? null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Exploration view failed";
      return fail(requestId, "NOT_FOUND", message);
    }
  }

  if (action === "getTopicSession") {
    try {
      const topicSession = ensureTopicSession(payload.topicSessionId);
      const selectedLens = topicSession.selectedLensId
        ? (store.lenses.find(
            (lens) => lens.id === topicSession.selectedLensId,
          ) ?? null)
        : null;

      const activeRefractedViewSummary = topicSession.activeRefractedViewId
        ? (() => {
            const view = store.refractedViews.get(
              topicSession.activeRefractedViewId,
            );
            if (!view) {
              return null;
            }

            return {
              id: view.id,
              title: view.title,
              summary: view.summary,
              status: view.status,
              retrievalSummary: view.retrievalSummary,
              generatedAt: view.generatedAt,
            };
          })()
        : null;

      return ok(requestId, {
        topicSession,
        selectedLens,
        activeRefractedViewSummary,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Topic session retrieval failed";
      return fail(requestId, "NOT_FOUND", message);
    }
  }

  return fail(
    requestId,
    "VALIDATION_ERROR",
    `Unknown action: ${action}`,
    false,
    { action },
  );
}
