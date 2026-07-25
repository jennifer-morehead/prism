# Prism MVP Readiness

## Functional Gates

- Topic entry creates a topic session.
- Lens selection loads a curated lens list.
- Generation produces summary, concepts, and connections.
- Regeneration works without breaking the last stable view.

## Runtime Gates

- Frontend action endpoint is configurable.
- Local dev uses the Vite action bridge.
- Production deployment can point to a Base44-backed actions endpoint.

## Verification Gates

- `npm run build` passes.
- `npm test` passes.
- Manual smoke test covers topic -> lens -> exploration.

## Out of Scope

- Collaboration and permissions.
- Custom lens authoring.
- Strict citation workflow.
