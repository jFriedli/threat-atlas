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

### Threat Dragon interchange

Use **Import JSON** on the dashboard to open Threat Atlas JSON or OWASP Threat
Dragon 1.x/2.x STRIDE JSON. Use **Export → Threat Dragon JSON** in the editor (or
**Export Threat Dragon JSON** in a model's dashboard menu) to download a 2.x file
that can be opened in Threat Dragon.

Components, trust boundary boxes, connected data flows, positions, sizes, labels,
descriptions, protocols, threats, mitigations and supported statuses are mapped.
Atlas-only fields are included in `threatAtlas` extensions so Atlas can restore
them when reimporting. Snapshot history is excluded from Threat Dragon exports.
Threat Dragon severity imports as impact rating with likelihood unset; Atlas
exports calculated risk when available, otherwise impact rating or TBD.

Each diagram in a multi-diagram file becomes a separate Atlas model. Exporting
one of these models updates its diagram and retains the other original diagrams;
it does not merge edits made in the separately imported sibling models.

Curved trust boundaries, text annotations and flows with unattached endpoints
are preserved in the imported source and exported again, but are not editable or
visible on the Atlas canvas. Import shows a notice for these cases. Source data
also survives native Atlas JSON exports and browser storage. Unsupported threat
statuses display as Open and retain their original export value until changed.
Non-STRIDE diagrams and unknown threat categories are rejected with an error.
Threats must be assigned to an element to export to Threat Dragon. Extensions
can only be restored if the other application retains them when saving.

The adapter follows OWASP's [Threat Dragon schemas](https://github.com/OWASP/threat-dragon/tree/main/td.vue/src/assets/schema)
and is tested against its official 2.x demo model.
