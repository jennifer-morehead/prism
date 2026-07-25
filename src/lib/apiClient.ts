import {
  ApiRequestEnvelope,
  ApiResponseEnvelope,
  ApiSuccessEnvelope,
} from "../types/contracts";

export interface ApiClientOptions {
  endpoint: string;
  defaultHeaders?: Record<string, string>;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly retriable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    retriable: boolean,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.retriable = retriable;
    this.details = details;
  }
}

export class ApiClient {
  private readonly endpoint: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions) {
    this.endpoint = options.endpoint;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  async invoke<TPayload, TData>(
    action: string,
    payload: TPayload,
    requestId?: string,
  ): Promise<ApiSuccessEnvelope<TData>> {
    const body: ApiRequestEnvelope<TPayload> = {
      action,
      payload,
      requestId,
      clientTs: new Date().toISOString(),
    };

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.defaultHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ApiClientError(
        "INTERNAL_ERROR",
        `HTTP ${response.status}`,
        true,
      );
    }

    const envelope = (await response.json()) as ApiResponseEnvelope<TData>;
    if (!envelope.ok) {
      throw new ApiClientError(
        envelope.error.code,
        envelope.error.message,
        envelope.error.retriable,
        envelope.error.details,
      );
    }

    return envelope;
  }
}

export const apiClient = new ApiClient({ endpoint: "/api/actions" });
