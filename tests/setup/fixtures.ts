import type { Actor } from "@/lib/domain/actor";

export { owner, member } from "./actors";

const IMAGE = {
  imageId: "img",
  imageThumbUrl: "thumb",
  imageFullUrl: "full",
  imageUserName: "user",
  imageLinkHTML: "link",
};

/** Creates a board from a template and returns it with its lists by key. */
export async function seedBoard(
  actor: Actor,
  template: "plain" | "product",
  title = template === "product" ? "Product" : "Plain",
) {
  const { createBoard } = await import("@/lib/domain/boards");
  const { db } = await import("@/lib/db");
  const board = await createBoard(actor, { title, template, image: IMAGE });
  const lists = await db.list.findMany({ where: { boardId: board.id } });
  const byKey = Object.fromEntries(lists.map((l) => [l.templateKey!, l]));
  return { board, lists: byKey };
}
