import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { BoardNavbar } from "./_components/board-navbar";

// Generates the board name in the tab along with the app name
export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) => {
  const { orgId } = await auth();

  if (!orgId) {
    return {
      title: "Board",
    };
  }

  const { boardId } = await params;

  const board = await db.board.findUnique({
    where: {
      id: boardId,
      orgId,
    },
  });

  return {
    title: board?.title ?? "Board",
  };
};

const BoardIdLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ boardId: string }>;
}) => {
  const { orgId } = await auth();

  if (!orgId) redirect("/select-org");

  const { boardId } = await params;

  const board = await db.board.findUnique({
    where: {
      id: boardId,
      orgId,
    },
  });

  if (!board) notFound();

  return (
    <div
      className="relative h-full bg-no-repeat bg-cover bg-center"
      style={{ backgroundImage: `url(${board.imageFullUrl})` }}
    >
      <BoardNavbar data={board} />
      <div className="absolute inset-0 bg-black/10" />
      <main className="relative pt-28 h-full">{children}</main>
    </div>
  );
};

export default BoardIdLayout;
