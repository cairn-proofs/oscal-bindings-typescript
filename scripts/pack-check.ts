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

  // 3. Install the tarball in an empty ES module project. It installs no @types/node, because the package needs none.
  const project = path.join(work, "consumer");
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
  run("npm", ["install", "--ignore-scripts", "--prefer-offline", "--no-audit", "--no-fund", path.join(work, filename)], project);

  // 4. Type-check a consumer file against the .d.ts files of the package. The CI legs use the same files.
  for (const name of ["tsconfig.json", "consumer.ts", "check.mjs"]) {
    fs.copyFileSync(path.join(repo, "test/consumer", name), path.join(project, name));
  }
  run(path.join(repo, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], project);

  // 5. Run the entry point in Node, and check that the package exports the release of src/generated/release.ts.
  run("node", ["check.mjs"], project);
  run(
    "node",
    [
      "--input-type=module",
      "-e",
      `import { OSCAL_RELEASE } from "oscal-bindings/v1"; if (OSCAL_RELEASE !== ${JSON.stringify(OSCAL_RELEASE)}) throw new Error("OSCAL_RELEASE is " + OSCAL_RELEASE);`,
    ],
    project,
  );
  console.log(`pack:check passed for ${filename} (${files.length} files)`);
} finally {
  // 6. Remove the temporary directory.
  fs.rmSync(work, { recursive: true, force: true });
}
