import {
  ApiRequestEnvelope,
  ApiResponseEnvelope,
  ApiSuccessEnvelope,
} from "../types/contracts";

export interface ActionTransportOptions {
  endpoint: string;
  defaultHeaders?: Record<string, string>;
}

export interface ActionTransport {
  invoke<TPayload, TData>(
    envelope: ApiRequestEnvelope<TPayload>,
  ): Promise<ApiSuccessEnvelope<TData>>;
}

export class FetchActionTransport implements ActionTransport {
  private readonly endpoint: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ActionTransportOptions) {
    this.endpoint = options.endpoint;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  async invoke<TPayload, TData>(
    envelope: ApiRequestEnvelope<TPayload>,
  ): Promise<ApiSuccessEnvelope<TData>> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.defaultHeaders,
      },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = (await response.json()) as ApiResponseEnvelope<TData>;
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result;
  }
}
