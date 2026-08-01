/**
 * Evaluation dataset scaffolding for Phase 1.
 * Populate fixtures as real runs accumulate; score offline.
 */
export type EvalCase = {
  id: string;
  companyName: string;
  domain?: string;
  expectedKeep?: boolean;
  expectedAngle?: string;
  notes?: string;
};

export const EVAL_SEED: EvalCase[] = [
  {
    id: "eval-001",
    companyName: "Example Design-led SaaS",
    domain: "example.com",
    expectedKeep: true,
    expectedAngle: "design_systems",
    notes: "Replace with real labeled cases after week 1.",
  },
];
