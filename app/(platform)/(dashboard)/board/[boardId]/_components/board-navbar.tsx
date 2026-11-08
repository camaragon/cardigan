import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BoardNotice } from "./board-notice";
import { Board } from "@prisma/client";
import { BoardTitleForm } from "./board-title-form";
import { BoardOptions } from "./board-options";

interface BoardNavbarProps {
  data: Board;
}

export const BoardNavbar = async ({ data }: BoardNavbarProps) => {
  return (
    <div className="w-full h-24 grid grid-cols-[auto_minmax(0,1fr)_auto_auto] grid-rows-[3.5rem_2.5rem] sm:h-14 sm:flex z-[40] bg-black/50 fixed top-14 items-center px-3 sm:px-6 gap-x-2 sm:gap-x-4 text-white">
      <Link
        href={`/organization/${data.orgId}`}
        aria-label="Back to boards"
        className="flex shrink-0 items-center gap-1.5 rounded-md p-2 text-sm text-white hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Boards</span>
      </Link>
      <div className="min-w-0 shrink">
        <BoardTitleForm data={data} />
      </div>
      <BoardNotice boardId={data.id} notice={data.notice} />
      <div
        id="board-toolbar"
        className="order-last col-span-4 flex w-full min-w-0 pb-2 sm:order-none sm:ml-auto sm:w-auto sm:pb-0"
      />
      <div className="ml-auto shrink-0 sm:ml-0">
        <BoardOptions id={data.id} />
      </div>
    </div>
  );
};
