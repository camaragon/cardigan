import { expect, it } from "vitest";
import { getCardDropPosition } from "@/lib/board-card-order";

it("maps filtered drops to the full order while preserving hidden cards", () => {
  const cards = ["hidden-top", "A", "hidden-middle", "B", "hidden-end"].map(
    (id) => ({ id }),
  );
  const visibleCards = cards.filter(({ id }) => id === "A" || id === "B");
  const drop = (visibleIndex: number, visible = visibleCards) => {
    const result = [...cards];
    result.splice(getCardDropPosition(cards, visible, visibleIndex), 0, { id: "moving" });
    return result.map(({ id }) => id);
  };

  expect(drop(1)).toEqual(["hidden-top", "A", "moving", "hidden-middle", "B", "hidden-end"]);
  expect(drop(0)).toEqual(["hidden-top", "moving", "A", "hidden-middle", "B", "hidden-end"]);
  expect(drop(2)).toEqual(["hidden-top", "A", "hidden-middle", "B", "hidden-end", "moving"]);
  expect(drop(0, [])).toEqual(["hidden-top", "A", "hidden-middle", "B", "hidden-end", "moving"]);

  // Same-list moves pass the destination with the moving card removed.
  const withoutA = cards.filter(({ id }) => id !== "A");
  expect(getCardDropPosition(withoutA, [visibleCards[1]], 1)).toBe(withoutA.length);
  const withoutB = cards.filter(({ id }) => id !== "B");
  expect(getCardDropPosition(withoutB, [visibleCards[0]], 0)).toBe(1);
});
