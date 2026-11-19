# Limits

A parse limits the nesting depth of its input to 250 levels. `validateElement` applies the same limit to its value. The
limit has these properties:

1. Each object and each array is one level. A scalar adds no level. The root value is level 1, whether it is an object
   or an array.
2. The limit applies to `parse`, `parseFile`, `parseYaml`, `parseYamlFile`, the typed parsers, `isValid`,
   `validateElement`, `buildHash`, `buildRlink`, and `buildResource`. For a YAML input, the levels are the levels of the
   value that the input reads as, and they include the levels that an alias gives.
3. A deeper input gives a `ParseError` from `parse`, `parseFile`, `parseYaml`, `parseYamlFile`, and the typed parsers. A
   deeper value gives a `LimitExceededError` from `validateElement`, `buildHash`, `buildRlink`, and `buildResource`.
   Each error has the limit `nesting-depth` in its `limit` property. `isValid` returns false for a deeper input.
4. A `LimitExceededError` is not a `ParseError`. A caller that catches `ParseError` around `validateElement` or a
   builder does not catch it.
5. A caller cannot change the limit.

The schema checks recurse once for each level. A deeper input or value can make them throw a `RangeError`, so the
binding stops it first. A valid element that is deeper than 250 levels gives a `LimitExceededError`, not a valid result.

A YAML input has one more limit, `alias-expansion`. `parseYaml` and `parseYamlFile` stop when the aliases of the input
give more than 100,000 nodes, or more than 10,000,000 characters of scalar text. The count includes the nodes that a
nested alias gives. The error is a `ParseError` with no entries, and its `limit` property is `alias-expansion`. A caller
cannot change the limit. The binding has no limit on the size of a YAML input in bytes.

A `ParseError` has no limit on its entries. It carries one entry for each failing location.

## Regex patterns

The OSCAL schema holds XSD regex patterns. Ajv compiles each pattern with the JavaScript regex engine and the `u` flag.
The `u` flag keeps the XSD meaning of `\p{L}` and `\p{N}`.

Three constructs have a different meaning in XSD and in JavaScript. The binding translates them outside a character
class:

1. `.` becomes `[^\n\r]`. XSD `.` excludes only LF and CR. JavaScript `.` also excludes U+2028 and U+2029.
2. `\s` becomes `[\t\n\r ]`. XSD `\s` matches only space, tab, LF, and CR. JavaScript `\s` also matches other Unicode
   white space.
3. `\S` becomes `[^\t\n\r ]`.

The binding copies each other escape and each character class unchanged. It throws when it compiles a pattern with `\s`
or `\S` inside a character class. No pattern of the current schema has one.

One deviation exists. Ajv ignores the `pattern` of `DecimalDatatype`, because the parsed value is a number and not text.
