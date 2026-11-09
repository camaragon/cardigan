import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LIMITS } from "@/lib/domain/limits";

export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return new NextResponse("Unauthorized", { status: 401 });
  const query = new URL(req.url).searchParams.get("query")?.trim() ?? "";
  if (query.length > LIMITS.query) return new NextResponse("Query too long", { status: 400 });
  try {
    const cards = await db.card.findMany({
      where: { list: { board: { orgId } }, title: { contains: query, mode: "insensitive" } },
      select: { id: true, title: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: LIMITS.page + 1,
    });
    return NextResponse.json({ cards: cards.slice(0, LIMITS.page), hasMore: cards.length > LIMITS.page });
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
