import { createClient } from "@base44/sdk";

const configuredAppId = import.meta.env.VITE_BASE44_APP_ID;
const fallbackAppId = "6a6519a1d40b9ed6b51551bc";
const configuredServerUrl = import.meta.env.VITE_BASE44_SERVER_URL;

if (!configuredAppId) {
  // Keep fallback for hackathon speed, but make missing config visible.
  console.warn(
    "[Base44] VITE_BASE44_APP_ID is not set. Falling back to bundled demo app id.",
  );
}

export const base44 = createClient({
  appId: configuredAppId || fallbackAppId,
  serverUrl: configuredServerUrl || "https://base44.app",
});
