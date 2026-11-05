import type { Actor } from "@/lib/domain/actor";

export { owner, member, agent } from "./actors";

/**
 * Creates a board with To do, Doing and Done lists in the actor's workspace
 * and returns it with its lists by key.
 */
export async function seedBoard(actor: Actor, title = "Board") {
  const { db } = await import("@/lib/db");
  const board = await db.board.create({
    data: {
      orgId: actor.orgId,
      title,
      imageId: "img",
      imageThumbUrl: "thumb",
      imageFullUrl: "full",
      imageUserName: "user",
      imageLinkHTML: "link",
    },
  });
  const [todo, doing, done] = await Promise.all(
    ["To do", "Doing", "Done"].map((listTitle, index) =>
      db.list.create({
        data: { boardId: board.id, title: listTitle, order: index + 1 },
      }),
    ),
  );
  return { board, lists: { todo, doing, done } };
}
