/**
 * Typed errors raised by domain functions. Every entry point (server actions,
 * read routes, MCP tools) turns these into its own response shape.
 */
export type DomainErrorType =
  | "unauthorized"
  | "not_found"
  | "invalid"
  | "denied"
  | "conflict"
  | "stale_version"
  | "rate_limited"
  | "unavailable";

export interface RuleDenial {
  /** The rule that refused the action, e.g. "list.enter" or "role.capability". */
  rule: string;
  /** Who may perform the action, in plain words. */
  allowed: string[];
  /** At least one thing the caller may do instead. */
  alternative: string;
}

export class DomainError extends Error {
  readonly type: DomainErrorType;
  readonly details?: Record<string, unknown>;

  constructor(
    type: DomainErrorType,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
    this.type = type;
    this.details = details;
  }

  toJSON() {
    return { type: this.type, message: this.message, ...this.details };
  }
}

export const notFound = (what: string) =>
  new DomainError("not_found", `${what} not found`);

export const denied = (message: string, denial: RuleDenial) =>
  new DomainError("denied", message, { ...denial });

export const isDomainError = (error: unknown): error is DomainError =>
  error instanceof DomainError;

/** Message for the UI's `{ error }` result, hiding unexpected internals. */
export const errorMessage = (error: unknown, fallback: string) =>
  isDomainError(error) ? error.message : fallback;
