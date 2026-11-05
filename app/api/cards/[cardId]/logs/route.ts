import { NextResponse } from "next/server";
import { getCardActivity } from "@/lib/domain/cards";
import { getPersonActor } from "@/lib/domain/person";

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) => {
  try {
    const actor = await getPersonActor();
    if (!actor) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { cardId } = await params;
    return NextResponse.json(
      await getCardActivity(actor, cardId, { limit: 5 }),
    );
  } catch (error) {
    console.error("[GET_CARD_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
};
