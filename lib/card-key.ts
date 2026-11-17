import { z } from "zod";

export const KeyPrefix = z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/, {
  message: "Use 2–10 uppercase letters or digits, starting with a letter",
});

export const cardKey = (prefix: string | null, number: number | null) =>
  prefix && number !== null ? `${prefix}-${number}` : null;
