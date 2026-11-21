import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import { adapter } from "./support/adapter.ts";
import { checkListedIds, EXPECTED_FAILURES, loadCorpus, runCase, runWithExpectation, unofferedReason } from "./support/runner.ts";

// A failed fetch or a failed hash check fails the run. It does not skip.
const corpus = loadCorpus(artifactPaths(await ensureSpecArtifact()).corpus);

test("expected-failures.json lists only cases of the pinned corpus", () => checkListedIds(EXPECTED_FAILURES, corpus.cases));

for (const c of corpus.cases) {
  const reason = unofferedReason(c);
  if (reason !== undefined) {
    test(c.id, { skip: `the binding does not offer ${c.operation}: ${reason}` }, () => {});
    continue;
  }
  test(c.id, () => runWithExpectation(EXPECTED_FAILURES, c, () => runCase(adapter, corpus.dir, c)));
}
