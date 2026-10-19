/**
 * Lists the manifest names that are also global types or values of TypeScript's ES2023 and DOM libraries
 * (design.md D6). It uses the pinned compiler, not a hand-kept list of globals.
 *
 * The probe is a script file, not a module, with one `type` alias per name. A name that compiles without
 * "Cannot find name" is a global. A second compile of the generated module with DOM in `lib` shows that the exported
 * names shadow the globals without an error.
 *
 * Run it with `npm run global-names`, so that `tsc` resolves to the pinned compiler in node_modules/.bin.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { Manifest } from "./manifest.ts";
import { artifactPaths, ensureSpecArtifact } from "./spec-artifact.ts";

const LIB = ["ES2023", "DOM"];
const PROBE_DIR = path.resolve(".cache/global-names");

/** Runs tsc and returns its exit code and output. A type error is a normal result here, not an exception. */
async function tsc(args: string[]): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await promisify(execFile)("tsc", args, { maxBuffer: 16 * 1024 * 1024 });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    if (typeof e.code !== "number") throw error;
    return { code: e.code, output: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

export async function globalNames(): Promise<{ globals: string[]; shadowOk: boolean; shadowOutput: string }> {
  const manifest = JSON.parse(fs.readFileSync(artifactPaths(await ensureSpecArtifact()).names, "utf8")) as Manifest;
  const names = manifest.types.map((e) => e.name);

  fs.rmSync(PROBE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  // Line 2N + 1 probes names[N] as a type, and line 2N + 2 probes it as a value. A name is a global when either
  // line finds it.
  const lines = names.flatMap((n, i) => [`type ProbeType${i} = ${n};`, `type ProbeValue${i} = typeof ${n};`]);
  fs.writeFileSync(path.join(PROBE_DIR, "probe.ts"), `${lines.join("\n")}\n`);
  fs.writeFileSync(
    path.join(PROBE_DIR, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { lib: LIB, noEmit: true, types: [], strict: true }, files: ["probe.ts"] }),
  );
  const probe = await tsc(["-p", path.join(PROBE_DIR, "tsconfig.json")]);
  // A line misses its name when tsc reports "Cannot find name": TS2304, or TS2552 when tsc also suggests a similar
  // name. Other errors (for example TS2314, a generic type without type arguments) mean that the name was found.
  const missingLines = new Set<number>();
  for (const m of probe.output.matchAll(/probe\.ts\((\d+),\d+\): error TS(?:2304|2552):/g)) missingLines.add(Number(m[1]));
  const globals = names.filter((_, i) => !missingLines.has(2 * i + 1) || !missingLines.has(2 * i + 2));

  const shadow = await tsc(["-p", "tsconfig.types.json", "--lib", LIB.join(",")]);
  return { globals, shadowOk: shadow.code === 0, shadowOutput: shadow.output };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { globals, shadowOk, shadowOutput } = await globalNames();
  console.log(`manifest names that are ${LIB.join(" + ")} globals: ${globals.join(", ") || "(none)"}`);
  if (!shadowOk) {
    console.error(`the generated module does not compile with lib ${LIB.join(",")}:\n${shadowOutput}`);
    process.exit(1);
  }
  console.log(`the generated module and the type tests compile with lib ${LIB.join(",")}`);
}
