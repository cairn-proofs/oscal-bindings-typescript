# Performance

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
