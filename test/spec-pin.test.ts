/**
 * The README sticker of oscal-bindings-specs reads spec-pin.json. The pin of the binding is SPEC_ARTIFACT_VERSION in
 * scripts/spec-artifact.ts, so a pin that moves without spec-pin.json makes the sticker show the wrong version.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { SPEC_ARTIFACT_VERSION } from "../scripts/spec-artifact.ts";
test("spec-pin.json holds the pinned spec artifact version", () => {
  const pin = JSON.parse(fs.readFileSync("spec-pin.json", "utf8")) as { version?: string };
  assert.equal(pin.version, SPEC_ARTIFACT_VERSION, "Update spec-pin.json in the commit that moves the pin.");
});
