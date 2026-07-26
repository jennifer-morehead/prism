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

const MAX_TOPIC_LENSES = 4;

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
  generatedLenses: Lens[];
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
  topicSessions: Map<string, TopicSession>;
  refractedViews: Map<string, RefractedView>;
  concepts: Map<string, Concept[]>;
  connections: Map<string, ConceptConnection[]>;
  generationRuns: Map<string, GenerationRun>;
}

const store: StoreState = {
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

function slugToken(value: string): string {
  return normalizeTopic(value)
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 32);
}

function toLens(
  topicSlug: string,
  name: string,
  description: string,
  order: number,
): Lens {
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return {
    id: `lens_${topicSlug}_${order}`,
    key,
    name,
    description,
    displayOrder: order,
    accentColor: null,
    isActive: true,
  };
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
): Lens[] {
  const normalized = normalizeTopic(topicText);
  const topicTitle = titleCaseTopic(topicText);

  if (
    normalized.includes("yoga") ||
    normalized.includes("meditation") ||
    normalized.includes("mindfulness")
  ) {
    return [
      toLens(
        topicSlug,
        "Movement instructor",
        "Instruction quality, progression pacing, and student adaptation.",
        1,
      ),
      toLens(
        topicSlug,
        "Sports medicine specialist",
        "Mobility, injury prevention, and recovery constraints.",
        2,
      ),
      toLens(
        topicSlug,
        "Meditation practitioner",
        "Breathwork integration, focus outcomes, and mental steadiness.",
        3,
      ),
      toLens(
        topicSlug,
        "Studio owner",
        "Class operations, retention, and sustainable business delivery.",
        4,
      ),
      toLens(
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
      toLens(
        topicSlug,
        "Blockchain developer",
        "Protocol design, scalability limits, and implementation risk.",
        1,
      ),
      toLens(
        topicSlug,
        "Retail investor",
        "Volatility tolerance, usability, and portfolio decision pressure.",
        2,
      ),
      toLens(
        topicSlug,
        "Monetary economist",
        "Market structure, liquidity behavior, and macro incentives.",
        3,
      ),
      toLens(
        topicSlug,
        "Regulatory analyst",
        "Compliance constraints, policy direction, and legal uncertainty.",
        4,
      ),
      toLens(
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
      toLens(
        topicSlug,
        `${topicTitle} coach`,
        "Daily practice design, motivation loops, and consistency barriers.",
        1,
      ),
      toLens(
        topicSlug,
        "Clinical specialist",
        "Safety bounds, contraindications, and measurable outcomes.",
        2,
      ),
      toLens(
        topicSlug,
        "Long-term practitioner",
        "Adherence, lifestyle fit, and practical trade-offs.",
        3,
      ),
      toLens(
        topicSlug,
        "Program operator",
        "Service delivery, staffing, and quality control at scale.",
        4,
      ),
      toLens(
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
      toLens(
        topicSlug,
        `${topicTitle} product builder`,
        "System design choices, operational constraints, and reliability.",
        1,
      ),
      toLens(
        topicSlug,
        "Retail participant",
        "Accessibility, trust, and risk-adjusted value.",
        2,
      ),
      toLens(
        topicSlug,
        "Monetary economist",
        "Incentive alignment, externalities, and systemic effects.",
        3,
      ),
      toLens(
        topicSlug,
        "Regulatory reviewer",
        "Consumer protection requirements and compliance burden.",
        4,
      ),
      toLens(
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
      toLens(
        topicSlug,
        `${topicTitle} engineer`,
        "Architecture decisions, failure handling, and maintainability trade-offs.",
        1,
      ),
      toLens(
        topicSlug,
        "Product manager",
        "User value clarity, roadmap sequencing, and delivery scope.",
        2,
      ),
      toLens(
        topicSlug,
        "Everyday end user",
        "Adoption friction, usability, and trust signals.",
        3,
      ),
      toLens(
        topicSlug,
        "Safety and ethics reviewer",
        "Misuse risk, fairness, and governance controls.",
        4,
      ),
      toLens(
        topicSlug,
        "Platform operator",
        "Cost, latency, observability, and uptime accountability.",
        5,
      ),
    ];
  }

  // Placeholder abstraction: deterministic now, swappable with model-based role generation later.
  return [
    toLens(
      topicSlug,
      `${topicTitle} practitioner`,
      "Hands-on workflows, constraints, and practical decisions.",
      1,
    ),
    toLens(
      topicSlug,
      `${topicTitle} researcher`,
      "Evidence quality, uncertainty, and open questions.",
      2,
    ),
    toLens(
      topicSlug,
      "Business operator",
      "Economic viability, resource planning, and execution risks.",
      3,
    ),
    toLens(
      topicSlug,
      "Policy and governance analyst",
      "Regulatory context, accountability, and societal impact.",
      4,
    ),
    toLens(
      topicSlug,
      "Community advocate",
      "Accessibility, inclusion, and long-term public outcomes.",
      5,
    ),
  ];
}

function generateTopicLenses(topicText: string): Lens[] {
  const topicSlug = slugToken(topicText) || "topic";
  const normalized = normalizeTopic(topicText);

  if (normalized.includes("dog") || normalized.includes("puppy")) {
    return [
      toLens(
        topicSlug,
        "First-time dog owner",
        "Daily routines, behavior basics, and what is manageable at home.",
        1,
      ),
      toLens(
        topicSlug,
        "Professional trainer",
        "Training progression, reinforcement design, and skill transfer.",
        2,
      ),
      toLens(
        topicSlug,
        "Veterinary behavior specialist",
        "Medical and behavioral contributors to difficult patterns.",
        3,
      ),
      toLens(
        topicSlug,
        "Animal welfare advocate",
        "Stress minimization, humane methods, and wellbeing outcomes.",
        4,
      ),
      toLens(
        topicSlug,
        "Working dog handler",
        "Reliability under distraction, consistency, and task performance.",
        5,
      ),
    ];
  }

  if (normalized.includes("coffee")) {
    return [
      toLens(
        topicSlug,
        "Coffee drinker",
        "Taste, convenience, cost, and day-to-day ritual value.",
        1,
      ),
      toLens(
        topicSlug,
        "Specialty roaster",
        "Bean quality, roast profile control, and consistency standards.",
        2,
      ),
      toLens(
        topicSlug,
        "Coffee farmer",
        "Yield stability, pricing pressure, and climate exposure.",
        3,
      ),
      toLens(
        topicSlug,
        "Sustainability researcher",
        "Environmental impact, traceability, and long-term resilience.",
        4,
      ),
      toLens(
        topicSlug,
        "Cafe owner",
        "Margins, customer retention, and operational throughput.",
        5,
      ),
    ];
  }

  return contextualFallbackLenses(topicSlug, topicText);
}

function getTopicLenses(topicSessionId: string): Lens[] {
  const topicSession = ensureTopicSession(topicSessionId);
  if (topicSession.generatedLenses.length > 0) {
    const lenses = topicSession.generatedLenses.slice(0, MAX_TOPIC_LENSES);
    topicSession.generatedLenses = lenses;
    return lenses;
  }

  const generated = generateTopicLenses(topicSession.topicText).slice(
    0,
    MAX_TOPIC_LENSES,
  );
  topicSession.generatedLenses = generated;
  return generated;
}

function findCompletedLensCache(topicText: string): Lens[] | null {
  const normalizedTopic = normalizeTopic(topicText);
  const candidates = Array.from(store.topicSessions.values()).filter(
    (session) =>
      session.normalizedTopic === normalizedTopic &&
      session.status === "ready" &&
      session.generatedLenses.length >= 4,
  );

  for (const session of candidates) {
    const view = session.activeRefractedViewId
      ? store.refractedViews.get(session.activeRefractedViewId)
      : null;
    const hasSucceededRun = Array.from(store.generationRuns.values()).some(
      (run) => run.topicSessionId === session.id && run.status === "succeeded",
    );
    if (view?.status === "ready" && hasSucceededRun) {
      return session.generatedLenses
        .slice(0, MAX_TOPIC_LENSES)
        .map((lens) => ({ ...lens }));
    }
  }

  return null;
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

function ensureLens(topicSessionId: unknown, lensId: unknown): Lens {
  if (typeof topicSessionId !== "string") {
    throw new Error("topicSessionId must be a string");
  }
  if (typeof lensId !== "string") {
    throw new Error("lensId must be a string");
  }

  const lenses = getTopicLenses(topicSessionId);
  const lens = lenses.find((item) => item.id === lensId);
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
  const lens = topic?.generatedLenses.find((item) => item.id === run.lensId);

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
      payload.topicText.trim().length === 0 ||
      payload.topicText.trim().length > 120
    ) {
      return fail(
        requestId,
        "VALIDATION_ERROR",
        "topicText is required and must be 120 characters or fewer",
        false,
        { field: "topicText" },
      );
    }

    const topicLenses = (
      payload.forceRefresh === true
        ? generateTopicLenses(payload.topicText)
        : (findCompletedLensCache(payload.topicText) ??
          generateTopicLenses(payload.topicText))
    ).slice(0, MAX_TOPIC_LENSES);
    const topicSession: TopicSession = {
      id: nextId("topic"),
      topicText: payload.topicText,
      normalizedTopic: normalizeTopic(payload.topicText),
      status: "created",
      selectedLensId: null,
      activeRefractedViewId: null,
      generatedLenses: topicLenses,
    };

    store.topicSessions.set(topicSession.id, topicSession);

    const recommendedLensIds = topicLenses
      .filter((lens) => lens.isActive)
      .slice(0, 3)
      .map((lens) => lens.id);
    return ok(requestId, { topicSession, recommendedLensIds });
  }

  if (action === "listLenses") {
    if (typeof payload.topicSessionId !== "string") {
      return fail(
        requestId,
        "VALIDATION_ERROR",
        "topicSessionId is required",
        false,
        { field: "topicSessionId" },
      );
    }

    const includeInactive = payload.includeInactive === true;
    const lenses = getTopicLenses(payload.topicSessionId)
      .filter((lens) => includeInactive || lens.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, MAX_TOPIC_LENSES);

    return ok(requestId, { lenses });
  }

  if (action === "generateFollowOnLenses") {
    try {
      const topicSession = ensureTopicSession(payload.topicSessionId);
      const sourceLens = ensureLens(payload.topicSessionId, payload.lensId);
      const view = store.refractedViews.get(payload.refractedViewId as string);
      if (!view || view.topicSessionId !== topicSession.id || !view.summary) {
        throw new Error("A completed refraction is required to generate new lenses");
      }

      const startOrder =
        Math.max(0, ...topicSession.generatedLenses.map((lens) => lens.displayOrder)) +
        1;
      const topicSlug = slugToken(topicSession.topicText) || "topic";
      const lenses = [
        toLens(
          topicSlug,
          `${sourceLens.name} implementation strategist`,
          "Focuses on the concrete interventions, constraints, and decisions surfaced by this refraction.",
          startOrder,
        ),
        toLens(
          topicSlug,
          "Affected community researcher",
          "Examines who experiences the consequences identified here and how those experiences differ.",
          startOrder + 1,
        ),
        toLens(
          topicSlug,
          "Systems dependency mapper",
          "Traces the institutions, incentives, and dependencies connecting the concepts in this view.",
          startOrder + 2,
        ),
        toLens(
          topicSlug,
          "Long-horizon scenario planner",
          "Tests how the central trade-offs could evolve under plausible future conditions.",
          startOrder + 3,
        ),
      ];
      topicSession.generatedLenses = lenses;
      return ok(requestId, { lenses });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Follow-on lens generation failed";
      return fail(requestId, "NOT_FOUND", message);
    }
  }

  if (action === "selectLens") {
    try {
      const topicSession = ensureTopicSession(payload.topicSessionId);
      const lens = ensureLens(payload.topicSessionId, payload.lensId);
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
      const lens = ensureLens(payload.topicSessionId, payload.lensId);
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
      const lens = ensureLens(payload.topicSessionId, payload.lensId);
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
        ? (getTopicLenses(topicSession.id).find(
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
