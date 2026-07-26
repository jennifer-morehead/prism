# Prism

Prism is a Base44 + Vite/React MVP for topic reframing through curated lenses.

## Local Development

1. Install dependencies:
   - `npm install`
2. Run the app:
   - `npm run dev`
3. Open the app in the browser.

## Environment

Copy `.env.example` to `.env` and set your Base44 app values.

Default behavior:

- `VITE_RUNTIME_PROVIDER=local` uses the local `/api/actions` bridge and does not write to Base44.
- `VITE_RUNTIME_PROVIDER=base44` uses the Base44 SDK and writes to your Base44 app entities.
- `VITE_BASE44_APP_ID` is used by the SDK client.
- If `VITE_BASE44_APP_ID` is not set, the app falls back to the bundled demo app id and logs a warning.
- `VITE_BASE44_SERVER_URL` is optional and defaults to `https://base44.app`.

## Current MVP runtime behavior

- Topic sessions are created from the landing page.
- Lens selection loads a curated lens catalog.
- Generation produces a refracted summary, ordered concepts, and explicit connections.
- Regeneration preserves the latest stable output until a new run succeeds.

## Base44 configuration

Base44 project files live in `base44/` and define the active entities and agents for the Prism MVP.
