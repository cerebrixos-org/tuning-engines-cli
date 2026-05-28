import * as fs from "fs";

export function loadJsonObject(value: string | undefined, label: string): Record<string, any> {
  if (!value) return {};

  const body = value.startsWith("@")
    ? fs.readFileSync(value.slice(1), "utf-8")
    : value;
  const parsed = JSON.parse(body);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, any>;
}

export function parseOptionalNumber(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a number`);
  }
  return parsed;
}
