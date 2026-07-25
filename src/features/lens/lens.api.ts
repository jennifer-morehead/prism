import {
  ListLensesData,
  ListLensesPayload,
  SelectLensData,
  SelectLensPayload,
} from "../../types/contracts";
import { callAction } from "../../lib/actionBridge";

export async function listLenses(payload: ListLensesPayload = {}) {
  return callAction<ListLensesData>(
    "listLenses",
    payload as unknown as Record<string, unknown>,
  );
}

export async function selectLens(payload: SelectLensPayload) {
  return callAction<SelectLensData>(
    "selectLens",
    payload as unknown as Record<string, unknown>,
  );
}
