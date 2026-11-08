import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/domain/errors";
import { UpdateCard } from "@/actions/update-card/schema";
import { MoveCard } from "@/actions/move-card/schema";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/domain/person", () => ({ getPersonActor: vi.fn(() => ({})) }));
vi.mock("@/lib/domain/cards", () => ({ updateCard: vi.fn(), moveCard: vi.fn() }));

import * as domain from "@/lib/domain/cards";
import { updateCard } from "@/actions/update-card";
import { moveCard } from "@/actions/move-card";

const edit = { id: "card", boardId: "board", description: "Draft", version: 1 };
const move = { id: "card", boardId: "board", toListId: "list", position: 0, version: 1 };

describe("UI observed versions", () => {
  it("passes the observed version and preserves the structured conflict beside the legacy message", async () => {
    const error = new DomainError("stale_version", "Card changed", { current: { id: "card", version: 2 } });
    vi.mocked(domain.updateCard).mockRejectedValue(error);
    vi.mocked(domain.moveCard).mockRejectedValue(error);
    for (const result of [await updateCard(edit), await moveCard(move)]) {
      expect(result).toEqual({ error: error.message, domainError: error.toJSON() });
    }
    expect(domain.updateCard).toHaveBeenCalledWith({}, { cardId: "card", description: "Draft", expectedVersion: 1 });
    expect(domain.moveCard).toHaveBeenCalledWith({}, { cardId: "card", toListId: "list", position: 0, expectedVersion: 1 });
  });

  it("accepts legacy callers while rejecting invalid observed versions", () => {
    expect(UpdateCard.safeParse({ ...edit, version: undefined }).success).toBe(true);
    expect(MoveCard.safeParse({ ...move, version: undefined }).success).toBe(true);
    for (const version of [0, -1, 1.5]) {
      expect(UpdateCard.safeParse({ ...edit, version }).success).toBe(false);
      expect(MoveCard.safeParse({ ...move, version }).success).toBe(false);
    }
  });
});
