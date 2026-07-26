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

describe("Generation lifecycle", () => {
  beforeEach(() => {
    resetPrismActionStore();
  });

  test("recovers from failed generation start by retrying with a valid lens", () => {
    const created = data<{ topicSession: { id: string } }>(
      executeAction(
        "createTopicSession",
        { topicText: "AI safety in education" },
        "life-1",
      ),
    );

    const failedGeneration = executeAction(
      "generateLensView",
      {
        topicSessionId: created.topicSession.id,
        lensId: "lens_missing",
        retrievalEnabled: true,
      },
      "life-2",
    );

    expect(errorCode(failedGeneration)).toBe("NOT_FOUND");

    const selected = data<{ topicSession: { status: string } }>(
      (() => {
        const lenses = data<{ lenses: Array<{ id: string }> }>(
          executeAction(
            "listLenses",
            { topicSessionId: created.topicSession.id },
            "life-2b",
          ),
        );
        const lensId = lenses.lenses[0]?.id;
        if (!lensId) {
          throw new Error("Expected at least one generated lens");
        }

        return executeAction(
          "selectLens",
          {
            topicSessionId: created.topicSession.id,
            lensId,
          },
          "life-3",
        );
      })(),
    );

    expect(selected.topicSession.status).toBe("lens_selected");

    const generated = data<{ generationRunId: string }>(
      (() => {
        const lenses = data<{ lenses: Array<{ id: string }> }>(
          executeAction(
            "listLenses",
            { topicSessionId: created.topicSession.id },
            "life-3b",
          ),
        );
        const lensId = lenses.lenses[0]?.id;
        if (!lensId) {
          throw new Error("Expected at least one generated lens");
        }

        return executeAction(
          "generateLensView",
          {
            topicSessionId: created.topicSession.id,
            lensId,
            retrievalEnabled: true,
          },
          "life-4",
        );
      })(),
    );

    const first = data<{ generationRun: { status: string } }>(
      executeAction(
        "getGenerationStatus",
        { generationRunId: generated.generationRunId },
        "life-5",
      ),
    );
    const second = data<{ generationRun: { status: string } }>(
      executeAction(
        "getGenerationStatus",
        { generationRunId: generated.generationRunId },
        "life-6",
      ),
    );
    const third = data<{ generationRun: { status: string } }>(
      executeAction(
        "getGenerationStatus",
        { generationRunId: generated.generationRunId },
        "life-7",
      ),
    );

    expect(first.generationRun.status).toBe("partial");
    expect(second.generationRun.status).toBe("partial");
    expect(third.generationRun.status).toBe("succeeded");
  });

  test("regenerate after ready produces a new run and reaches succeeded again", () => {
    const created = data<{ topicSession: { id: string } }>(
      executeAction(
        "createTopicSession",
        { topicText: "Future of work" },
        "regen-1",
      ),
    );

    const initialLenses = data<{ lenses: Array<{ id: string }> }>(
      executeAction(
        "listLenses",
        { topicSessionId: created.topicSession.id },
        "regen-1b",
      ),
    );
    const selectedLensId = initialLenses.lenses[0]?.id;
    if (!selectedLensId) {
      throw new Error("Expected at least one generated lens");
    }

    executeAction(
      "selectLens",
      { topicSessionId: created.topicSession.id, lensId: selectedLensId },
      "regen-2",
    );

    const firstRun = data<{ generationRunId: string }>(
      executeAction(
        "generateLensView",
        {
          topicSessionId: created.topicSession.id,
          lensId: selectedLensId,
          retrievalEnabled: true,
        },
        "regen-3",
      ),
    );

    // Advance to succeeded.
    executeAction(
      "getGenerationStatus",
      { generationRunId: firstRun.generationRunId },
      "regen-4",
    );
    executeAction(
      "getGenerationStatus",
      { generationRunId: firstRun.generationRunId },
      "regen-5",
    );
    const doneStatus = data<{ generationRun: { status: string } }>(
      executeAction(
        "getGenerationStatus",
        { generationRunId: firstRun.generationRunId },
        "regen-6",
      ),
    );
    expect(doneStatus.generationRun.status).toBe("succeeded");

    // Trigger regeneration and advance new run.
    const regenRun = data<{ generationRunId: string }>(
      executeAction(
        "regenerateLensView",
        { topicSessionId: created.topicSession.id, lensId: selectedLensId },
        "regen-7",
      ),
    );

    expect(regenRun.generationRunId).not.toBe(firstRun.generationRunId);

    executeAction(
      "getGenerationStatus",
      { generationRunId: regenRun.generationRunId },
      "regen-8",
    );
    executeAction(
      "getGenerationStatus",
      { generationRunId: regenRun.generationRunId },
      "regen-9",
    );
    const regenDone = data<{
      generationRun: { status: string };
      progressHint: string;
    }>(
      executeAction(
        "getGenerationStatus",
        { generationRunId: regenRun.generationRunId },
        "regen-10",
      ),
    );

    expect(regenDone.generationRun.status).toBe("succeeded");
    expect(regenDone.progressHint).toBe("done");

    const view = data<{
      refractedView: { status: string };
      concepts: unknown[];
      connections: unknown[];
      generation: { latestRunId: string; status: string };
    }>(
      executeAction(
        "getLensExplorationView",
        { topicSessionId: created.topicSession.id, lensId: selectedLensId },
        "regen-11",
      ),
    );

    expect(view.refractedView.status).toBe("ready");
    expect(view.concepts.length).toBeGreaterThan(0);
    expect(view.connections.length).toBeGreaterThan(0);
    expect(view.generation.status).toBe("succeeded");
  });
});
