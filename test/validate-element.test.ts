import assert from "node:assert/strict";
import { test } from "node:test";
import { LimitExceededError, OscalError, ParseError, UnknownElementTypeError } from "../src/errors.ts";
import { supportedElementTypes, validateElement } from "../src/validate-element.ts";

test("supportedElementTypes returns a sorted list of kebab-case names that holds back-matter (ELV-002)", () => {
  const names = supportedElementTypes();
  assert.ok(names.length > 0);
  assert.deepEqual(names, [...names].sort());
  for (const name of names) assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(names.includes("back-matter"));
  assert.equal(supportedElementTypes(), names);
});

test("an invalid element gives one entry for each failing location, from the root of the element (ELV-001)", () => {
  const result = validateElement("observation", {});
  assert.equal(result.valid, false);
  const locations = result.failures.map((entry) => entry.location);
  assert.ok(result.failures.length >= 2);
  assert.equal(new Set(locations).size, locations.length);
  for (const location of locations) assert.match(location, /^\/[^/]+/);
  assert.ok(locations.includes("/uuid"));
  assert.ok(locations.includes("/description"));
});

test("an unknown element type throws an UnknownElementTypeError that names the type (ELV-003, ERR-008)", () => {
  assert.throws(
    () => validateElement("no-such-type", {}),
    (e) =>
      e instanceof UnknownElementTypeError &&
      e instanceof OscalError &&
      e.category === "unknown-element-type" &&
      e.elementType === "no-such-type" &&
      e.message.includes("no-such-type"),
  );
});

test("ERR-011.01 a value deeper than 250 levels is a limit-exceeded error that names the limit", () => {
  let deep: unknown = {};
  for (let i = 0; i < 300; i++) deep = [deep];
  assert.throws(
    () => validateElement("observation", deep),
    (e) =>
      e instanceof LimitExceededError &&
      e.category === "limit-exceeded" &&
      e.limit === "nesting-depth" &&
      /limit of 250/.test(e.message),
  );
  const loop: Record<string, unknown> = {};
  loop.self = loop;
  assert.throws(
    () => validateElement("observation", loop),
    (e) => e instanceof LimitExceededError && e.limit === "nesting-depth",
  );
});

test("ERR-011.02 the limit-exceeded error is not a parse error", () => {
  let deep: unknown = {};
  for (let i = 0; i < 300; i++) deep = [deep];
  assert.throws(
    () => validateElement("observation", deep),
    (e) => e instanceof OscalError && !(e instanceof ParseError),
  );
});
