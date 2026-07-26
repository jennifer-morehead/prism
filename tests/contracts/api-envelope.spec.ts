import { describe, expect, test } from "vitest";
import {
  executeAction,
  resetPrismActionStore,
} from "../../dev/prismActionRuntime";

describe("API envelope contract", () => {
  test("returns ok/data/meta on success and error/meta on failure", () => {
    resetPrismActionStore();

    const created = executeAction(
      "createTopicSession",
      { topicText: "Lens contract check" },
      "req-0",
    ) as {
      ok: true;
      data: { topicSession: { id: string } };
    };

    const success = executeAction(
      "listLenses",
      { topicSessionId: created.data.topicSession.id },
      "req-1",
    ) as {
      ok: true;
      data: { lenses: unknown[] };
      meta: { requestId?: string; serverTs: string };
    };

    expect(success.ok).toBe(true);
    expect(Array.isArray(success.data.lenses)).toBe(true);
    expect(success.meta.requestId).toBe("req-1");
    expect(typeof success.meta.serverTs).toBe("string");

    const failure = executeAction(
      "createTopicSession",
      { topicText: "" },
      "req-2",
    ) as {
      ok: false;
      error: { code: string; message: string; retriable: boolean };
      meta: { requestId?: string; serverTs: string };
    };

    expect(failure.ok).toBe(false);
    expect(failure.error.code).toBe("VALIDATION_ERROR");
    expect(failure.meta.requestId).toBe("req-2");
    expect(typeof failure.meta.serverTs).toBe("string");
  });
});
