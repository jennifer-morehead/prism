import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

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

const store = {
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

async function readJsonBody(
  req: IncomingMessage,
): Promise<ActionRequestEnvelope> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const bodyText = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(bodyText) as ActionRequestEnvelope;
}

function writeJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function ok<T>(requestId: string | undefined, data: T) {
  return {
    ok: true,
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
    ok: false,
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

function stageGenerationArtifacts(
  run: GenerationRun,
  topic: TopicSession,
  lens: Lens,
  view: RefractedView,
) {
  if (run.step === 1) {
    view.summary = `${lens.name} view: ${topic.topicText} is shaped by incentives, constraints, and outcomes that vary by stakeholder.`;
    view.title = `${lens.name} Refracted View`;
    view.status = "generating";
    run.status = "partial";
    run.progressHint = "generating_summary";
    return;
  }

  if (run.step === 2) {
    const concepts: Concept[] = [
      {
        id: nextId("concept"),
        refractedViewId: view.id,
        ordinal: 1,
        title: "Primary Drivers",
        body: `Key forces affecting ${topic.topicText} from the ${lens.name.toLowerCase()} perspective.`,
        confidenceScore: 0.77,
      },
      {
        id: nextId("concept"),
        refractedViewId: view.id,
        ordinal: 2,
        title: "Trade-offs",
        body: `Benefits and costs emerge differently depending on implementation and governance choices.`,
        confidenceScore: 0.74,
      },
      {
        id: nextId("concept"),
        refractedViewId: view.id,
        ordinal: 3,
        title: "Near-Term Actions",
        body: "Concrete experiments can reduce uncertainty while preserving optionality.",
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
      const connections: ConceptConnection[] = [
        {
          id: nextId("conn"),
          refractedViewId: view.id,
          sourceConceptId: concepts[0].id,
          relationVerb: "shapes",
          targetConceptId: concepts[1].id,
          rationale:
            "Foundational forces determine the severity of trade-offs.",
          weight: 0.78,
        },
        {
          id: nextId("conn"),
          refractedViewId: view.id,
          sourceConceptId: concepts[1].id,
          relationVerb: "prioritizes",
          targetConceptId: concepts[2].id,
          rationale:
            "Trade-off profile determines which actions are feasible first.",
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

export function prismActionsPlugin(): Plugin {
  return {
    name: "prism-actions-plugin",
    configureServer(server) {
      server.middlewares.use("/api/actions", async (req, res) => {
        if (req.method !== "POST") {
          writeJson(
            res,
            405,
            fail(undefined, "VALIDATION_ERROR", "Method not allowed", false),
          );
          return;
        }

        try {
          const request = await readJsonBody(req);
          const result = executeAction(
            request.action,
            request.payload ?? {},
            request.requestId,
          );
          writeJson(res, 200, result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unexpected server error";
          writeJson(res, 500, fail(undefined, "INTERNAL_ERROR", message, true));
        }
      });
    },
  };
}
