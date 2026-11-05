import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const labels = await db.label.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(labels);
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
