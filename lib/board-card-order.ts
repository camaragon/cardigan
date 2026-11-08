/** Both lists exclude the moving card, as the move action's position does. */
export function getCardDropPosition(
  cards: readonly { id: string }[],
  visibleCards: readonly { id: string }[],
  visibleIndex: number,
): number {
  if (visibleIndex >= visibleCards.length) return cards.length;
  if (visibleIndex === 0) {
    return cards.findIndex((card) => card.id === visibleCards[0].id);
  }
  // Between visible neighbours, insert directly after the previous one.
  return cards.findIndex((card) => card.id === visibleCards[visibleIndex - 1].id) + 1;
}
