import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ensureSpecArtifact, type Pin, SpecArtifactError } from "../scripts/spec-artifact.ts";

/** Builds a small archive with the layout of the spec artifact, and a pin for it. */
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-artifact-test-"));
  const top = "oscal-bindings-specs-9.9.9+oscal.1.2.3";
  fs.mkdirSync(path.join(dir, top, "manifest"), { recursive: true });
  fs.writeFileSync(path.join(dir, top, "VERSION"), "9.9.9+oscal.1.2.3\n");
  fs.writeFileSync(path.join(dir, top, "manifest", "names.json"), "{}\n");
  fs.writeFileSync(path.join(dir, top, "manifest", "unused.json"), "{}\n");
  const archive = path.join(dir, "a.tar.gz");
  execFileSync("tar", ["-czf", archive, "-C", dir, top]);
  const bytes = fs.readFileSync(archive);
  const pin: Pin = {
    version: "9.9.9+oscal.1.2.3",
    url: "https://example.invalid/a.tar.gz",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    top,
    members: ["VERSION", "manifest/names.json"],
  };
  return { dir, bytes, pin, cacheRoot: path.join(dir, "cache") };
}

test("a miss downloads once, extracts only the named members, and a hit makes no network call", async () => {
  const { bytes, pin, cacheRoot } = fixture();
  let calls = 0;
  const download = async () => {
    calls += 1;
    return bytes;
  };
  const root = await ensureSpecArtifact({ pin, cacheRoot, download });
  assert.equal(calls, 1);
  assert.equal(fs.readFileSync(path.join(root, "VERSION"), "utf8"), "9.9.9+oscal.1.2.3\n");
  assert.ok(fs.existsSync(path.join(root, "manifest", "names.json")));
  assert.ok(!fs.existsSync(path.join(root, "manifest", "unused.json")));

  const again = await ensureSpecArtifact({
    pin,
    cacheRoot,
    download: async () => assert.fail("a cache hit must not download"),
  });
  assert.equal(again, root);
});

test("a sha256 mismatch fails and publishes nothing", async () => {
  const { bytes, pin, cacheRoot } = fixture();
  const changed = Buffer.concat([bytes, Buffer.from([0])]);
  await assert.rejects(
    ensureSpecArtifact({ pin, cacheRoot, download: async () => changed }),
    (error: unknown) => error instanceof SpecArtifactError && /sha256 mismatch/.test(error.message),
  );
  assert.ok(!fs.existsSync(cacheRoot) || fs.readdirSync(cacheRoot).length === 0);
});

test("a fetch failure fails and publishes nothing", async () => {
  const { pin, cacheRoot } = fixture();
  await assert.rejects(
    ensureSpecArtifact({
      pin,
      cacheRoot,
      download: async () => {
        throw new SpecArtifactError("cannot download: HTTP 404");
      },
    }),
    SpecArtifactError,
  );
  assert.ok(!fs.existsSync(cacheRoot));
});

test("a member that is not in the archive fails and publishes nothing", async () => {
  const { bytes, pin, cacheRoot } = fixture();
  const missing = { ...pin, members: [...pin.members, "manifest/absent.json"] };
  await assert.rejects(ensureSpecArtifact({ pin: missing, cacheRoot, download: async () => bytes }), SpecArtifactError);
  assert.deepEqual(fs.readdirSync(cacheRoot), []);
});
