import {
  CreateTopicSessionData,
  CreateTopicSessionPayload,
  GetTopicSessionData,
  GetTopicSessionPayload,
} from "../../types/contracts";
import { callAction } from "../../lib/actionBridge";

export async function createTopicSession(payload: CreateTopicSessionPayload) {
  return callAction<CreateTopicSessionData>(
    "createTopicSession",
    payload as unknown as Record<string, unknown>,
  );
}

export async function getTopicSession(payload: GetTopicSessionPayload) {
  return callAction<GetTopicSessionData>(
    "getTopicSession",
    payload as unknown as Record<string, unknown>,
  );
}
