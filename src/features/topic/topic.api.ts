import { apiClient } from "../../lib/apiClient";
import {
  CreateTopicSessionData,
  CreateTopicSessionPayload,
  GetTopicSessionData,
  GetTopicSessionPayload,
} from "../../types/contracts";

export async function createTopicSession(payload: CreateTopicSessionPayload) {
  const response = await apiClient.invoke<
    CreateTopicSessionPayload,
    CreateTopicSessionData
  >("createTopicSession", payload);
  return response.data;
}

export async function getTopicSession(payload: GetTopicSessionPayload) {
  const response = await apiClient.invoke<
    GetTopicSessionPayload,
    GetTopicSessionData
  >("getTopicSession", payload);
  return response.data;
}
