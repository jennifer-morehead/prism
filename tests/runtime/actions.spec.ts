import { beforeEach, describe, expect, test } from "vitest";
import {
  executeAction,
  resetPrismActionStore,
} from "../../dev/prismActionRuntime";

function data<T>(envelope: unknown): T {
  const typedEnvelope = envelope as {
    ok: boolean;
    data?: T;
    error?: { code: string };
  };
  if (!typedEnvelope.ok || !typedEnvelope.data) {
    throw new Error(
      `Expected success envelope but received ${JSON.stringify(envelope)}`,
    );
  }

  return typedEnvelope.data;
}

function errorCode(envelope: unknown): string {
  const typedEnvelope = envelope as { ok: boolean; error?: { code: string } };
  if (typedEnvelope.ok || !typedEnvelope.error) {
    throw new Error(
      `Expected error envelope but received ${JSON.stringify(envelope)}`,
    );
  }

  return typedEnvelope.error.code;
}

describe("Prism action runtime", () => {
  beforeEach(() => {
    resetPrismActionStore();
  });

  test("creates topic sessions and returns recommended lenses", () => {
    const envelope = executeAction(
      "createTopicSession",
      { topicText: "AI in healthcare" },
      "req-1",
    );
    const result = data<{
      topicSession: { id: string; status: string };
      recommendedLensIds: string[];
    }>(envelope);

    expect(result.topicSession.status).toBe("created");
    expect(result.recommendedLensIds.length).toBeGreaterThan(0);

    const listed = data<{ lenses: Array<{ id: string }> }>(
      executeAction(
        "listLenses",
        { topicSessionId: result.topicSession.id },
        "req-1b",
      ),
    );
    expect(listed.lenses.slice(0, 3).map((lens) => lens.id)).toEqual(
      result.recommendedLensIds,
    );
  });

  test("advances generation lifecycle to a ready exploration view", () => {
    const created = data<{ topicSession: { id: string } }>(
      executeAction(
        "createTopicSession",
        { topicText: "dog training" },
        "req-2",
      ),
    );

    const availableLenses = data<{
      lenses: Array<{ id: string; name: string }>;
    }>(
      executeAction(
        "listLenses",
        { topicSessionId: created.topicSession.id },
        "req-2b",
      ),
    );
    const selectedLensId = availableLenses.lenses[0]?.id;
    const selectedLensName = availableLenses.lenses[0]?.name;

    if (!selectedLensId || !selectedLensName) {
      throw new Error("Expected at least one generated lens");
    }

    const selected = data<{
      topicSession: { status: string };
      refractedViewDraftId: string;
    }>(
      executeAction(
        "selectLens",
        { topicSessionId: created.topicSession.id, lensId: selectedLensId },
        "req-3",
      ),
    );

    expect(selected.topicSession.status).toBe("lens_selected");

    const generated = data<{ generationRunId: string }>(
      executeAction(
        "generateLensView",
        {
          topicSessionId: created.topicSession.id,
          lensId: selectedLensId,
          retrievalEnabled: true,
        },
        "req-4",
      ),
    );

    const firstStatus = data<{
      generationRun: { status: string };
      progressHint: string;
    }>(
      executeAction(
        "getGenerationStatus",
        { generationRunId: generated.generationRunId },
        "req-5",
      ),
    );
    const secondStatus = data<{
      generationRun: { status: string };
      progressHint: string;
    }>(
      executeAction(
        "getGenerationStatus",
        { generationRunId: generated.generationRunId },
        "req-6",
      ),
    );
    const thirdStatus = data<{
      generationRun: { status: string };
      progressHint: string;
    }>(
      executeAction(
        "getGenerationStatus",
        { generationRunId: generated.generationRunId },
        "req-7",
      ),
    );

    expect(firstStatus.progressHint).toBe("generating_summary");
    expect(secondStatus.progressHint).toBe("generating_concepts");
    expect(thirdStatus.generationRun.status).toBe("succeeded");
    expect(thirdStatus.progressHint).toBe("done");

    const exploration = data<{
      refractedView: {
        status: string;
        title: string | null;
        summary: string | null;
      };
      concepts: Array<{ ordinal: number }>;
      connections: Array<{ relationVerb: string }>;
      generation: { status: string };
    }>(
      executeAction(
        "getLensExplorationView",
        { topicSessionId: created.topicSession.id, lensId: selectedLensId },
        "req-8",
      ),
    );

    expect(exploration.refractedView.status).toBe("ready");
    expect(exploration.refractedView.title).toContain(selectedLensName);
    expect(exploration.concepts).toHaveLength(3);
    expect(exploration.connections).toHaveLength(2);
    expect(exploration.generation.status).toBe("succeeded");
  });

  test("reuses completed exact-topic lenses unless forceRefresh is requested", () => {
    const source = data<{ topicSession: { id: string } }>(
      executeAction(
        "createTopicSession",
        { topicText: "yoga" },
        "cache-1",
      ),
    );
    const sourceLenses = data<{ lenses: Array<{ id: string }> }>(
      executeAction(
        "listLenses",
        { topicSessionId: source.topicSession.id },
        "cache-2",
      ),
    );
    const lensId = sourceLenses.lenses[0]?.id;
    if (!lensId) throw new Error("Expected a source lens");

    data(
      executeAction(
        "selectLens",
        { topicSessionId: source.topicSession.id, lensId },
        "cache-3",
      ),
    );
    const run = data<{ generationRunId: string }>(
      executeAction(
        "generateLensView",
        { topicSessionId: source.topicSession.id, lensId },
        "cache-4",
      ),
    );
    executeAction("getGenerationStatus", { generationRunId: run.generationRunId }, "cache-5");
    executeAction("getGenerationStatus", { generationRunId: run.generationRunId }, "cache-6");
    executeAction("getGenerationStatus", { generationRunId: run.generationRunId }, "cache-7");
    const exploration = data<{ refractedView: { id: string } }>(
      executeAction(
        "getLensExplorationView",
        { topicSessionId: source.topicSession.id, lensId },
        "cache-8",
      ),
    );
    data(
      executeAction(
        "generateFollowOnLenses",
        {
          topicSessionId: source.topicSession.id,
          lensId,
          refractedViewId: exploration.refractedView.id,
        },
        "cache-9",
      ),
    );

    const reused = data<{ topicSession: { id: string } }>(
      executeAction(
        "createTopicSession",
        { topicText: "  YOGA   " },
        "cache-10",
      ),
    );
    const reusedLenses = data<{ lenses: unknown[] }>(
      executeAction(
        "listLenses",
        { topicSessionId: reused.topicSession.id },
        "cache-11",
      ),
    );
    expect(reusedLenses.lenses).toHaveLength(4);

    const refreshed = data<{ topicSession: { id: string } }>(
      executeAction(
        "createTopicSession",
        { topicText: "yoga", forceRefresh: true },
        "cache-12",
      ),
    );
    const refreshedLenses = data<{ lenses: unknown[] }>(
      executeAction(
        "listLenses",
        { topicSessionId: refreshed.topicSession.id },
        "cache-13",
      ),
    );
    expect(refreshedLenses.lenses).toHaveLength(4);
  });

  test("supports regeneration and returns expected error codes for bad inputs", () => {
    const missingRun = executeAction(
      "getGenerationStatus",
      { generationRunId: "missing" },
      "req-9",
    );
    expect(errorCode(missingRun)).toBe("NOT_FOUND");

    const invalidTopic = executeAction(
      "createTopicSession",
      { topicText: "" },
      "req-10",
    );
    expect(errorCode(invalidTopic)).toBe("VALIDATION_ERROR");

    const created = data<{ topicSession: { id: string } }>(
      executeAction(
        "createTopicSession",
        { topicText: "Climate policy" },
        "req-11",
      ),
    );

    const availableLenses = data<{ lenses: Array<{ id: string }> }>(
      executeAction(
        "listLenses",
        { topicSessionId: created.topicSession.id },
        "req-11b",
      ),
    );
    const selectedLensId = availableLenses.lenses[0]?.id;
    if (!selectedLensId) {
      throw new Error("Expected at least one generated lens");
    }

    data(
      executeAction(
        "selectLens",
        { topicSessionId: created.topicSession.id, lensId: selectedLensId },
        "req-12",
      ),
    );
    const generated = data<{ generationRunId: string }>(
      executeAction(
        "generateLensView",
        {
          topicSessionId: created.topicSession.id,
          lensId: selectedLensId,
          retrievalEnabled: true,
        },
        "req-13",
      ),
    );
    executeAction(
      "getGenerationStatus",
      { generationRunId: generated.generationRunId },
      "req-14",
    );
    executeAction(
      "getGenerationStatus",
      { generationRunId: generated.generationRunId },
      "req-15",
    );
    executeAction(
      "getGenerationStatus",
      { generationRunId: generated.generationRunId },
      "req-16",
    );

    const regenerated = data<{ generationRunId: string }>(
      executeAction(
        "regenerateLensView",
        { topicSessionId: created.topicSession.id, lensId: selectedLensId },
        "req-17",
      ),
    );

    expect(regenerated.generationRunId).not.toBe(generated.generationRunId);
  });
});
