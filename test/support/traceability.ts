import { Ajv } from "ajv";

export interface Entry {
  name: string;
  requirements?: string[];
  "binding-local"?: string;
}

/**
 * Checks a traceability record and returns one message for each problem:
 * 1. SRF-007: the record conforms to the JSON Schema of the store.
 * 2. SRF-004: each identifier in a `requirements` field is in the requirement index. The `binding-local` field names
 *    a requirement of this repo, so this check does not read it.
 * 3. SRF-003: each operation name occurs in one entry only.
 */
export function checkRecord(record: unknown, schema: object, indexIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const ajv = new Ajv({ allErrors: true, strict: false });
  if (!ajv.validate(schema, record)) {
    for (const e of ajv.errors ?? []) problems.push(`[schema] ${e.instancePath || "/"} ${e.message ?? ""}`.trim());
    return problems;
  }
  const seen = new Set<string>();
  for (const entry of (record as { operations: Entry[] }).operations) {
    for (const id of entry.requirements ?? []) {
      if (!indexIds.has(id)) problems.push(`[index] ${entry.name}: ${id} is not in the requirement index`);
    }
    if (seen.has(entry.name)) problems.push(`[duplicate] ${entry.name} is in more than one entry`);
    seen.add(entry.name);
  }
  return problems;
}
