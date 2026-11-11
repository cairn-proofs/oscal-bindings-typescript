import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHash, buildResource, buildRlink } from "../src/backmatter.ts";
import { ParseError } from "../src/errors.ts";

const uuidPattern = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[45][0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$/;

test("BMB-001.01 buildHash defaults the algorithm to SHA-256", () => {
  assert.deepEqual(buildHash("abc"), { algorithm: "SHA-256", value: "abc" });
});

test("BMB-001.02 buildHash accepts an explicit algorithm", () => {
  assert.equal(buildHash("abc", "SHA-512").algorithm, "SHA-512");
});

test("BMB-001.03 buildHash rejects an algorithm that is not a valid string and accepts an unnamed one", () => {
  assert.throws(
    () => buildHash("abc", " SHA-256"),
    (error: unknown) => {
      assert.ok(error instanceof ParseError);
      assert.ok(error.failures.some((failure) => failure.location === "/algorithm"));
      return true;
    },
  );
  assert.equal(buildHash("abc", "SHA-999").algorithm, "SHA-999");
});

test("BMB-002.01 buildRlink with only a reference has no media-type and no hashes key", () => {
  const rlink = buildRlink("https://example.com/a");
  assert.deepEqual(rlink, { href: "https://example.com/a" });
  assert.equal("media-type" in rlink, false);
  assert.equal("hashes" in rlink, false);
});

test("BMB-002.02 buildRlink carries the media type and the hashes", () => {
  const hash = buildHash("abc");
  assert.deepEqual(buildRlink("https://example.com/a", { "media-type": "text/plain", hashes: [hash] }), {
    href: "https://example.com/a",
    "media-type": "text/plain",
    hashes: [hash],
  });
});

test("BMB-003.01 buildResource generates a different valid UUID for each call", () => {
  const first = buildResource().uuid;
  const second = buildResource().uuid;
  assert.match(first, uuidPattern);
  assert.match(second, uuidPattern);
  assert.notEqual(first, second);
});

test("BMB-003.02 buildResource leaves out an omitted input and keeps a given uuid", () => {
  const resource = buildResource({ title: "t" });
  assert.equal("document-ids" in resource, false);
  assert.equal(resource.title, "t");
  const uuid = "11111111-1111-4111-8111-111111111111";
  assert.equal(buildResource({ uuid }).uuid, uuid);
});

test("BMB-003.03 buildResource rejects an invalid or empty document-ids list", () => {
  assert.throws(
    () => buildResource({ "document-ids": [{} as { identifier: string }] }),
    (error: unknown) => error instanceof ParseError && error.failures.length > 0,
  );
  assert.throws(
    () => buildResource({ "document-ids": [] }),
    (error: unknown) => error instanceof ParseError && error.failures.length > 0,
  );
});
