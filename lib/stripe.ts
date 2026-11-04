import Stripe from "stripe";
import { isPrivateMode } from "@/lib/private-mode";

let client: Stripe | undefined;

export const getStripe = () => {
  if (isPrivateMode) throw new Error("Billing is disabled in private mode");
  client ??= new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: "2025-07-30.basil",
    typescript: true,
  });
  return client;
};
