/**
 * Runtime validators for the types of the naming manifest (design.md D1, D5).
 *
 * The complete OSCAL schema is the only source of the constraints. The validator of a type is the Ajv validate function
 * of the schema node that defines the type. The generator writes both inputs into `src/generated/`, so this module reads
 * only files of the repo.
 */
import { Ajv, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { type ElementType, elementTypes } from "./generated/element-types.ts";
import schema from "./generated/oscal-complete-schema.json" with { type: "json" };

export { type ElementType, elementTypes };

// `allErrors`: PRS-006 requires an entry for each failure. `strictTypes` is off, because the schema sets a `pattern` on
// a number (DecimalDatatype), and the default value makes Ajv write a warning to the console. The default
// `unicodeRegExp` compiles each pattern with the `u` flag, so `\p{L}` and `\p{N}` keep their XSD meaning (PRS-007).
const ajv = new Ajv({ allErrors: true, strictTypes: false });
// ajv-formats is CommonJS, so under NodeNext the callable is the `default` property of the default import.
addFormats.default(ajv, ["date-time", "uri", "uri-reference", "email"]);
ajv.addSchema(schema);

const pointers = new Map(elementTypes.map((row) => [row.typeName, row.pointer]));

/**
 * The Ajv validate function of a canonical type name. The function holds the errors of its last call in its `errors`
 * property. Throws for a name that is not in the manifest.
 */
export function validatorFor(typeName: string): ValidateFunction {
  const pointer = pointers.get(typeName);
  if (pointer === undefined) throw new Error(`${typeName} is not a type of the naming manifest`);
  const validate = ajv.getSchema(`${schema.$id}${pointer}`);
  if (validate === undefined) throw new Error(`${typeName}: no schema at ${pointer}`);
  return validate;
}
