import { isPrivateMode } from "@/lib/private-mode";
import { checkSubscription } from "@/lib/subscription";
import { Info } from "../_components/info";
import { Separator } from "@/components/ui/separator";
import { SubscriptionButton } from "./_components/subscription-button";

import { notFound } from "next/navigation";

const BillingPage = async () => {
  if (isPrivateMode) notFound();

  const isPro = await checkSubscription();
  return (
    <div>
      <Info isPro={isPro} />
      <Separator className="my-2" />
      <SubscriptionButton isPro={isPro} />
    </div>
  );
};

export default BillingPage;
