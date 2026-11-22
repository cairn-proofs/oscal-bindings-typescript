## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `src/validators.ts` builds two Ajv instances with one factory. The factory calls `addFormats` for `date-time`,
   `uri`, `uri-reference` and `email`. Parse, `isValid`, element validation and the builders all use these instances,
   so one change in the factory reaches each of them. A builder calls `validateElement` in `src/validate-element.ts`.
2. The schema has four nodes with a `format` keyword. Each node is a datatype:
   1. `DateTimeWithTimezoneDatatype` has `format: date-time` and a pattern.
   2. `URIDatatype` has `format: uri` and the pattern `^[a-zA-Z][a-zA-Z0-9+\-.]+:.+$`.
   3. `URIReferenceDatatype` has `format: uri-reference` and no pattern.
   4. `EmailAddressDatatype` has `allOf` with `StringDatatype` and a node with `format: email` and the pattern
      `^.+@.+$`.
3. `src/validators.ts` reads the imported schema in three places: Ajv compiles it, `nodeAt` finds nodes by JSON
   Pointer, and `siteVariants` finds union sites by the identity of the node. All three must read the same object.
4. `regExpEngine` translates `.` to `[^\n\r]` for each schema pattern. A pattern that needs `.` to match more
   characters does not exist in the schema.
5. `toEntries` merges the Ajv errors of one location into one `FailureEntry`. A value that fails two keywords gives one
   entry with two messages.
6. The corpus of the pinned release has 19 cases that cite [PRS-016] to [PRS-019]. Only `round-trip/email-forms` is in
   `expected-failures.json`, and it is the only case that this change removes from the list.
7. The pattern of `DateTimeWithTimezoneDatatype` accepts a subset of the strings that the RFC 3339 production
   `date-time` accepts. The pattern is stricter in four places:
   1. It accepts `T` and `Z` in upper case only.
   2. It does not accept the second `60`.
   3. It limits the years.
   4. It limits the offsets to real time zones.

## Goals / Non-Goals

**Goals:**

1. The `format` keyword has no effect on any result, and a later change of a dependency cannot give it one.
2. Each of the four datatypes meets its grammar and its pattern, as [PRS-016] to [PRS-019] state.
3. A new release of the schema that adds a `format` name or a new datatype grammar fails `npm test`, and does not
   change a parse result without notice.
4. A parse of a document stays as fast as it is now.

**Non-Goals:**

1. Any other email rule, such as a length limit or a rule for the domain ([PRS-018]).
2. Any change to the other datatypes or to their patterns.

## Decisions

### D1: Ajv ignores `format`, and a new keyword carries each grammar

The Ajv factory sets `validateFormats: false` and no longer calls `addFormats`. The module `src/validators.ts` makes
one copy of the imported schema with `structuredClone`. In the copy, each node that has a `format` keyword gets a new
keyword, `datatype-grammar`, with the same value as `format`. The module registers `datatype-grammar` as a custom
Ajv keyword for strings. The keyword calls the function of `src/datatypes.ts` that has the name of its value. The
module reads the copy for Ajv, `nodeAt`, `branchPointers` and `siteVariants`, so the identity rule of Context item 3
holds. The generated file in `src/generated/` does not change.

The module throws when a node has a `format` value that `src/datatypes.ts` has no function for. A test of the pinned
schema covers this case, so a new release that adds a format name fails `npm test`.

**Why:** with `validateFormats: false`, no dependency and no option can make `format` decide a result ([PRS-016]).
The grammar of each datatype has one named place in the code.

**Alternatives:**

1. Override the four names with `ajv.addFormat` and keep format validation on. The code is smaller, but `format` still
   decides the result. `ajv-formats` or an Ajv default can bring that back with no failing test.
2. Edit the schema in `src/generated/`. The generator writes this file from the spec artifact, so an edit does not last.
3. A URI library. Such a library normalizes input or accepts forms that RFC 3986 does not allow.

### D2: The grammars are regular expressions that the module builds from the ABNF of the RFCs

