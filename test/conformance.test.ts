import fs from "node:fs";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import { adapter } from "./support/adapter.ts";
import { checkListedIds, type ExpectedFailures, loadCorpus, runCase, runWithExpectation } from "./support/runner.ts";

// A failed fetch or a failed hash check fails the run. It does not skip.
const corpus = loadCorpus(artifactPaths(await ensureSpecArtifact()).corpus);
const expected = JSON.parse(
  fs.readFileSync(new URL("./conformance/expected-failures.json", import.meta.url), "utf8"),
) as ExpectedFailures;

test("expected-failures.json lists only cases of the pinned corpus", () => checkListedIds(expected, corpus.cases));

for (const c of corpus.cases) {
  test(c.id, () => runWithExpectation(expected, c, () => runCase(adapter, corpus.dir, c)));
}
