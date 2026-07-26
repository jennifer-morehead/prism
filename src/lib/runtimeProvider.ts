const configuredProvider = (
  import.meta.env.VITE_RUNTIME_PROVIDER ?? "local"
).toLowerCase();

export const runtimeProvider =
  configuredProvider === "base44" ? "base44" : "local";

export const isLocalRuntime = runtimeProvider === "local";
