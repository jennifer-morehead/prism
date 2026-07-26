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
import { isLocalRuntime } from "../../lib/runtimeProvider";
import {
  generateLensView as generateLensViewBackend,
  getGenerationStatus as getGenerationStatusBackend,
  getLensExplorationView as getLensExplorationViewBackend,
  regenerateLensView as regenerateLensViewBackend,
} from "../../lib/prismBackend";

export async function generateLensView(payload: GenerateLensViewPayload) {
  if (!isLocalRuntime) {
    return generateLensViewBackend(payload);
  }

  return callAction<GenerateLensViewData>(
    "generateLensView",
    payload as unknown as Record<string, unknown>,
  );
}

export async function regenerateLensView(payload: RegenerateLensViewPayload) {
  if (!isLocalRuntime) {
    return regenerateLensViewBackend(payload);
  }

  return callAction<RegenerateLensViewData>(
    "regenerateLensView",
    payload as unknown as Record<string, unknown>,
  );
}

export async function getLensExplorationView(
  payload: GetLensExplorationViewPayload,
) {
  if (!isLocalRuntime) {
    return getLensExplorationViewBackend(payload);
  }

  return callAction<GetLensExplorationViewData>(
    "getLensExplorationView",
    payload as unknown as Record<string, unknown>,
  );
}

export async function getGenerationStatus(payload: GetGenerationStatusPayload) {
  if (!isLocalRuntime) {
    return getGenerationStatusBackend(payload);
  }

  return callAction<GetGenerationStatusData>(
    "getGenerationStatus",
    payload as unknown as Record<string, unknown>,
  );
}
