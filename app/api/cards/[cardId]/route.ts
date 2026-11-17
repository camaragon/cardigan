import { cardKey } from "@/lib/card-key";
import { cardReferenceWhere } from "@/lib/domain/card-keys";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { cardId } = await params;

    const card = await db.card.findFirst({
      where: cardReferenceWhere(orgId, cardId),
      include: {
        blockedBy: { include: { blocker: { select: { id: true, title: true } } } },
        list: {
          select: {
            title: true,
            board: { select: { keyPrefix: true } },
          },
        },
        labels: {
          include: {
            label: true,
          },
        },
      },
    });

    if (!card) return new NextResponse("Not Found", { status: 404 });

    const { board, ...list } = card.list;
    return NextResponse.json({ ...card, list, key: cardKey(board.keyPrefix, card.number) });
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
