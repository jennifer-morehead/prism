export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "GENERATION_FAILED"
  | "RETRIEVAL_TIMEOUT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiRequestEnvelope<TPayload> {
  action: string;
  payload: TPayload;
  requestId?: string;
  clientTs?: string;
}

export interface ApiSuccessEnvelope<TData> {
  ok: true;
  data: TData;
  meta: {
    requestId?: string;
    serverTs: string;
    durationMs?: number;
  };
}

export interface ApiErrorEnvelope {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    retriable: boolean;
    details?: Record<string, unknown>;
  };
  meta: {
    requestId?: string;
    serverTs: string;
  };
}

export type ApiResponseEnvelope<TData> =
  | ApiSuccessEnvelope<TData>
  | ApiErrorEnvelope;

export interface TopicSessionSummary {
  id: string;
  topicText: string;
  normalizedTopic: string;
  status: "created" | "lens_selected" | "generating" | "ready" | "failed";
  selectedLensId: string | null;
  activeRefractedViewId: string | null;
}

export interface LensSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  displayOrder: number;
  accentColor: string | null;
  isActive: boolean;
}

export interface RefractedViewSummary {
  id: string;
  title: string | null;
  summary: string | null;
  status: "draft" | "generating" | "ready" | "failed";
  retrievalSummary: string | null;
  generatedAt: string | null;
}

export interface ConceptSummary {
  id: string;
  refractedViewId: string;
  ordinal: number;
  title: string;
  body: string;
  confidenceScore: number | null;
}

export interface ConceptConnectionSummary {
  id: string;
  sourceConceptId: string;
  relationVerb: string;
  targetConceptId: string;
  rationale: string | null;
  weight: number | null;
}

export interface GenerationRunSummary {
  id: string;
  status: "queued" | "running" | "partial" | "succeeded" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorSummary: string | null;
}

export interface CreateTopicSessionPayload {
  topicText: string;
}

export interface CreateTopicSessionData {
  topicSession: TopicSessionSummary;
  recommendedLensIds: string[];
}

export interface SelectLensPayload {
  topicSessionId: string;
  lensId: string;
}

export interface SelectLensData {
  topicSession: TopicSessionSummary;
  refractedViewDraftId: string;
}

export interface GenerateLensViewPayload {
  topicSessionId: string;
  lensId: string;
  retrievalEnabled?: boolean;
  forceRegenerate?: boolean;
}

export interface GenerateLensViewData {
  generationRunId: string;
  refractedViewId: string;
  status: "queued" | "running";
}

export interface RegenerateLensViewPayload {
  topicSessionId: string;
  lensId: string;
}

export interface RegenerateLensViewData {
  generationRunId: string;
  status: "queued" | "running";
}

export interface ListLensesPayload {
  includeInactive?: boolean;
}

export interface ListLensesData {
  lenses: LensSummary[];
}

export interface GetTopicSessionPayload {
  topicSessionId: string;
}

export interface GetTopicSessionData {
  topicSession: TopicSessionSummary;
  selectedLens: LensSummary | null;
  activeRefractedViewSummary: RefractedViewSummary | null;
}

export interface GetLensExplorationViewPayload {
  topicSessionId: string;
  lensId: string;
}

export interface GetLensExplorationViewData {
  refractedView: RefractedViewSummary;
  concepts: ConceptSummary[];
  connections: ConceptConnectionSummary[];
  generation: {
    latestRunId: string;
    status: GenerationRunSummary["status"];
    errorSummary: string | null;
  };
}

export interface GetGenerationStatusPayload {
  generationRunId: string;
}

export interface GetGenerationStatusData {
  generationRun: GenerationRunSummary;
  progressHint:
    | "queued"
    | "generating_summary"
    | "generating_concepts"
    | "generating_connections"
    | "finalizing"
    | "done"
    | "failed";
}
