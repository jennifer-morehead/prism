import {
  CreateTopicSessionData,
  CreateTopicSessionPayload,
  GetTopicSessionData,
  GetTopicSessionPayload,
} from "../../types/contracts";
import { callAction } from "../../lib/actionBridge";
import { isLocalRuntime } from "../../lib/runtimeProvider";
import {
  createTopicSession as createTopicSessionBackend,
  getTopicSession as getTopicSessionBackend,
} from "../../lib/prismBackend";

export async function createTopicSession(payload: CreateTopicSessionPayload) {
  if (!isLocalRuntime) {
    return createTopicSessionBackend(payload);
  }

  return callAction<CreateTopicSessionData>(
    "createTopicSession",
    payload as unknown as Record<string, unknown>,
  );
}

export async function getTopicSession(payload: GetTopicSessionPayload) {
  if (!isLocalRuntime) {
    return getTopicSessionBackend(payload);
  }

  return callAction<GetTopicSessionData>(
    "getTopicSession",
    payload as unknown as Record<string, unknown>,
  );
}
