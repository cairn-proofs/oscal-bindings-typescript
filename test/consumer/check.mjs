import assert from "node:assert/strict";
import { OSCAL_RELEASE, parse } from "oscal-bindings/v1";
const catalog = {
  catalog: {
    uuid: "8b1c0c1e-5f6a-4d0e-9a1b-0c1d2e3f4a5b",
    metadata: { title: "T", "last-modified": "2024-01-01T00:00:00Z", version: "1", "oscal-version": OSCAL_RELEASE },
  },
};
assert.equal(Object.keys(parse(JSON.stringify(catalog))).join(), "catalog");
for (const specifier of ["oscal-bindings", "oscal-bindings/dist/parse.js"]) {
  await assert.rejects(import(specifier), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }, specifier);
}
