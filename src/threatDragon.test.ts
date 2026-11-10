import { describe, expect, it } from "vitest";
import demo from "../tests/fixtures/threat-dragon-v2.json";
import { importThreatDragon, toThreatDragon } from "./threatDragon";
import { exampleModel } from "./model";
import { parseModel } from "./storage";

const fixture = () => structuredClone(demo);
describe("Threat Dragon interoperability", () => {
  it("imports the official OWASP 2.x sample with all supported cells and threats", () => {
    const { models, warnings } = importThreatDragon(fixture());
    expect(models.length).toBe(demo.detail.diagrams.length);
    for (const [i, m] of models.entries()) {
      expect(() => parseModel(m)).not.toThrow();
      const cells = demo.detail.diagrams[i]!.cells;
      const supported = cells
        .filter((c) =>
          ["actor", "process", "store", "trust-boundary-box", "flow"].includes(
            c.shape,
          ),
        )
        .filter(
          (c) =>
            c.shape !== "flow" || ("cell" in c.source! && "cell" in c.target!),
        );
      expect(m.nodes.length + m.edges.length).toBe(supported.length);
      expect(m.threats.length).toBe(
        supported.reduce((n, c) => n + (c.data.threats?.length || 0), 0),
      );
      const exported = toThreatDragon(m);
      expect(exported.detail.diagrams[i]!.cells.length).toBe(cells.length);
      expect(importThreatDragon(exported).models[i]!.threats.length).toBe(
        m.threats.length,
      );
    }
    expect(warnings.join(" ")).toContain("preserved");
  });
  it("keeps Atlas details, statuses, review state and native JSON source metadata through round trips", () => {
    const m = exampleModel();
    m.threats[0]!.status = "accepted";
    m.threats[1]!.status = "not-applicable";
    m.edges[0]!.waypoints = [{ x: 123, y: 456 }];
    const doc = toThreatDragon(m);
    expect(
      doc.detail.diagrams[0]!.cells.find((c) => c.id === m.nodes[0]!.id)!.shape,
    ).toBe("trust-boundary-box");
    const imported = parseModel(
      importThreatDragon(JSON.parse(JSON.stringify(doc))).models[0],
    );
    expect(imported.metadata).toEqual(m.metadata);
    expect(imported.threats).toEqual(m.threats);
    expect(imported.nextThreatNumber).toBe(m.nextThreatNumber);
    expect(imported.edges[0]!.waypoints).toEqual(m.edges[0]!.waypoints);
    expect(
      parseModel(JSON.parse(JSON.stringify(imported))).threatDragon,
    ).toEqual(imported.threatDragon);
  });
  it("honors severity edits made in Threat Dragon over saved Atlas ratings", () => {
    const original = exampleModel();
    const doc = toThreatDragon(original);
    const cell = doc.detail.diagrams[0]!.cells.find(
      (c) => c.id === original.threats[0]!.elementId,
    )!;
    (cell.data!.threats as { severity: string }[])[0]!.severity = "Low";
    const imported = importThreatDragon(doc).models[0]!;
    expect(imported.threats[0]!.impactRating).toBe("low");
    expect(imported.threats[0]!.likelihood).toBe("");
  });
  it("imports legacy JointJS cells and exports current X6 cells", () => {
    const legacy = {
      version: "1.6.1",
      summary: { title: "Legacy" },
      detail: {
        diagrams: [
          {
            id: 0,
            title: "Diagram",
            diagramType: "STRIDE",
            diagramJson: {
              cells: [
                {
                  id: "actor",
                  type: "tm.Actor",
                  position: { x: 10, y: 20 },
                  attrs: { text: { text: "User" } },
                },
                {
                  id: "process",
                  type: "tm.Process",
                  position: { x: 100, y: 20 },
                  attrs: { text: { text: "Service" } },
                },
                {
                  id: "flow",
                  type: "tm.Flow",
                  source: { id: "actor" },
                  target: { id: "process" },
                  labels: [{ attrs: { text: { text: "Request" } } }],
                },
              ],
            },
          },
        ],
      },
    };
    const m = importThreatDragon(legacy).models[0]!;
    expect(m.nodes.map((n) => n.name)).toEqual(["User", "Service"]);
    expect(m.edges[0]).toMatchObject({
      source: "actor",
      target: "process",
      label: "Request",
    });
    expect(toThreatDragon(m).version).toMatch(/^2\./);
  });
  it("imports every diagram independently and preserves sibling diagrams on export", () => {
    const doc = toThreatDragon(exampleModel());
    doc.detail.diagrams.push({
      ...structuredClone(doc.detail.diagrams[0]!),
      id: 1,
      title: "Second",
    });
    const { models } = importThreatDragon(doc);
    expect(models).toHaveLength(2);
    expect(models[1]!.name).toContain("Second");
    models[0]!.nodes[0]!.name = "Changed";
    expect(toThreatDragon(models[0]!).detail.diagrams[1]).toEqual(
      doc.detail.diagrams[1],
    );
  });
  it("rejects malformed input, duplicate IDs, dangling edges and unsupported methodologies", () => {
    expect(() => importThreatDragon({})).toThrow();
    const doc = toThreatDragon(exampleModel()),
      diagram = doc.detail.diagrams[0]!;
    diagram.cells.push(structuredClone(diagram.cells[0]!));
    expect(() => importThreatDragon(doc)).toThrow(/Duplicate element/);
    diagram.cells.pop();
    diagram.cells.find((c) => c.shape === "flow")!.source = { cell: "missing" };
    expect(() => importThreatDragon(doc)).toThrow(/endpoint/);
    diagram.diagramType = "LINDDUN";
    expect(() => importThreatDragon(doc)).toThrow(/STRIDE/);
  });
  it("applies Atlas edits to original Threat Dragon cells and removes deleted cells", () => {
    const m = importThreatDragon(fixture()).models[0]!;
    const n = m.nodes.find((n) => n.type !== "boundary")!;
    n.name = "Edited";
    n.position = { x: 1, y: 2 };
    const edge = m.edges.pop()!;
    m.threats = m.threats.filter((t) => t.elementId !== edge.id);
    const cells = toThreatDragon(m).detail.diagrams[0]!.cells;
    expect(cells.find((c) => c.id === n.id)).toMatchObject({
      data: { name: "Edited" },
      position: { x: 1, y: 2 },
    });
    expect(cells.some((c) => c.id === edge.id)).toBe(false);
  });
});
