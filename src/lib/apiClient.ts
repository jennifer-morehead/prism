import { ApiRequestEnvelope, ApiSuccessEnvelope } from "../types/contracts";
import { ActionTransport, FetchActionTransport } from "./actionTransport";
import { Base44ActionTransport } from "./base44ActionTransport";

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
  private readonly transport: ActionTransport;

  constructor(options: ApiClientOptions) {
    const transport = createTransport(options.endpoint, options.defaultHeaders);
    this.transport = transport;
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

    try {
      return await this.transport.invoke<TPayload, TData>(body);
    } catch (error) {
      if (error instanceof Error) {
        throw new ApiClientError("INTERNAL_ERROR", error.message, true);
      }

      throw new ApiClientError(
        "INTERNAL_ERROR",
        "Unknown transport error",
        true,
      );
    }
  }
}

const defaultEndpoint = "/api/actions";
const configuredEndpoint = import.meta.env.VITE_API_ACTIONS_ENDPOINT;
const runtimeProvider = import.meta.env.VITE_RUNTIME_PROVIDER;
const defaultHeaders = import.meta.env.VITE_API_ACTIONS_HEADERS_JSON;

function parseHeaders(
  rawHeaders: string | undefined,
): Record<string, string> | undefined {
  if (!rawHeaders) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawHeaders) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "string"),
    ) as Record<string, string>;
  } catch {
    return undefined;
  }
}

function createTransport(
  endpointFromOptions: string,
  headersFromOptions?: Record<string, string>,
) {
  const endpoint = endpointFromOptions || configuredEndpoint || defaultEndpoint;
  const headers = headersFromOptions ?? parseHeaders(defaultHeaders);

  if (runtimeProvider === "base44") {
    return new Base44ActionTransport({ endpoint, defaultHeaders: headers });
  }

  return new FetchActionTransport({ endpoint, defaultHeaders: headers });
}

export const apiClient = new ApiClient({
  endpoint: configuredEndpoint || defaultEndpoint,
});
