import {
  ListLensesData,
  ListLensesPayload,
  SelectLensData,
  SelectLensPayload,
} from "../../types/contracts";
import { callAction } from "../../lib/actionBridge";
import { isLocalRuntime } from "../../lib/runtimeProvider";
import {
  listLenses as listLensesBackend,
  selectLens as selectLensBackend,
} from "../../lib/prismBackend";

export async function listLenses(payload: ListLensesPayload = {}) {
  if (!isLocalRuntime) {
    return listLensesBackend(payload);
  }

  return callAction<ListLensesData>(
    "listLenses",
    payload as unknown as Record<string, unknown>,
  );
}

export async function selectLens(payload: SelectLensPayload) {
  if (!isLocalRuntime) {
    return selectLensBackend(payload);
  }

  return callAction<SelectLensData>(
    "selectLens",
    payload as unknown as Record<string, unknown>,
  );
}
