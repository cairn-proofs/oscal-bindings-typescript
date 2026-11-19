# Performance of oscal-bindings (TypeScript)
This file holds the performance numbers of the project. The documents are the valid and invalid documents of the pinned spec artifact corpus. The largest valid document is 21.6 KiB, so the numbers describe small and medium documents.
Times depend on the machine, so compare ratios, and measure again on your own machine before you decide. The numbers below are one run of `npm run bench`.
## Contents
- [Results](#results)
- [How to measure](#how-to-measure)
## Results
Node 26.13.0 on darwin arm64, Apple M4 Max. Spec artifact 0.8.0+oscal.1.2.3.

### Parse, valid input

| Case | Size | Median | Ops/s | Throughput | ±% | Allocated/op | Retained/doc |
|---|---:|---:|---:|---:|---:|---:|---:|
| minimal-catalog | 235 B | 1.3 µs | 792,189 | 186.2 MB/s | 1.1 | 2.6 KiB | 269 B |
| mapping-collection | 1.4 KiB | 3.7 µs | 267,989 | 392.6 MB/s | 1.4 | 6.5 KiB | 1.3 KiB |
| profile | 1.8 KiB | 4.3 µs | 230,144 | 417.5 MB/s | 1.0 | 8.0 KiB | 2.0 KiB |
| component-definition | 4.0 KiB | 7.6 µs | 131,138 | 533.3 MB/s | 1.3 | 10.3 KiB | 4.1 KiB |
| assessment-plan | 8.3 KiB | 14.0 µs | 71,566 | 609.4 MB/s | 1.0 | 21.6 KiB | 8.8 KiB |
| plan-of-action-and-milestones | 13.7 KiB | 22.5 µs | 44,418 | 625.0 MB/s | 1.1 | 36.0 KiB | 14.1 KiB |
| assessment-results | 13.8 KiB | 21.6 µs | 46,292 | 654.0 MB/s | 1.4 | 32.7 KiB | 14.2 KiB |
| catalog | 15.5 KiB | 22.1 µs | 45,224 | 719.0 MB/s | 1.5 | 31.8 KiB | 16.4 KiB |
| system-security-plan | 21.6 KiB | 38.2 µs | 26,183 | 578.4 MB/s | 1.3 | 49.3 KiB | 23.1 KiB |

### Serialize, valid input

| Case | Size | Median | Ops/s | Throughput | ±% | Allocated/op |
|---|---:|---:|---:|---:|---:|---:|
| minimal-catalog | 234 B | 0.3 µs | 3,960,043 | 926.6 MB/s | 1.6 | 257 B |
| mapping-collection | 1.4 KiB | 1.6 µs | 621,845 | 909.8 MB/s | 4.2 | 1.5 KiB |
| profile | 1.8 KiB | 1.6 µs | 610,562 | 1106.9 MB/s | 2.5 | 1.8 KiB |
| component-definition | 4.0 KiB | 2.9 µs | 346,571 | 1409.2 MB/s | 1.6 | 4.0 KiB |
| assessment-plan | 8.3 KiB | 6.7 µs | 148,541 | 1264.7 MB/s | 2.4 | 8.6 KiB |
| plan-of-action-and-milestones | 13.7 KiB | 9.1 µs | 109,303 | 1537.8 MB/s | 3.6 | 14.3 KiB |
| assessment-results | 13.8 KiB | 14.9 µs | 67,289 | 950.6 MB/s | 2.3 | 14.3 KiB |
| catalog | 15.5 KiB | 15.8 µs | 63,487 | 1009.3 MB/s | 1.2 | 32.1 KiB |
| system-security-plan | 21.6 KiB | 46.9 µs | 21,312 | 470.8 MB/s | 0.8 | 51.4 KiB |
| minimal-catalog (compact) | 177 B | 0.1 µs | 7,042,071 | 1246.4 MB/s | 3.2 | 200 B |
| mapping-collection (compact) | 894 B | 0.5 µs | 2,151,147 | 1923.1 MB/s | 1.0 | 915 B |
| profile (compact) | 1.1 KiB | 0.5 µs | 1,922,823 | 2084.3 MB/s | 0.8 | 1.1 KiB |
| component-definition (compact) | 2.8 KiB | 0.8 µs | 1,241,584 | 3596.9 MB/s | 1.5 | 2.9 KiB |
| assessment-plan (compact) | 5.9 KiB | 1.8 µs | 557,718 | 3351.9 MB/s | 1.2 | 6.0 KiB |
| plan-of-action-and-milestones (compact) | 10.4 KiB | 2.6 µs | 382,600 | 4091.9 MB/s | 0.8 | 10.7 KiB |
| assessment-results (compact) | 10.4 KiB | 2.6 µs | 386,890 | 4132.4 MB/s | 0.6 | 10.7 KiB |
| catalog (compact) | 10.4 KiB | 7.1 µs | 141,424 | 1502.3 MB/s | 1.3 | 21.3 KiB |
| system-security-plan (compact) | 13.6 KiB | 6.9 µs | 145,667 | 2030.3 MB/s | 0.8 | 28.5 KiB |

### Parse, invalid input

| Case | Size | Median | Ops/s | ±% | Allocated/op |
|---|---:|---:|---:|---:|---:|
| not-json | 69 B | 3.5 µs | 283,592 | 1.3 | 1.8 KiB |
| invalid-utf8 | 236 B | 3.4 µs | 292,380 | 1.1 | 1.4 KiB |
| unknown-root | 88 B | 2.2 µs | 463,159 | 0.8 | 1.4 KiB |
| missing-required-field | 201 B | 3.7 µs | 266,915 | 0.9 | 5.7 KiB |
| two-failures | 177 B | 3.8 µs | 262,993 | 1.5 | 6.3 KiB |
| many-failures | 4.5 KiB | 41.9 µs | 23,844 | 3.5 | 136.6 KiB |
| wrong-document-type (parseCatalog on a profile) | 1.8 KiB | 4.7 µs | 213,740 | 1.2 | 5.3 KiB |
| over-depth-limit (300 levels) | 600 B | 11.5 µs | 87,102 | 0.8 | 34.2 KiB |

### First call and process memory

| Measure | Value |
|---|---:|
| First parse in the process (catalog, compiles its validators) | 169.9 ms |
| First parse of a second document type (profile) | 3.8 ms |
| Peak resident memory of the process | 249.3 MiB |

Allocated/op is the V8 heap that one call allocates. Retained/doc is the heap that one parsed document keeps after a garbage collection. Peak resident memory covers the whole process, including this script. `serialize` has no error path.
## How to measure

`npm run bench` measures `parse` and `serialize` on the documents of the pinned corpus. It prints Markdown tables that
you can paste into a pull request. It is not part of `npm run check`, because the times depend on the machine.

For each case it reports the median time of one call, the throughput, and the V8 heap that one call allocates. For
`parse` of a valid document it also reports the heap that the parsed document keeps. It covers the happy path (the nine
valid documents, and `serialize` with and without `compact`) and the error path (the invalid documents of the corpus, a
document of the wrong type, and an input over the depth limit). `serialize` has no error path. The tables also give the
time of the first parse, which compiles the validators, and the peak memory of the process.

To measure the effect of a pull request, run both builds on the same machine with nothing else busy:

```sh
git switch main && npm run bench -- --json tmp/base.json
git switch my-branch && npm run bench -- --baseline tmp/base.json
```

The second run adds the change from the baseline to each row. A time change is bold when it is over 10% and over the
spread of both runs. An allocation change is bold when it is over 2%. Time varies from run to run on one machine, so
run again before you act on one bold time. Allocation does not vary, so it is the best signal for a small change. Add
`--json <file>` to save a run, and `--quick` for a short run that checks the script and gives no usable numbers.
