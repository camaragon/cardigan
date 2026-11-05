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

  const board = await db.board.findFirst({
    where: { id: boardId, orgId },
    select: { notice: true },
  });

  const lists = await db.list.findMany({
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
  });

  return (
    <div className="p-4 h-full overflow-x-auto">
      {board?.notice && (
        <p className="mb-3 inline-block max-w-3xl rounded-md bg-black/40 px-3 py-1.5 text-xs text-white">
          {board.notice}
        </p>
      )}
      <ListContainer boardId={boardId} data={lists} />
    </div>
  );
};

export default BoardIdPage;
