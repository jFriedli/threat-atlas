# Threat Atlas

Visual, local-first threat modeling using STRIDE.

[Open Threat Atlas](https://jfriedli.github.io/threat-atlas/)

Threat Atlas is a professional diagram-first workspace for mapping systems, attaching security findings directly to architecture, checking STRIDE coverage, and exporting a portable threat model. It runs entirely in the browser: no account, backend, API key, or telemetry is required.

## Capabilities

- Interactive data-flow diagrams with external entities, processes, data stores, resizable trust boundaries, and directed flows
- Drag/drop and quick-create interactions, selection, resize, pan, zoom, minimap, fit view, undo/redo, copy/paste, duplication, and explicit horizontal or vertical auto-layout
- Rich optional metadata for components and flows
- Fast guided STRIDE threat creation with four finding states and lightweight likelihood/impact risk
- Threat indicators on architecture, review suggestions, aggregate threat table, search, and coverage matrix
- Multiple local models, example banking model, IndexedDB autosave, defensive JSON import, full JSON export, and Markdown reports
- Model context including scope, assumptions, ownership, review, version, and Markdown-compatible notes
- Responsive layout, focus mode, light/dark themes, accessible labels, focus states, and keyboard reference

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Then open `http://localhost:5173`.

```bash
npm test          # Vitest domain and integrity tests
npm run test:e2e # Playwright browser workflows
npm run build     # production GitHub Pages build
npm run lint
```

Install Playwright's Chromium once with `npx playwright install chromium` before the E2E suite.

## Architecture

The React/TypeScript client separates portable domain records (`domain.ts`), methodology configuration, model factories, IndexedDB persistence, history state, diagram rendering, review UI, and exporters. React Flow renders the canvas, Zustand owns editor state, Zod validates imports, Dagre performs opt-in layout, and `idb` provides resilient browser persistence.

Threats remain independent records linked by stable element IDs. STRIDE categories are configuration rather than rendering constants, leaving room for future methodologies. See [the model format](docs/model-format.md).

## Privacy and data

Models never leave the browser unless the user explicitly downloads or imports a file. JSON exports contain the complete editable model. Imports are validated before being saved and receive a new local model ID. Clearing site data removes local models, so keep JSON exports for durable backup.

## Deployment

Every push to `main` runs tests, builds with the `/threat-atlas/` base path, and deploys the static artifact to GitHub Pages through Actions.

## Roadmap

Planned extension points include custom methodologies, LINDDUN, reusable threat libraries and component templates, CWE/ASVS/ATT&CK mappings, Git-backed models, collaboration, and optional assisted suggestions.

## License

MIT
