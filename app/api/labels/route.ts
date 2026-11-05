import { NextResponse } from "next/server";
import { listLabels } from "@/lib/domain/boards";
import { getPersonActor } from "@/lib/domain/person";

export async function GET() {
  try {
    const actor = await getPersonActor();
    if (!actor) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return NextResponse.json(await listLabels(actor));
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
