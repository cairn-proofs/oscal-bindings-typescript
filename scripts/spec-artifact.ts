/**
 * The pinned spec artifact of the OSCAL bindings contract, published by cairn-proofs/oscal-bindings-specs.
 *
 * The sha256 is the pin. The tag only names the release. To move to a new artifact, change the version and the
 * sha256 together. The archive is checked before any file leaves it, and only the named members are extracted, so a
 * member path cannot point outside the cache.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

export const SPEC_ARTIFACT_VERSION = "0.2.0+oscal.1.2.3";
export const SPEC_ARTIFACT_SHA256 = "3bc746e8a6182a612c2a8f397e0ee7a47b2d777108f93df81dcd139ee59b271e";
/** The OSCAL release, from the build metadata of the version. */
export const OSCAL_RELEASE = SPEC_ARTIFACT_VERSION.split("+oscal.")[1];

const urlVersion = SPEC_ARTIFACT_VERSION.replace("+", "%2B");
export const SPEC_ARTIFACT_URL =
  `https://github.com/cairn-proofs/oscal-bindings-specs/releases/download/v${urlVersion}/` +
  `oscal-bindings-specs-${urlVersion}.tar.gz`;

/** The top directory of every member of the archive. */
const TOP = `oscal-bindings-specs-${SPEC_ARTIFACT_VERSION}`;

/** The members that this repo uses, relative to the top directory. Directories extract with their content. */
export const MEMBERS = [
  "VERSION",
  `schemas/${OSCAL_RELEASE}/oscal_complete_schema.json`,
  `manifest/${OSCAL_RELEASE}/names.json`,
  "manifest/names.schema.json",
  `corpus/${OSCAL_RELEASE}/documents`,
] as const;

export const DEFAULT_CACHE_ROOT = path.resolve(".cache/spec-artifact");

export class SpecArtifactError extends Error {}

export interface Pin {
  version: string;
  url: string;
  sha256: string;
  top: string;
  members: readonly string[];
}

export const PIN: Pin = {
  version: SPEC_ARTIFACT_VERSION,
  url: SPEC_ARTIFACT_URL,
  sha256: SPEC_ARTIFACT_SHA256,
  top: TOP,
  members: MEMBERS,
};

export interface EnsureOptions {
  pin?: Pin;
  cacheRoot?: string;
  /** Replaceable for tests. Returns the bytes of the archive. */
  download?: (url: string) => Promise<Buffer>;
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function httpsDownload(url: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    throw new SpecArtifactError(`cannot download ${url}: ${(error as Error).message}`);
  }
  if (!response.ok) throw new SpecArtifactError(`cannot download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Returns the root directory of the cached, hash-checked artifact. A cache hit makes no network call. On a miss, the
 * function downloads the archive, checks its sha256, extracts the named members into a temporary directory, and then
 * renames that directory into place, so a failed run publishes nothing.
 */
export async function ensureSpecArtifact(options: EnsureOptions = {}): Promise<string> {
  const pin = options.pin ?? PIN;
  const cacheRoot = options.cacheRoot ?? DEFAULT_CACHE_ROOT;
  const download = options.download ?? httpsDownload;
  const target = path.join(cacheRoot, `${pin.version}-${pin.sha256.slice(0, 12)}`);
  if (fs.existsSync(path.join(target, ".complete"))) return target;

  const bytes = await download(pin.url);
  const actual = sha256(bytes);
  if (actual !== pin.sha256) {
    throw new SpecArtifactError(`sha256 mismatch for ${pin.url}: expected ${pin.sha256}, got ${actual}`);
  }

  fs.mkdirSync(cacheRoot, { recursive: true });
  const work = fs.mkdtempSync(path.join(cacheRoot, ".tmp-"));
  try {
    const archive = path.join(work, "archive.tar.gz");
    fs.writeFileSync(archive, bytes);
    const out = path.join(work, "out");
    fs.mkdirSync(out);
    const members = pin.members.map((m) => `${pin.top}/${m}`);
    try {
      // Argument array, no shell. "--" ends the options, so no member name can act as a flag.
      await promisify(execFile)("tar", ["-xzf", archive, "-C", out, "--", ...members]);
    } catch (error) {
      throw new SpecArtifactError(`cannot extract ${members.join(", ")}: ${(error as Error).message}`);
    }
    const root = path.join(out, pin.top);
    fs.writeFileSync(path.join(root, ".complete"), `${pin.sha256}\n`);
    fs.rmSync(target, { recursive: true, force: true });
    try {
      fs.renameSync(root, target);
    } catch (error) {
      // node --test runs test files in parallel, so another process can publish the same checked artifact first.
      if (!fs.existsSync(path.join(target, ".complete"))) throw error;
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  return target;
}

/** The paths of the files that this repo reads, inside an artifact root. */
export function artifactPaths(root: string) {
  return {
    version: path.join(root, "VERSION"),
    schema: path.join(root, "schemas", OSCAL_RELEASE, "oscal_complete_schema.json"),
    names: path.join(root, "manifest", OSCAL_RELEASE, "names.json"),
    namesSchema: path.join(root, "manifest", "names.schema.json"),
    documents: path.join(root, "corpus", OSCAL_RELEASE, "documents"),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = await ensureSpecArtifact();
  console.log(root);
}
