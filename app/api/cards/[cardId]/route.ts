import { NextResponse } from "next/server";
import { getCardForUi } from "@/lib/domain/cards";
import { isDomainError } from "@/lib/domain/errors";
import { getPersonActor } from "@/lib/domain/person";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const actor = await getPersonActor();
    if (!actor) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { cardId } = await params;
    return NextResponse.json(await getCardForUi(actor, cardId));
  } catch (error) {
    if (isDomainError(error) && error.type === "not_found") {
      return NextResponse.json(null);
    }
    return new NextResponse("Internal Error", { status: 500 });
  }
}
