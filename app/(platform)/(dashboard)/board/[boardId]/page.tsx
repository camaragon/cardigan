import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BoardNotice } from "./_components/board-notice";
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

  const [board, lists] = await Promise.all([
    db.board.findFirst({
      where: { id: boardId, orgId },
      select: { notice: true },
    }),
    db.list.findMany({
      where: {
        boardId: boardId,
        board: {
          orgId,
        },
      },
      include: {
        cards: {
          orderBy: {
            order: "asc",
          },
          include: {
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
    }),
  ]);

  return (
    <div className="p-4 h-full overflow-x-auto">
      {board && <BoardNotice boardId={boardId} notice={board.notice} />}
      <ListContainer boardId={boardId} data={lists} />
    </div>
  );
};

export default BoardIdPage;
