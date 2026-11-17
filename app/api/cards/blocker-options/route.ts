import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cardKey } from "@/lib/card-key";
import { cardReferenceWhere } from "@/lib/domain/card-keys";
import { db } from "@/lib/db";
import { LIMITS } from "@/lib/domain/limits";

export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });
  const query = new URL(req.url).searchParams.get("query")?.trim() ?? "";
  if (query.length > LIMITS.query) return new NextResponse("Query too long", { status: 400 });
  try {
    const cards = await db.card.findMany({
      where: { list: { board: { orgId } }, OR: [{ title: { contains: query, mode: "insensitive" } }, cardReferenceWhere(orgId, query)] },
      select: { id: true, title: true, number: true, list: { select: { board: { select: { keyPrefix: true } } } } },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: LIMITS.page + 1,
    });
    return NextResponse.json({ cards: cards.slice(0, LIMITS.page).map(card => ({ id: card.id, title: card.title, key: cardKey(card.list.board.keyPrefix, card.number) })), hasMore: cards.length > LIMITS.page });
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
