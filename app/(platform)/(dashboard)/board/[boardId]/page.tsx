import { cardKey } from "@/lib/card-key";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ListContainer } from "./_components/list-container";

interface BoardIdPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

const BoardIdPage = async ({ params }: BoardIdPageProps) => {
  const { orgId } = await auth();

  if (!orgId) redirect("/select-org");

  const { boardId } = await params;

  const lists = await db.list.findMany({
    where: {
      boardId: boardId,
      board: {
        orgId,
      },
    },
    include: {
      board: { select: { keyPrefix: true, keyPrefixes: { select: { prefix: true } } } },
      cards: {
        orderBy: {
          order: "asc",
        },
        include: {
          _count: { select: { comments: true, blockedBy: true } },
          labels: {
            include: {
              label: true,
            },
          },
        },
      },
    },
    orderBy: {
      order: "asc",
    },
  });

  return (
    <div className="p-4 h-full">
      <ListContainer boardId={boardId} data={lists.map(({ board, ...list }) => ({
        ...list,
        cards: list.cards.map(card => ({
          ...card,
          key: cardKey(board.keyPrefix, card.number),
          keyAliases: card.number === null ? [] : board.keyPrefixes.map(({ prefix }) => `${prefix}-${card.number}`),
        })),
      }))} />
    </div>
  );
};

export default BoardIdPage;
