import { cardReferenceWhere } from "@/lib/domain/card-keys";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { OUTCOME } from "@prisma/client";
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

    const { cardId: reference } = await params;
    const card = await db.card.findFirst({ where: cardReferenceWhere(orgId, reference), select: { id: true } });
    if (!card) return new NextResponse("Not Found", { status: 404 });
    const cardId = card.id;

    const auditLogs = await db.auditLog.findMany({
      where: {
        orgId,
        outcome: OUTCOME.OK,
        OR: [{ entityId: cardId }, { cardId }],
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    });

    return NextResponse.json(auditLogs);
  } catch (error) {
    console.error("[GET_CARD_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
};
