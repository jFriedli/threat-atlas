# Threat Atlas JSON model format

Threat Atlas exports UTF-8 JSON with `schemaVersion: 1`. The top-level record contains stable UUIDs, model metadata, viewport, nodes, edges, threats, per-element STRIDE review state, timestamps, the monotonic next threat number, and optional local snapshots.

Threats reference architecture objects through `elementId`. Data flows reference nodes with `source` and `target`. Import validates required fields, duplicate IDs, schema version, and dangling flow endpoints before writing anything to IndexedDB. An imported model receives a new model UUID to avoid replacing local data.

Risk is deliberately qualitative: Low=1, Medium=2, High=3. Likelihood × impact scores 1–2 are Low, 3–5 Medium, and 6–9 High. Either input may be left unset.

The TypeScript source of truth and runtime validator are in `src/domain.ts`.
