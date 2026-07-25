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
  });

  test("advances generation lifecycle to a ready exploration view", () => {
    const created = data<{ topicSession: { id: string } }>(
      executeAction(
        "createTopicSession",
        { topicText: "AI in healthcare" },
        "req-2",
      ),
    );

    const selected = data<{
      topicSession: { status: string };
      refractedViewDraftId: string;
    }>(
      executeAction(
        "selectLens",
        { topicSessionId: created.topicSession.id, lensId: "lens_everyday" },
        "req-3",
      ),
    );

    expect(selected.topicSession.status).toBe("lens_selected");

    const generated = data<{ generationRunId: string }>(
      executeAction(
        "generateLensView",
        {
          topicSessionId: created.topicSession.id,
          lensId: "lens_everyday",
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
        { topicSessionId: created.topicSession.id, lensId: "lens_everyday" },
        "req-8",
      ),
    );

    expect(exploration.refractedView.status).toBe("ready");
    expect(exploration.refractedView.title).toContain("Everyday User");
    expect(exploration.concepts).toHaveLength(3);
    expect(exploration.connections).toHaveLength(2);
    expect(exploration.generation.status).toBe("succeeded");
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

    data(
      executeAction(
        "selectLens",
        { topicSessionId: created.topicSession.id, lensId: "lens_policy" },
        "req-12",
      ),
    );
    const generated = data<{ generationRunId: string }>(
      executeAction(
        "generateLensView",
        {
          topicSessionId: created.topicSession.id,
          lensId: "lens_policy",
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
        { topicSessionId: created.topicSession.id, lensId: "lens_policy" },
        "req-17",
      ),
    );

    expect(regenerated.generationRunId).not.toBe(generated.generationRunId);
  });
});
