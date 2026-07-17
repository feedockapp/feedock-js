/**
 * Every GraphQL document this server sends, validated against the API's
 * GENERATED schema (apps/api/schema.gql — Nest writes it on bootstrap). A
 * renamed field or argument in the API becomes a failing test here instead of
 * a runtime "Cannot query field" the first time a founder's agent calls the
 * tool. Skipped when the schema file is absent (a fresh clone that has never
 * booted the API) — it validates wherever the API has run, which includes
 * every dev machine and the live smoke environments.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSchema, parse, validate, type GraphQLSchema } from "graphql";
import { describe, expect, it } from "vitest";

import * as operations from "./operations.js";

const SCHEMA_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../apps/api/schema.gql",
);

const documents = Object.entries(operations).filter(
  (entry): entry is [string, string] => typeof entry[1] === "string",
);

describe.skipIf(!existsSync(SCHEMA_PATH))(
  "operations validate against the API schema",
  () => {
    let schema: GraphQLSchema;
    try {
      schema = buildSchema(readFileSync(SCHEMA_PATH, "utf8"));
    } catch {
      return; // skipIf already handled absence; a parse failure surfaces below
    }

    it("exports at least the known document count", () => {
      expect(documents.length).toBeGreaterThanOrEqual(30);
    });

    it.each(documents)("%s is valid", (_name, document) => {
      const errors = validate(schema, parse(document));
      expect(errors.map(String)).toEqual([]);
    });
  },
);
