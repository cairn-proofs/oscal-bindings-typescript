import { parseCatalog, ParseError, OSCAL_RELEASE, type SerializeOptions, type Catalog } from "oscal-bindings/v1";
const options: SerializeOptions = { compact: true };
declare const catalog: Catalog;
const release: string = OSCAL_RELEASE;
export { parseCatalog, ParseError, options, catalog, release };
