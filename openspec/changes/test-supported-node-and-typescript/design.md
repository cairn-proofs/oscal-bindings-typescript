# Design

## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `scripts/pack-check.ts` builds the package, packs it, and installs the tarball in an empty project. It writes the
   consumer files (`package.json`, `tsconfig.json`, `consumer.ts` and `check.mjs`) inline. It type-checks with the
   repository `tsc` 7.0.2, and it installs `@types/node` at the pinned version for `types: ["node"]`.
2. The `.d.ts` files of the package do not refer to Node types. The consumer type check does not need `@types/node`.
3. `scripts/pack-check.ts` runs with `tsx` and needs the development dependencies of the repository.
4. `.github/workflows/build.yml` installs Node with `jdx/mise-action` from `mise.toml` and `mise.lock`. The action adds
   `--locked`, and the lockfile records only Node 26.13.0.
5. The `package` job of `build.yml` packs the tarball only on a `v*` tag, and it needs the `build` job.
6. The ruleset "main: require PR and CI" requires one status check, `build`. A required check matches the name of the
   job, and for a matrix job that name includes the matrix values.
7. `RegExp.escape` exists on Node 24.22.0 and not on Node 22.12.0. The repository `lib` is `ES2023`, so `tsc` rejects
   a direct call to `RegExp.escape`.
8. `pack-check.ts` writes `check.mjs` from a template. The template puts the `OSCAL_RELEASE` of
   `src/generated/release.ts` into the sample document and into an assertion that the package exports the same value.
9. `tsc` 7.0.2 keeps `/// <reference lib="es2025" preserve="true" />` in the `.d.ts` that it writes. TypeScript 5.9.3
   rejects that reference with TS2727, and TypeScript 6.0.3 accepts it.
10. `build.yml` cancels the run of a superseded pull request commit.

## Goals / Non-Goals

**Goals:**

1. The legs test the files that a consumer installs: the tarball, its dependencies as npm resolves them, the Node of
   the leg and the `tsc` of the leg.
2. `pack:check` and the legs use the same consumer files.

**Non-Goals:**

1. Operating systems other than `ubuntu-latest`.
2. Node 23 and Node 25. `engines` includes them, but they are at end of life.

## Decisions

### D1: The consumer files move to `test/consumer/`

`test/consumer/` holds three files: `tsconfig.json`, `consumer.ts` and `check.mjs`. They hold the content that
`pack-check.ts` writes now, with two differences:

1. `tsconfig.json` sets `types: []` and the project installs no `@types/node` (Context item 2). `consumer.ts` uses no
   Node API. `check.mjs` is JavaScript, so `tsc` does not check it.
2. `check.mjs` is a static file (Context item 8). It puts the `OSCAL_RELEASE` that it imports from the package into the
   sample document. It does not hold a release value.

`pack-check.ts` copies the three files into its temporary project. It still type-checks with the repository `tsc`.
After `node check.mjs`, it runs one more Node command that imports `OSCAL_RELEASE` from the package and fails when the
value differs from `src/generated/release.ts`. The legs do not run that command, because they have no `src/`.
The root `tsconfig.json` excludes `test/consumer/**`, because `consumer.ts` imports `oscal-bindings/v1`, which does not
resolve inside the repository.

**Why:** the legs run on Node 22 without the repository development dependencies, so they cannot run `pack-check.ts`
(Context item 3). Shared files keep one copy of the consumer checks. With `@types/node` in the project, a TypeScript 5.9
leg can fail on a `@types/node` declaration and not on the package.

**Alternative:** a plain JavaScript script that does the install, the run and the type check, which both `pack-check.ts`
and the legs call. The legs must report the run and the type check as separate steps, so the script needs subcommands.
Workflow steps do the same work with less code.

### D2: A `consumer-package` job packs the tarball once

A new job, `consumer-package`, runs on each run of `build.yml` except a `v*` tag. It has no `needs`, so it runs in
parallel with `build`. It installs the toolchain with `jdx/mise-action`, runs `npm ci`, `npm run build` and `npm pack`,
and uploads the tarball as the artifact `consumer-package`.

**Why:** the legs must not wait for the check gate, and they must not build the package again. The tag-only `package`
job needs `build` (Context item 5), so a leg that used it would start only after the gate.

**Alternative:** remove the tag condition from `package`. Its `needs` on `build` and `tag-check` would then put the gate
in front of each leg.

### D3: A `consumer` matrix job runs the three legs

The job `consumer` needs `consumer-package` and does not run on a `v*` tag. It sets `fail-fast: false`. Each matrix
entry gives a Node line, a TypeScript line, an exact Node version, the sha256 of the `linux-x64` Node tarball of that
version from nodejs.org, and an exact TypeScript version:

