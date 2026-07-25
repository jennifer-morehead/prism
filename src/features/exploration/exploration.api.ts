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
import { callAction } from "../../lib/actionBridge";

export async function generateLensView(payload: GenerateLensViewPayload) {
  return callAction<GenerateLensViewData>(
    "generateLensView",
    payload as unknown as Record<string, unknown>,
  );
}

export async function regenerateLensView(payload: RegenerateLensViewPayload) {
  return callAction<RegenerateLensViewData>(
    "regenerateLensView",
    payload as unknown as Record<string, unknown>,
  );
}

export async function getLensExplorationView(
  payload: GetLensExplorationViewPayload,
) {
  return callAction<GetLensExplorationViewData>(
    "getLensExplorationView",
    payload as unknown as Record<string, unknown>,
  );
}

export async function getGenerationStatus(payload: GetGenerationStatusPayload) {
  return callAction<GetGenerationStatusData>(
    "getGenerationStatus",
    payload as unknown as Record<string, unknown>,
  );
}
