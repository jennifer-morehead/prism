import { apiClient } from "../../lib/apiClient";
import {
  GenerateLensViewData,
  GenerateLensViewPayload,
  GetGenerationStatusData,
  GetGenerationStatusPayload,
  GetLensExplorationViewData,
  GetLensExplorationViewPayload,
  RegenerateLensViewData,
  RegenerateLensViewPayload,
} from "../../types/contracts";

export async function generateLensView(payload: GenerateLensViewPayload) {
  const response = await apiClient.invoke<
    GenerateLensViewPayload,
    GenerateLensViewData
  >("generateLensView", payload);
  return response.data;
}

export async function regenerateLensView(payload: RegenerateLensViewPayload) {
  const response = await apiClient.invoke<
    RegenerateLensViewPayload,
    RegenerateLensViewData
  >("regenerateLensView", payload);
  return response.data;
}

export async function getLensExplorationView(
  payload: GetLensExplorationViewPayload,
) {
  const response = await apiClient.invoke<
    GetLensExplorationViewPayload,
    GetLensExplorationViewData
  >("getLensExplorationView", payload);
  return response.data;
}

export async function getGenerationStatus(payload: GetGenerationStatusPayload) {
  const response = await apiClient.invoke<
    GetGenerationStatusPayload,
    GetGenerationStatusData
  >("getGenerationStatus", payload);
  return response.data;
}