`src/datatypes.ts` exports one function for each name: `uri`, `uri-reference`, `email` and `date-time`. Each function
takes a string and returns a boolean. The module builds the two URI expressions from named parts. Each part is one
rule of the ABNF of Appendix A of RFC 3986, from `scheme` to `reg-name`, with the names of the RFC. The module compiles
each expression once, when it loads.

The expressions are anchored with `^` and `$` and have no `m` flag. In JavaScript, `$` without that flag matches only
at the end of the string, so a value with a final line feed fails ([PRS-017]). The expressions accept ASCII characters
only, as RFC 3986 requires.

`uri-reference` is `URI` or `relative-ref`. `uri` is `URI`.

`email` is the test that the string has no character in U+0000 to U+001F or U+007F. The pattern of the schema decides
the rest.

`date-time` is the RFC 3339 production `date-time` with the character case that the ABNF of the RFC gives: `T` and `Z`
in either case. Its day field accepts `01` to `31`, and its second field accepts `00` to `60`. The pattern of the
schema decides the calendar, the years and the offsets.

**Why:** a regular expression compiled once has the lowest cost for each value. The names of the RFC in the code make
a review against the RFC direct.

**Alternative:** a hand-written parser. It is easier to step through, but it is longer, and it needs its own tests for
each branch that the ABNF already states.

### D3: The error of the keyword names the datatype

When the function returns false, the keyword reports one Ajv error. The message states the grammar, for example
`must match the grammar of the RFC 3986 production URI`. The error has the keyword name and the instance path of the
value. `toEntries` merges it with the pattern error of the same location, so one value gives one `FailureEntry`.

**Why:** [PRS-016] scenario 3 expects one failure for a bad URI reference, with no extra count for the pattern.

### D4: `ajv-formats` leaves the dependency list

`package.json` and `package-lock.json` drop `ajv-formats`. `README.md` and `docs/security.md` list two runtime
dependencies, `ajv` and `yaml`.

**Why:** after D1, nothing imports the package. A dependency that nothing uses adds supply chain risk to the list
that `docs/security.md` asks users to review.

### D5: Tests for the grammars

1. `test/datatypes.test.ts` has a table of accepted values and a table of rejected values for each function. Each
   branch of the ABNF has one row. The branches are: scheme, authority with and without user information, `reg-name`, IPv4, a
   bracketed IPv6 address, `IPvFuture`, port, empty path, absolute path, relative path, query, fragment,
   percent-encoding, and a bad escape. The rejected rows include a space, a backslash, a non-ASCII character,
   an open bracket, a control character and a final line feed.
2. The tests for `date-time` cover lower case `t` and `z`, a leap second, a missing offset and a two-digit year.
3. The tests for `email` cover each end of both control ranges, `a@b` and a non-ASCII address.
4. A test of the pinned schema checks that each `format` value has a function ([D1](#d1-ajv-ignores-format-and-a-new-keyword-carries-each-grammar)).
5. A test in `test/validators.test.ts` shows that `format` has no effect. A value that meets the grammar and the
   pattern is valid, whatever the `format` value of its node is.
6. A timing test gives each function a string of 1 MiB that is built to cause backtracking, and states a limit.

## Risks / Trade-offs

1. [A parse that gave a pass now gives a failure, or the reverse] → The proposal states the cases. The corpus has a
   case for each requirement, and `npm test` runs all of them.
2. [A regular expression with nested quantifiers can take exponential time on a crafted value. That is a denial of
   service] → Each alternative of a repeated group in the ABNF has a disjoint first character set, so the expressions
   do not backtrack beyond linear time. Test 6 of D5 checks this.
3. [The copy of the schema adds memory and start-up time] → The schema is parsed once for each process. The copy runs
   once. The benchmark of task 4.1 checks the parse time.
4. [`date-time` accepts a value that the pattern rejects, so the grammar alone does not decide] → This is the rule of
   [PRS-016]: a value must meet both. A test shows a lower case `t` is rejected through the pattern.

[PRS-016]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-016-the-patterns-of-the-schema-decide-a-value-not-its-format-keyword
[PRS-017]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-017-a-uri-value-matches-the-grammar-of-rfc-3986
[PRS-018]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-018-an-email-address-holds-no-control-character
