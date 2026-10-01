import assert from "node:assert/strict";
import test from "node:test";
import { redirect } from "next/navigation";
import { errorMessage, settleAction } from "../src/lib/server-action";

test("a finished action returns its data", async () => {
  const result = await settleAction("test.ok", async () => ({ id: "x" }));
  assert.deepEqual(result, { ok: true, data: { id: "x" } });
});

test("the mutation finishes before the action settles", async () => {
  const order: string[] = [];
  const result = await settleAction("test.order", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    order.push("mutation");
    order.push("revalidate");
  });
  order.push("settled");
  assert.equal(result.ok, true);
  assert.deepEqual(order, ["mutation", "revalidate", "settled"]);
});

test("a thrown error becomes a readable message", async () => {
  const result = await settleAction("test.fail", async () => {
    throw new Error("Lead not found");
  });
  assert.deepEqual(result, { ok: false, error: "Lead not found" });
  assert.equal(errorMessage("plain"), "plain");
});

test("redirect is rethrown, not reported as an action error", async () => {
  await assert.rejects(
    settleAction("test.redirect", async () => redirect("/welcome")),
    (err: unknown) => (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") === true,
  );
});
