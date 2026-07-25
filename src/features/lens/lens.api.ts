import { apiClient } from "../../lib/apiClient";
import {
  ListLensesData,
  ListLensesPayload,
  SelectLensData,
  SelectLensPayload,
} from "../../types/contracts";

export async function listLenses(payload: ListLensesPayload = {}) {
  const response = await apiClient.invoke<ListLensesPayload, ListLensesData>(
    "listLenses",
    payload,
  );
  return response.data;
}

export async function selectLens(payload: SelectLensPayload) {
  const response = await apiClient.invoke<SelectLensPayload, SelectLensData>(
    "selectLens",
    payload,
  );
  return response.data;
}
