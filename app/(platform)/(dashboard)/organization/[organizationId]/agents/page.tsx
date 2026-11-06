import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";
import { checkSubscription } from "@/lib/subscription";
import { isOwner } from "@/lib/domain/actor";
import { listBoardsWithRules } from "@/lib/domain/boards";
import { getPersonActor } from "@/lib/domain/person";
import { AGENT_ROLE, listAgentTokens } from "@/lib/domain/tokens";
import { Info } from "../_components/info";
import { TokenManager } from "./_components/token-manager";

const AgentsPage = async () => {
  const actor = await getPersonActor();
  if (!actor) redirect("/select-org");

  const [isPro, roles, boards] = await Promise.all([
    checkSubscription(),
    db.agentRole.findMany({
      where: { orgId: actor.orgId },
      orderBy: { name: "asc" },
    }),
    listBoardsWithRules(actor.orgId),
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-700">List rules</h2>
        <p className="text-sm text-muted-foreground">
          Rules come from each board&apos;s template and apply to people and
          agents alike, in the app and through MCP.
        </p>
        {boards.map((board) => (
          <div key={board.id} className="rounded-md border p-3 space-y-2">
            <div>
              <p className="font-semibold text-neutral-700">
                {board.title}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {board.template} template
                </span>
              </p>
              {board.notice && (
                <p className="text-xs text-muted-foreground">{board.notice}</p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">List</th>
                    <th className="py-1 pr-3 font-medium">Create</th>
                    <th className="py-1 pr-3 font-medium">Edit</th>
                    <th className="py-1 pr-3 font-medium">Reorder</th>
                    <th className="py-1 pr-3 font-medium">Move to</th>
                  </tr>
                </thead>
                <tbody>
                  {board.lists.map((list) => (
                    <tr key={list.id} className="border-t align-top">
                      <td className="py-1 pr-3">
                        <p className="font-medium">{list.title}</p>
                        {list.notice && (
                          <p className="text-muted-foreground">{list.notice}</p>
                        )}
                      </td>
                      <td className="py-1 pr-3">{list.rules.create.join(", ")}</td>
                      <td className="py-1 pr-3">{list.rules.edit.join(", ")}</td>
                      <td className="py-1 pr-3">{list.rules.reorder.join(", ")}</td>
                      <td className="py-1 pr-3">
                        {Object.entries(list.rules.moveTo).length === 0
                          ? "no one"
                          : Object.entries(list.rules.moveTo).map(([target, who]) => (
                              <p key={target}>
                                {target}: {who.join(", ")}
                              </p>
                            ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default AgentsPage;
