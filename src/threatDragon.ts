import { z } from "zod";
import {
  emptyMetadata,
  modelSchema,
  risk,
  uid,
  type ThreatModel,
  type Threat,
} from "./domain";
import { createModel } from "./model";
import { STRIDE } from "./methodology";

const point = z.object({ x: z.number(), y: z.number() });
const cellSchema = z
  .object({
    id: z.string().min(1),
    shape: z.string(),
    position: point.optional(),
    size: z
      .object({ width: z.number().positive(), height: z.number().positive() })
      .optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
const diagramSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    diagramType: z.string().optional(),
    cells: z.array(cellSchema),
  })
  .passthrough();
const documentSchema = z
  .object({
    version: z.string().optional(),
    summary: z
      .object({
        title: z.string().min(1),
        description: z.string().optional(),
        owner: z.string().optional(),
      })
      .passthrough(),
    detail: z
      .object({
        diagrams: z.array(diagramSchema).min(1),
        reviewer: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();
type Cell = z.infer<typeof cellSchema>;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const shapes = {
  external: "actor",
  process: "process",
  store: "store",
  boundary: "trust-boundary-box",
} as const;
const legacyShapes: Record<string, string> = {
  "tm.Actor": "actor",
  "tm.Process": "process",
  "tm.Store": "store",
  "tm.Flow": "flow",
  "tm.Boundary": "trust-boundary-curve",
  "tm.BoundaryBox": "trust-boundary-box",
};
const statusNames = {
  open: "Open",
  mitigated: "Mitigated",
  accepted: "Accepted",
  "not-applicable": "NotApplicable",
};

// Convert JointJS (1.x) cells into the X6 (2.x) representation before mapping.
function normalize(value: unknown): unknown {
  const raw = structuredClone(obj(value)),
    detail = obj(raw.detail);
  if (raw.version && !/^[12]\./.test(str(raw.version)))
    throw new Error("Unsupported Threat Dragon version");
  if (Array.isArray(detail.diagrams))
    detail.diagrams = detail.diagrams.map((value) => {
      const d = obj(value),
        json = obj(d.diagramJson);
      if (Array.isArray(d.cells) || !Array.isArray(json.cells)) return d;
      return {
        ...d,
        cells: json.cells.map((value) => {
          const c = obj(value),
            source = obj(c.source),
            target = obj(c.target);
          return {
            ...c,
            shape: legacyShapes[str(c.type)] || str(c.type),
            zIndex: c.z || 0,
            source: { ...source, cell: source.id },
            target: { ...target, cell: target.id },
            data: {
              ...c,
              name: str(obj(obj(c.attrs).text).text),
              threats: c.threats || [],
            },
          };
        }),
      };
    });
  return raw;
}

export function isThreatDragon(value: unknown): boolean {
  return "summary" in obj(value) && "detail" in obj(value);
}
export function importThreatDragon(value: unknown): {
  models: ThreatModel[];
  warnings: string[];
} {
  const doc = documentSchema.parse(normalize(value)),
    warnings = new Set<string>();
  const models = doc.detail.diagrams.map((diagram, index) => {
    if (diagram.diagramType && diagram.diagramType.toUpperCase() !== "STRIDE")
      throw new Error(
        `Diagram “${diagram.title}” uses ${diagram.diagramType}; Atlas currently supports STRIDE only.`,
      );
    const m = createModel(doc.summary.title);
    const extension = obj(diagram.threatAtlas);
    Object.assign(m, extension, {
      id: uid(),
      nodes: [],
      edges: [],
      threats: [],
      snapshots: [],
    });
    m.name =
      doc.detail.diagrams.length > 1
        ? `${doc.summary.title} — ${diagram.title}`
        : doc.summary.title;
    m.metadata = {
      ...m.metadata,
      description: doc.summary.description || "",
      authors: doc.summary.owner || "",
      reviewers: doc.detail.reviewer || "",
    };
    const represented: string[] = [];
    if (new Set(diagram.cells.map((c) => c.id)).size !== diagram.cells.length)
      throw new Error("Duplicate element ID in Threat Dragon diagram");
    for (const c of diagram.cells) {
      const type = (Object.keys(shapes) as (keyof typeof shapes)[]).find(
        (t) => shapes[t] === c.shape,
      );
      if (!type) continue;
      if (!c.position) throw new Error(`Missing position for “${c.id}”`);
      const data = c.data || {},
        attrs = obj(c.attrs);
      m.nodes.push({
        ...obj(c.threatAtlas),
        id: c.id,
        type,
        name:
          str(data.name) ||
          str(obj(attrs.text).text) ||
          str(obj(attrs.label).text),
        position: c.position,
        size: c.size,
        zIndex: typeof c.zIndex === "number" ? c.zIndex : undefined,
        metadata: {
          ...emptyMetadata(),
          ...obj(obj(c.threatAtlas).metadata),
          description: str(data.description),
          privilegeLevel: str(data.privilegeLevel),
        },
      });
      represented.push(c.id);
    }
    const nodeIds = new Set(m.nodes.map((n) => n.id));
    for (const c of diagram.cells.filter((c) => c.shape === "flow")) {
      const source = str(obj(c.source).cell),
        target = str(obj(c.target).cell),
        data = c.data || {};
      if (
        (!source && typeof obj(c.source).x === "number") ||
        (!target && typeof obj(c.target).x === "number")
      ) {
        warnings.add(
          "Flows with unattached endpoints are preserved for export but are not displayed in Atlas.",
        );
        continue;
      }
      if (!nodeIds.has(source) || !nodeIds.has(target))
        throw new Error(
          `Data flow “${str(data.name) || c.id}” has a missing or unsupported endpoint`,
        );
      const labels = Array.isArray(c.labels) ? c.labels : [];
      m.edges.push({
        port: "",
        authentication: "",
        dataClassification: "",
        notes: "",
        ...obj(c.threatAtlas),
        id: c.id,
        source,
        target,
        label:
          str(data.name) ||
          str(obj(obj(obj(labels[0]).attrs).label).text) ||
          str(obj(obj(obj(labels[0]).attrs).text).text),
        ...{ description: str(data.description), protocol: str(data.protocol) },
        encryption: data.isEncrypted
          ? str(obj(c.threatAtlas).encryption) || "Encrypted"
          : "",
        waypoints:
          c.vertices === undefined && obj(c.threatAtlas).waypoints === undefined
            ? undefined
            : z.array(point).parse(c.vertices || []),
        routing:
          c.threatAtlas === undefined && c.connector === "normal"
            ? "straight"
            : obj(c.threatAtlas).routing === "straight"
              ? "straight"
              : obj(c.threatAtlas).routing === "smoothstep"
                ? "smoothstep"
                : "bezier",
      });
      represented.push(c.id);
    }
    for (const c of diagram.cells) {
      if (!represented.includes(c.id)) {
        warnings.add(
          "Some diagram shapes (including curved trust boundaries) are preserved for export but are not displayed in Atlas.",
        );
        continue;
      }
      const data = c.data || {},
        threats = data.threats || c.threats || [];
      if (!Array.isArray(threats))
        throw new Error(`Invalid threats for “${c.id}”`);
      for (const value of threats) {
        const t = obj(value),
          category = STRIDE.find(
            (s) => s.name.toLowerCase() === str(t.type).toLowerCase(),
          );
        if (!category)
          throw new Error(
            `Unsupported threat category: ${str(t.type) || "(empty)"}`,
          );
        const number =
            typeof t.number === "number" &&
            Number.isInteger(t.number) &&
            t.number >= 0
              ? t.number
              : m.threats.length + 1,
          severity = str(t.severity).toLowerCase(),
          status = str(t.status).toLowerCase();
        const mappedStatus =
          status === "mitigated"
            ? "mitigated"
            : status === "accepted"
              ? "accepted"
              : ["not applicable", "notapplicable", "na"].includes(status)
                ? "not-applicable"
                : "open";
        if (
          ![
            "open",
            "mitigated",
            "accepted",
            "not applicable",
            "notapplicable",
            "na",
          ].includes(status)
        )
          warnings.add(
            "Unsupported threat statuses are displayed as Open; their original values are preserved for export until changed.",
          );
        const threat: Threat = {
          id: str(t.id) || str(t.threatId) || uid(),
          displayId: `TA-${String(number).padStart(3, "0")}`,
          elementId: c.id,
          title: str(t.title),
          strideCategory: category.id,
          status: mappedStatus,
          description: str(t.description),
          remediation: str(t.mitigation),
          likelihood: "",
          impactRating: ["low", "medium", "high"].includes(severity)
            ? (severity as Threat["impactRating"])
            : "",
          impact: "",
          attackScenario: "",
          residualRisk: "",
          references: "",
          tags: [],
          owner: "",
          dueDate: "",
          verification: "",
          notes: "",
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        };
        Object.assign(threat, obj(t.threatAtlas), {
          id: threat.id,
          elementId: c.id,
          title: threat.title,
          strideCategory: category.id,
          status: mappedStatus,
          description: threat.description,
          remediation: threat.remediation,
        });
        // An edit in Threat Dragon takes precedence over Atlas's saved ratings.
        const exportedSeverity =
          risk(threat.likelihood, threat.impactRating) ||
          threat.impactRating ||
          "tbd";
        if (severity !== exportedSeverity) {
          threat.likelihood = "";
          threat.impactRating = ["low", "medium", "high"].includes(severity)
            ? (severity as Threat["impactRating"])
            : "";
        }
        m.nextThreatNumber = Math.max(m.nextThreatNumber, number + 1);
        m.threats.push(threat);
        m.reviewState[c.id] = {
          ...m.reviewState[c.id],
          [category.id]: "threat-identified",
        };
      }
    }
    m.threatDragon = {
      document: doc,
      diagramIndex: index,
      representedIds: represented,
    };
    if (new Set(m.threats.map((t) => t.id)).size !== m.threats.length)
      throw new Error("Duplicate threat ID in Threat Dragon diagram");
    return modelSchema.parse(m);
  });
  return { models, warnings: [...warnings] };
}

export function toThreatDragon(m: ThreatModel): z.infer<typeof documentSchema> {
  const original = m.threatDragon
    ? documentSchema.parse(structuredClone(m.threatDragon.document))
    : undefined;
  const oldDiagram = original?.detail.diagrams[m.threatDragon!.diagramIndex];
  const oldCells = new Map(oldDiagram?.cells.map((c) => [c.id, c]) || []);
  const cells: Cell[] = [];
  const threats = (id: string) =>
    m.threats
      .filter((t) => t.elementId === id)
      .map((t) => {
        const oldData = oldCells.get(id)?.data || {},
          old =
            (Array.isArray(oldData.threats) ? oldData.threats : [])
              .map(obj)
              .find((v) => v.id === t.id || v.threatId === t.id) || {};
        const oldStatus = str(old.status),
          knownStatus = [
            "Open",
            "Mitigated",
            "Accepted",
            "Not applicable",
            "NotApplicable",
            "NA",
          ].includes(oldStatus);
        return {
          ...old,
          id: t.id,
          threatId: t.id,
          number:
            Number(t.displayId.replace(/\D/g, "")) || m.threats.indexOf(t) + 1,
          title: t.title,
          type: STRIDE.find((s) => s.id === t.strideCategory)!.name,
          modelType: "STRIDE",
          status:
            !knownStatus && oldStatus && t.status === "open"
              ? oldStatus
              : statusNames[t.status],
          severity: (
            risk(t.likelihood, t.impactRating) ||
            t.impactRating ||
            "TBD"
          ).replace(/^./, (s) => s.toUpperCase()),
          description: t.description,
          mitigation: t.remediation,
          threatAtlas: t,
        };
      });
  for (const n of m.nodes) {
    const old = oldCells.get(n.id),
      shape = shapes[n.type];
    cells.push({
      ...old,
      id: n.id,
      shape,
      position: n.position,
      size: n.size || { width: 190, height: 90 },
      zIndex: n.zIndex ?? (n.type === "boundary" ? 0 : 1),
      attrs: {
        ...obj(old?.attrs),
        [n.type === "boundary" ? "label" : "text"]: { text: n.name },
      },
      data: {
        ...old?.data,
        type:
          n.type === "boundary"
            ? "tm.BoundaryBox"
            : `tm.${n.type === "external" ? "Actor" : n.type === "store" ? "Store" : "Process"}`,
        name: n.name,
        description: n.metadata.description,
        privilegeLevel: n.metadata.privilegeLevel,
        isTrustBoundary: n.type === "boundary",
        hasOpenThreats: m.threats.some(
          (t) => t.elementId === n.id && t.status === "open",
        ),
        threats: threats(n.id),
      },
      threatAtlas: n,
    });
  }
  for (const e of m.edges) {
    const old = oldCells.get(e.id);
    cells.push({
      ...old,
      id: e.id,
      shape: "flow",
      zIndex: 10,
      source: { ...obj(old?.source), cell: e.source },
      target: { ...obj(old?.target), cell: e.target },
      vertices: e.waypoints || [],
      connector: e.routing === "straight" ? "normal" : "smooth",
      attrs: {
        ...obj(old?.attrs),
        line: {
          targetMarker: { name: "classic" },
          ...obj(obj(old?.attrs).line),
        },
      },
      labels: [{ position: 0.5, attrs: { label: { text: e.label } } }],
      data: {
        ...old?.data,
        type: "tm.Flow",
        name: e.label,
        description: e.description,
        protocol: e.protocol,
        isEncrypted: !!e.encryption,
        hasOpenThreats: m.threats.some(
          (t) => t.elementId === e.id && t.status === "open",
        ),
        threats: threats(e.id),
      },
      threatAtlas: e,
    });
  }
  if (m.threats.some((t) => !cells.some((c) => c.id === t.elementId)))
    throw new Error(
      "Assign every threat to an element before exporting to Threat Dragon.",
    );
  for (const c of oldDiagram?.cells || [])
    if (!m.threatDragon?.representedIds.includes(c.id)) cells.push(c);
  const {
    nodes: _n,
    edges: _e,
    threats: _t,
    threatDragon: _d,
    snapshots: _s,
    ...extension
  } = m;
  const diagram = {
    ...oldDiagram,
    id: oldDiagram?.id ?? 0,
    title: oldDiagram?.title || m.name,
    version: "2.5.0",
    diagramType: "STRIDE",
    thumbnail: "",
    cells,
    threatAtlas: extension,
  };
  const diagrams = original?.detail.diagrams || [diagram];
  diagrams[m.threatDragon?.diagramIndex ?? 0] = diagram;
  return {
    ...original,
    version: "2.5.0",
    summary: {
      ...original?.summary,
      title: m.name,
      owner: m.metadata.authors,
      description: m.metadata.description,
      id: m.id,
    },
    detail: {
      ...original?.detail,
      contributors: original?.detail.contributors || [],
      reviewer: m.metadata.reviewers,
      diagramTop: Math.max(...diagrams.map((d) => d.id)) + 1,
      threatTop: Math.max(
        m.nextThreatNumber - 1,
        Number(original?.detail.threatTop) || 0,
      ),
      diagrams,
    },
  };
}
