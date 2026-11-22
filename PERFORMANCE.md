# Performance of oscal-bindings (TypeScript)
This file holds the performance numbers of the project. The documents are the valid and invalid documents of the pinned spec artifact corpus. The largest valid document is 21.6 KiB, so the numbers describe small and medium documents.
Times depend on the machine, so compare ratios, and measure again on your own machine before you decide. The numbers below are one run of `npm run bench`.
## Contents
- [Results](#results)
- [How to measure](#how-to-measure)
## Results
Node 26.13.0 on darwin arm64, Apple M4 Max. Spec artifact 0.9.0+oscal.1.2.3.

### Parse, valid input

| Case | Size | Median | Ops/s | Throughput | ±% | Allocated/op | Retained/doc |
|---|---:|---:|---:|---:|---:|---:|---:|
| minimal-catalog | 235 B | 61.5 µs | 16,267 | 3.8 MB/s | 2.5 | 186.2 KiB | 270 B |
| mapping-collection | 1.4 KiB | 67.7 µs | 14,761 | 21.6 MB/s | 5.2 | 201.2 KiB | 1.3 KiB |
| profile | 1.8 KiB | 69.5 µs | 14,378 | 26.1 MB/s | 3.2 | 198.7 KiB | 2.0 KiB |
| component-definition | 4.0 KiB | 90.4 µs | 11,066 | 45.0 MB/s | 2.6 | 265.3 KiB | 4.1 KiB |
| assessment-plan | 8.3 KiB | 100 µs | 9,955 | 84.8 MB/s | 8.2 | 297.3 KiB | 8.8 KiB |
| plan-of-action-and-milestones | 13.7 KiB | 126 µs | 7,906 | 111.2 MB/s | 4.3 | 335.7 KiB | 14.1 KiB |
| assessment-results | 13.8 KiB | 126 µs | 7,916 | 111.8 MB/s | 2.1 | 348.8 KiB | 14.2 KiB |
| catalog | 15.5 KiB | 172 µs | 5,801 | 92.2 MB/s | 2.0 | 530.3 KiB | 15.3 KiB |
| system-security-plan | 21.6 KiB | 200 µs | 5,002 | 110.5 MB/s | 8.8 | 646.0 KiB | 24.0 KiB |

### Serialize, valid input

| Case | Size | Median | Ops/s | Throughput | ±% | Allocated/op |
|---|---:|---:|---:|---:|---:|---:|
| minimal-catalog | 234 B | 0.2 µs | 4,086,976 | 956.4 MB/s | 1.0 | 257 B |
| mapping-collection | 1.4 KiB | 1.6 µs | 627,758 | 918.4 MB/s | 3.8 | 1.5 KiB |
| profile | 1.8 KiB | 1.6 µs | 617,214 | 1119.0 MB/s | 3.8 | 1.8 KiB |
| component-definition | 4.0 KiB | 2.7 µs | 369,548 | 1502.6 MB/s | 1.7 | 4.0 KiB |
| assessment-plan | 8.3 KiB | 6.8 µs | 147,868 | 1259.0 MB/s | 4.8 | 8.6 KiB |
| plan-of-action-and-milestones | 13.7 KiB | 9.1 µs | 110,250 | 1551.1 MB/s | 4.2 | 14.2 KiB |
| assessment-results | 13.8 KiB | 14.3 µs | 69,826 | 986.4 MB/s | 2.5 | 14.3 KiB |
| catalog | 15.5 KiB | 15.5 µs | 64,433 | 1024.4 MB/s | 0.9 | 32.1 KiB |
| system-security-plan | 21.6 KiB | 45.7 µs | 21,862 | 482.9 MB/s | 1.1 | 51.3 KiB |
| minimal-catalog (compact) | 177 B | 0.1 µs | 7,619,387 | 1348.6 MB/s | 1.5 | 200 B |
| mapping-collection (compact) | 894 B | 0.5 µs | 2,191,884 | 1959.5 MB/s | 1.2 | 914 B |
| profile (compact) | 1.1 KiB | 0.5 µs | 1,993,665 | 2161.1 MB/s | 1.2 | 1.1 KiB |
| component-definition (compact) | 2.8 KiB | 0.8 µs | 1,276,759 | 3698.8 MB/s | 0.8 | 2.9 KiB |
| assessment-plan (compact) | 5.9 KiB | 1.7 µs | 572,436 | 3440.3 MB/s | 0.7 | 6.0 KiB |
| plan-of-action-and-milestones (compact) | 10.4 KiB | 2.6 µs | 391,043 | 4182.2 MB/s | 0.8 | 10.7 KiB |
| assessment-results (compact) | 10.4 KiB | 2.5 µs | 399,839 | 4270.7 MB/s | 0.8 | 10.7 KiB |
| catalog (compact) | 10.4 KiB | 6.8 µs | 147,771 | 1569.8 MB/s | 0.6 | 21.4 KiB |
| system-security-plan (compact) | 13.6 KiB | 6.5 µs | 153,851 | 2144.4 MB/s | 0.9 | 28.5 KiB |

### Parse, invalid input

| Case | Size | Median | Ops/s | ±% | Allocated/op |
|---|---:|---:|---:|---:|---:|
| not-json | 69 B | 3.5 µs | 288,070 | 1.1 | 1.8 KiB |
| invalid-utf8 | 236 B | 3.2 µs | 311,236 | 1.1 | 1.3 KiB |
| unknown-root | 88 B | 2.0 µs | 508,471 | 1.0 | 1.4 KiB |
| missing-required-field | 201 B | 3.5 µs | 283,953 | 1.1 | 5.7 KiB |
| two-failures | 177 B | 3.6 µs | 278,371 | 2.1 | 6.3 KiB |
| many-failures | 4.5 KiB | 39.6 µs | 25,234 | 3.2 | 136.7 KiB |
| wrong-document-type (parseCatalog on a profile) | 1.8 KiB | 4.5 µs | 223,028 | 0.5 | 5.3 KiB |
| over-depth-limit (300 levels) | 600 B | 11.0 µs | 90,549 | 0.9 | 34.2 KiB |

### First call and process memory

| Measure | Value |
|---|---:|
| First parse in the process (catalog, compiles its validators) | 162.1 ms |
| First parse of a second document type (profile) | 3.9 ms |
| Peak resident memory of the process | 275.0 MiB |

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
