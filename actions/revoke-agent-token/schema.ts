import { z } from "zod";

export const RevokeAgentToken = z.object({
  tokenId: z.string().min(1),
});
