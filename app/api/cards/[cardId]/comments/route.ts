import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) => {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { cardId } = await params;

    const comments = await db.comment.findMany({
      where: {
        orgId,
        cardId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("[GET_COMMENTS_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
};
