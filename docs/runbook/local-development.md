# Local Development Runbook

## Start

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and confirm `VITE_BASE44_APP_ID` is set.
3. Optional: set `VITE_BASE44_SERVER_URL` if you are not using the default Base44 host.
4. Run `npm run dev`.
5. Open the local URL shown by Vite.

## Expected Local Flow

1. Enter a topic on the landing page.
2. Choose a lens.
3. Watch generation progress in the exploration screen.
4. Review summary, key concepts, and concept connections.

## Smoke Test

- Topic entry returns a topic session.
- Lens selection returns curated lenses.
- Generation transitions from queued to partial to succeeded.
- Exploration view renders stable output.

## Troubleshooting

- If the app cannot load data, verify `VITE_BASE44_APP_ID` points to an app containing the Prism entities.
- If using a custom backend host, verify `VITE_BASE44_SERVER_URL` is correct and reachable.
- If generation appears stuck, refresh the exploration page to resume polling from the latest run.

## 2-Minute Demo Checklist

1. Start the app with `npm run dev`.
2. Enter a topic and submit.
3. Pick a lens and confirm you land on exploration.
4. Wait for status to reach `ready` and verify concepts plus connections render.
5. Click regenerate once and confirm the page recovers to `ready`.
