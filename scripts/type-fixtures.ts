/**
 * Writes the corpus documents as TypeScript type tests under test/types/corpus/ (design.md D5).
 *
 * A valid document becomes an object literal that `satisfies` its document wrapper type. The wrapper is the manifest
 * entry of kind `document` whose body field is the top-level key of the document. An invalid document that fails for
 * its shape becomes one line after `// @ts-expect-error`, so the compile fails when the types accept it.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Manifest } from "./manifest.ts";
import { artifactPaths, ensureSpecArtifact } from "./spec-artifact.ts";

export const FIXTURES = path.resolve("test/types/corpus");

/** The invalid corpus documents whose failure is a shape failure, which a type can express. */
export const SHAPE_FAILURES = [
  "unknown-root",
  "unknown-field-top",
  "unknown-field-nested",
  "name-keyed-field",
  "missing-required-field",
  "two-failures",
] as const;

const IMPORT = `import type * as oscal from "../../../src/generated/oscal.ts";\n`;

export async function writeFixtures(): Promise<string[]> {
  const paths = artifactPaths(await ensureSpecArtifact());
  const manifest = JSON.parse(fs.readFileSync(paths.names, "utf8")) as Manifest;
  const wrapperOf = new Map(
    manifest.types.filter((e) => e.kind === "document").map((e) => [e["body-field"]!, e.name] as const),
  );
  const unionName = manifest.types.find((e) => e.kind === "document-union")!.name;

  fs.rmSync(FIXTURES, { recursive: true, force: true });
  fs.mkdirSync(FIXTURES, { recursive: true });
  const written: string[] = [];

  const validDir = path.join(paths.documents, "valid");
  for (const file of fs.readdirSync(validDir).filter((f) => f.endsWith(".json")).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(validDir, file), "utf8")) as Record<string, unknown>;
    const bodies = Object.keys(doc).filter((k) => k !== "$schema");
    const wrapper = bodies.length === 1 ? wrapperOf.get(bodies[0]) : undefined;
    if (!wrapper) throw new Error(`valid/${file}: no document wrapper for the keys ${bodies.join(", ")}`);
    const out = path.join(FIXTURES, `valid-${path.basename(file, ".json")}.ts`);
    fs.writeFileSync(out, `${IMPORT}\nexport const doc = ${JSON.stringify(doc, null, 2)} satisfies oscal.${wrapper};\n`);
    written.push(out);
  }

  for (const name of SHAPE_FAILURES) {
    const doc = JSON.parse(fs.readFileSync(path.join(paths.documents, "invalid", `${name}.json`), "utf8")) as unknown;
    const out = path.join(FIXTURES, `invalid-${name}.ts`);
    // One line: the directive covers exactly the next line, so the error must be on it.
    fs.writeFileSync(
      out,
      `${IMPORT}\n// @ts-expect-error The schema rejects this document for its shape.\n` +
        `export const doc = ${JSON.stringify(doc)} satisfies oscal.${unionName};\n`,
    );
    written.push(out);
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const written = await writeFixtures();
  console.log(`wrote ${written.length} type fixtures to ${path.relative(process.cwd(), FIXTURES)}`);
}
