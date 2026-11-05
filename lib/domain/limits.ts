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
} as const;
