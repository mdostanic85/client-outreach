import assert from "node:assert/strict";
import {
  formatHiringActivity,
  formatSalaryDisplay,
  reputationTone,
  websiteHref,
} from "../src/modules/jobs/company-snapshot";

assert.equal(
  formatSalaryDisplay({
    salaryText: "€80k–€100k",
    salaryMin: 80000,
    salaryMax: 100000,
    salaryCurrency: "EUR",
  }),
  "€80k–€100k",
);

assert.equal(
  formatSalaryDisplay({
    salaryText: null,
    salaryMin: 80000,
    salaryMax: 120000,
    salaryCurrency: "EUR",
  }),
  "EUR 80k–120k",
);

assert.equal(formatHiringActivity(0, 90), null);
assert.equal(formatHiringActivity(1, 90), "1 other opening in last 90 days");
assert.equal(formatHiringActivity(3, 90), "3 other openings in last 90 days");

assert.equal(websiteHref("acme.com"), "https://acme.com");
assert.equal(websiteHref("https://acme.com"), "https://acme.com");
assert.equal(websiteHref(null), null);

assert.equal(reputationTone(4.2, 5), "insufficient");
assert.equal(reputationTone(4.2, 40), "good");
assert.equal(reputationTone(3.4, 40), "mixed");
assert.equal(reputationTone(2.1, 40), "poor");

console.log("company-snapshot helpers ok");
