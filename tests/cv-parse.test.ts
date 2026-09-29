import assert from "node:assert/strict";
import { test } from "node:test";
import { joinPdfTextItems } from "../src/modules/profile/ingest";
import { findDatedEntries, missingDatedEntries } from "../src/modules/profile/dated-entries";
import { StructuredProfileSchema } from "../src/modules/profile/schemas";

const item = (str: string, x: number, y: number, width: number, height = 10, hasEOL = false) => ({
  str,
  transform: [height, 0, 0, height, x, y],
  width,
  height,
  hasEOL,
});

test("PDF text keeps table cells apart and multi-word cells whole", () => {
  const text = joinPdfTextItems([
    item("2019–2023", 40, 700, 50),
    item("Quantox Technology", 144, 700, 128, 15.5),
    item("Senior UI/UX Designer", 280, 700, 110, 10.6, true),
    item("Tools", 40, 650, 30),
    item("Figma", 144, 650, 30),
    item("Claude Code", 200, 650, 60),
    item("Cursor", 290, 650, 35, 10, true),
  ]);
  assert.equal(
    text,
    "2019–2023\tQuantox Technology\tSenior UI/UX Designer\nTools\tFigma\tClaude Code\tCursor\n",
  );
});

test("dated entries are found in column CVs and LinkedIn-style exports", () => {
  const corpus = [
    "2024–Present\tSpace Inch\tSenior Product Designer",
    "2023\tKOD WORKS\tSenior Product Designer",
    "Registered Nurse",
    "Mar 2018 - Present",
    "Tools\tExcel",
  ].join("\n");
  assert.deepEqual(
    findDatedEntries(corpus).map((e) => e.label),
    ["Space Inch", "KOD WORKS", "Registered Nurse"],
  );
});

test("missing dated entries are reported until every role is extracted", () => {
  const corpus = "2023–2024\tIngsoftware\tProduct Designer\n2019–2023\tQuantox Technology\tSenior UI/UX Designer";
  const partial = StructuredProfileSchema.parse({
    relevantProjects: [
      { title: "Senior UI/UX Designer at Quantox Technology", summary: "", organization: "Quantox Technology" },
    ],
  });
  assert.deepEqual(missingDatedEntries(partial, corpus).map((e) => e.label), ["Ingsoftware"]);
});
