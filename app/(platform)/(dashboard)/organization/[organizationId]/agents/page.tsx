import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";
import { checkSubscription } from "@/lib/subscription";
import { isOwner } from "@/lib/domain/actor";
import { getPersonActor } from "@/lib/domain/person";
import { AGENT_ROLE, listAgentTokens } from "@/lib/domain/tokens";
import { Info } from "../_components/info";
import { TokenManager } from "./_components/token-manager";

const AgentsPage = async () => {
  const actor = await getPersonActor();
  if (!actor) redirect("/select-org");

  const [isPro, roles] = await Promise.all([
    checkSubscription(),
    db.agentRole.findMany({
      where: { orgId: actor.orgId },
      orderBy: { name: "asc" },
    }),
  ]);
  const owner = isOwner(actor);
  const tokens = owner ? await listAgentTokens(actor) : [];
  // The Agent role is added to the workspace with its first token.
  const roleOptions = roles.some((r) => r.key === AGENT_ROLE.key)
    ? roles
    : [AGENT_ROLE, ...roles];

  return (
    <div className="w-full space-y-6">
      <Info isPro={isPro} />
      <Separator className="my-2" />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-700">Agent tokens</h2>
        <p className="text-sm text-muted-foreground">
          Each token belongs to one agent with one role in this workspace. The
          secret is shown once; only its hash is stored. Agents cannot delete
          anything or change these settings.
        </p>
        {owner ? (
          <TokenManager
            roles={roleOptions.map((r) => ({ key: r.key, name: r.name }))}
            tokens={tokens.map((t) => ({
              id: t.id,
              agentName: t.agentName,
              role: t.role.name,
              prefix: t.prefix,
              createdAt: t.createdAt.toISOString(),
              lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
              revokedAt: t.revokedAt?.toISOString() ?? null,
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Only the workspace owner can create or revoke agent tokens.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-neutral-700">Agent roles</h2>
        <ul className="space-y-1 text-sm">
          {roleOptions.map((role) => (
            <li key={role.key}>
              <span className="font-medium">{role.name}</span>
              <span className="text-muted-foreground">
                {" "}
                may {role.capabilities.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AgentsPage;
