import { DomainError } from "./errors";

/** Server limits on text, pages and batches (ADR 0001). */
export const LIMITS = {
  title: 500,
  description: 10_000,
  comment: 5_000,
  query: 200,
  externalKey: 200,
  agentName: 80,
  page: 50,
  batch: 20,
  frictionDescription: 2_000,
  frictionPerHour: 10,
} as const;

export const checkText = (field: string, value: string, max: number) => {
  if (value.trim().length === 0) {
    throw new DomainError("invalid", `${field} must not be empty`, { field });
  }
  if (value.length > max) {
    throw new DomainError(
      "invalid",
      `${field} is longer than ${max} characters`,
      { field, max },
    );
  }
};
