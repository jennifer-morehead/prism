import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { prismActionsPlugin } from "./dev/actionsPlugin";

export default defineConfig({
  plugins: [react(), prismActionsPlugin()],
});
