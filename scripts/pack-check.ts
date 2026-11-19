/**
 * Checks the package as a consumer gets it (design D6). It builds the package, packs it, installs the tarball in an
 * empty project, type-checks a consumer file, and runs the entry point in Node. It fails at the first problem.
 *
 * Usage: `tsx scripts/pack-check.ts`
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { OSCAL_RELEASE } from "../src/generated/release.ts";

const repo = process.cwd();
const run = (command: string, args: string[], cwd: string) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  name: string;
  devDependencies: Record<string, string>;
};

const work = fs.mkdtempSync(path.join(os.tmpdir(), "oscal-pack-check-"));
try {
  // 1. Build.
  run("npm", ["run", "build"], repo);

  // 2. Pack, and check the file list.
  const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", work], repo)) as {
    filename: string;
    files: { path: string }[];
  }[];
  const { filename, files } = packed[0];
  const allowed = new Set(["package.json", "README.md", "LICENSE"]);
  const unexpected = files.map((f) => f.path).filter((p) => !allowed.has(p) && !p.startsWith("dist/"));
  if (unexpected.length) throw new Error(`The tarball holds files that the package does not allow: ${unexpected.join(", ")}`);

  // 3. Install the tarball in an empty ES module project.
  const project = path.join(work, "consumer");
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
  run(
    "npm",
    ["install", "--ignore-scripts", "--prefer-offline", "--no-audit", "--no-fund", path.join(work, filename), `@types/node@${pkg.devDependencies["@types/node"]}`],
    project,
  );

  // 4. Type-check a consumer file against the .d.ts files of the package.
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { target: "ES2023", lib: ["ES2023"], module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmit: true, skipLibCheck: false, types: ["node"] },
      include: ["consumer.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(project, "consumer.ts"),
    [
      'import { parseCatalog, ParseError, OSCAL_RELEASE, type SerializeOptions, type Catalog } from "oscal-bindings/v1";',
      "const options: SerializeOptions = { compact: true };",
      "declare const catalog: Catalog;",
      "const release: string = OSCAL_RELEASE;",
      "export { parseCatalog, ParseError, options, catalog, release };",
      "",
    ].join("\n"),
  );
  run(path.join(repo, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], project);

  // 5. Run the entry point in Node.
  const script = `
import assert from "node:assert/strict";
import { OSCAL_RELEASE, parse } from "oscal-bindings/v1";
const catalog = { catalog: { uuid: "8b1c0c1e-5f6a-4d0e-9a1b-0c1d2e3f4a5b", metadata: { title: "T", "last-modified": "2024-01-01T00:00:00Z", version: "1", "oscal-version": ${JSON.stringify(OSCAL_RELEASE)} } } };
assert.equal(Object.keys(parse(JSON.stringify(catalog))).join(), "catalog");
assert.equal(OSCAL_RELEASE, ${JSON.stringify(OSCAL_RELEASE)});
for (const specifier of ["oscal-bindings", "oscal-bindings/dist/parse.js"]) {
  await assert.rejects(import(specifier), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }, specifier);
}
`;
  fs.writeFileSync(path.join(project, "check.mjs"), script);
  run("node", ["check.mjs"], project);
  console.log(`pack:check passed for ${filename} (${files.length} files)`);
} finally {
  // 6. Remove the temporary directory.
  fs.rmSync(work, { recursive: true, force: true });
}
