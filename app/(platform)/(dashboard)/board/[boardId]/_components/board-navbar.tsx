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
    <div className="w-full h-14 z-[40] bg-black/50 fixed top-14 flex items-center px-3 sm:px-6 gap-x-2 sm:gap-x-4 text-white">
      <Link
        href={`/organization/${data.orgId}`}
        aria-label="Back to boards"
        className="flex shrink-0 items-center gap-1.5 rounded-md p-2 text-sm hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Boards</span>
      </Link>
      <div className="min-w-0 shrink">
        <BoardTitleForm data={data} />
      </div>
      <BoardNotice boardId={data.id} notice={data.notice} />
      <div className="ml-auto shrink-0">
        <BoardOptions id={data.id} />
      </div>
    </div>
  );
};
