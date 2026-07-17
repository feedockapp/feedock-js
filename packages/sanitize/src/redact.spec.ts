import { describe, expect, it } from "vitest";

import { redactForAi } from "./index";

/** Secrets that MUST be scrubbed before text reaches an AI/embeddings vendor. */
describe("redactForAi — masks secrets (true positives)", () => {
  const cases: Array<[string, string, string]> = [
    ["GitLab PAT", "token glpat-abcdef1234567890ABCDEF here", "glpat-"],
    [
      "postgres URL with inline creds",
      "db postgres://admin:s3cr3tpw@db.example.com:5432/app end",
      "s3cr3tpw",
    ],
    [
      "redis URL with inline creds",
      "cache redis://user:p4ssword@10.0.0.1:6379/0 done",
      "p4ssword",
    ],
    [
      "mongodb+srv with creds",
      "mongodb+srv://u:supersecret@cluster.mongodb.net/db",
      "supersecret",
    ],
    ["password assignment", "config password=hunter2xyz done", "hunter2xyz"],
    ["prefixed env key (DB_PASSWORD)", "DB_PASSWORD=hunter2xyz here", "hunter2xyz"],
    ["prefixed env key (JWT_SECRET)", "env JWT_SECRET=s3cretvalue99 x", "s3cretvalue99"],
    ["suffixed env key (SECRET_KEY_BASE)", "SECRET_KEY_BASE=abcdef123456 y", "abcdef123456"],
    ["quoted JSON key", '{"password": "hunter2xyz"}', "hunter2xyz"],
    ["quoted JSON key no space", '{"jwt_secret":"s3cretValue987"}', "s3cretValue987"],
    ["api_key assignment", "api_key: abcdef123456 trailing", "abcdef123456"],
    [
      "Stripe underscore live key",
      "key sk_live_abcdef1234567890XYZ done",
      "sk_live_abcdef1234567890XYZ",
    ],
    ["OpenAI hyphen key still works", "sk-abcd1234efgh5678ijkl", "sk-abcd1234efgh5678ijkl"],
    ["email still works", "reach me@corp.com please", "me@corp.com"],
    ["unicode email", "write café@exämple.com now", "café@exämple.com"],
  ];

  it.each(cases)("%s", (_label, input, mustNotSurvive) => {
    const out = redactForAi(input);
    expect(out).not.toContain(mustNotSurvive);
    expect(out).toMatch(/\[REDACTED_/);
  });

  it("keeps the key name but drops the value on an assignment (triage context)", () => {
    expect(redactForAi("password=hunter2xyz")).toBe("password=[REDACTED_SECRET]");
  });
});

/** Legitimate product prose that must NOT be redacted (false positives). */
describe("redactForAi — preserves legit text (false positives)", () => {
  const survivors = [
    "redis://localhost:6379", // no inline creds
    "we use postgres for storage", // scheme word, not a URL
    "the password field is required", // keyword without = value
    "please select an option from the list", // 'select', not a secret
    "the reset token is emailed to you", // 'token' without = value
    "add a dark mode toggle to settings",
  ];

  it.each(survivors)("leaves %j untouched", (text) => {
    expect(redactForAi(text)).toBe(text);
  });
});