| Leg | Lines (check name) | Node | TypeScript |
|---|---|---|---|
| 1 | `node 22, ts 5.9` | 22.12.0 | 5.9.3 |
| 2 | `node 24, ts 6.0` | latest 24.x when the change is applied | 6.0.3 |
| 3 | `node 26, ts 7.0` | 26.13.0, as in `mise.toml` | 7.0.2, as in `package.json` |

The job name is `consumer (node <line>, ts <line>)`, from the lines only. Each leg has these steps:

1. Check out `test/consumer/` only.
2. Restore the Node tarball of the leg from `actions/cache`, with a key that holds the Node version and its sha256.
   When the file is missing, or fails the sha256 check, download it from `https://nodejs.org/dist/` with `curl
   --retry 3`. Stop the job when the sha256 of the file differs from the matrix value. Extract it, and put its `bin`
   directory first on `PATH`.
3. Download the `consumer-package` artifact.
4. Copy `test/consumer/` to an empty directory. Write a `package.json` with `"type": "module"`. Install the tarball and
   `typescript@<exact version>` with `npm install --ignore-scripts --no-audit --no-fund`.
5. "Run on Node": run `node check.mjs`.
6. "Type-check with TypeScript": run the installed `tsc -p tsconfig.json`. The step runs when step 4 succeeds, also
   when step 5 fails, so each leg always reports both results.

**Why:** leg 1 uses the floor of `engines` exactly, so a Node API that is newer than 22.12.0 turns leg 1 red. Exact
versions keep a run reproducible. A check name from the lines only does not change when a patch version moves, so the
ruleset stays valid (Context item 6). A sha256 for each Node version keeps the checksum pin that `mise.lock` gives the
pinned toolchain. `jdx/mise-action` cannot install a Node version that `mise.lock` does not record (Context item 4).

**Alternative:** a moving version such as `22` for each leg. It does not test the floor, and a Node release can turn a
leg red with no change in the repository.

The sha256 check runs on each run, so a cache entry that is wrong cannot change the Node that a leg uses. The cache
and the retry lower the number of runs that a failed download from nodejs.org turns red.

**Alternative:** `actions/setup-node`, pinned by commit. It does not check a sha256 of the Node binary that it
installs.

**Alternative:** a `mise.toml` and a lockfile for each leg. It gives the same checksum pins, but it adds three
configurations to keep in step.

### D4: The legs resolve dependencies as a consumer does

The leg project has no lockfile. npm resolves `ajv`, `ajv-formats` and `yaml` from the ranges in the published
`package.json`, as it does for a consumer.

**Why:** Goal 1. A lockfile would test a dependency set that no consumer gets.

### D5: The TypeScript minimum is documented, not declared

The README states TypeScript 5.9 or later and has a static badge `TypeScript >=5.9`. `package.json` gets no
`peerDependencies` entry for `typescript`.

**Why:** a JavaScript consumer does not need TypeScript. A peer dependency would make npm install TypeScript, or warn,
for each consumer.

## Risks / Trade-offs

1. [A new release of `ajv`, `ajv-formats` or `yaml` turns all legs red with no change in the repository] → This is the
   failure that a consumer gets on the same day. The legs report it, and a change fixes the package or its ranges.
2. [A change renames a leg, and the ruleset still requires the old name, so the new leg is not required] →
   `DEVELOPING.md` states that a change to the lines of a leg also changes the ruleset.
3. [A failing leg does not show by itself whether Node or TypeScript caused the failure] → Each leg reports the run and
   the type check as separate steps (D3).

## Migration Plan

1. Before the merge, two draft pull requests check that a deliberate break turns only the affected leg red. Each draft
   holds one break, so the run of one break does not cancel or hide the other (Context item 10):
   1. A top-level statement in `src/parse.ts` calls `RegExp.escape` through a cast that `tsc` accepts, for example
      `(RegExp as unknown as { escape(s: string): string }).escape("a")`. The import of the entry point runs it. Leg 1
      turns red on "Run on Node", and its "Type-check with TypeScript" step stays green (Context item 7).
   2. `/// <reference lib="es2025" preserve="true" />` at the top of `src/parse.ts`. Leg 1 turns red on "Type-check
      with TypeScript", and its "Run on Node" step stays green (Context item 9).

   Legs 2 and 3 stay green in both drafts. The drafts are closed and not merged.
2. After the merge, a maintainer adds the three check names of D3 to the ruleset "main: require PR and CI".
3. Rollback: revert the commit, and remove the three checks from the ruleset.
