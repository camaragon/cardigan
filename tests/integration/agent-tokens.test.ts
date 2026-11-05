import { describe, expect, it, vi } from "vitest";
import { hasTestDatabase } from "../setup/test-db";
import { member, owner, seedAgent } from "../setup/fixtures";

vi.mock("@clerk/nextjs/server", async () =>
  (await import("../setup/mock-clerk")).clerkServerMock,
);

describe.skipIf(!hasTestDatabase)("agent tokens", async () => {
  const { db } = await import("@/lib/db");
  const { createAgentToken, hashSecret, resolveAgentToken, revokeAgentToken } =
    await import("@/lib/domain/tokens");

  it("C-1: the secret is returned once and stored only as a hash; creation and revocation are logged", async () => {
    const { token, secret, actor } = await seedAgent(owner(), "agent");
    expect(actor).toMatchObject({ kind: "AGENT", orgId: "org_test", tokenId: token.id, role: { key: "agent" } });

    const stored = await db.agentToken.findUniqueOrThrow({ where: { id: token.id } });
    expect(stored.secretHash).toBe(hashSecret(secret));
    expect(JSON.stringify([await db.agentToken.findMany(), await db.auditLog.findMany()])).not.toContain(secret);

    await revokeAgentToken(owner(), token.id);
    expect(await resolveAgentToken(secret)).toBeNull();
    const log = await db.auditLog.findMany({ where: { entityId: token.id }, orderBy: { eventId: "asc" } });
    expect(log.map((l) => [l.entityType, l.action, l.actorKind])).toEqual([
      ["AGENT_TOKEN", "CREATE", "OWNER"],
      ["AGENT_TOKEN", "REVOKE", "OWNER"],
    ]);
  });

  it("C-1, C-4: only the owner manages tokens; members and agents cannot", async () => {
    await expect(createAgentToken(member(), { agentName: "x", roleKey: "agent" })).rejects.toMatchObject({ type: "denied" });
    const { actor, token } = await seedAgent(owner(), "agent");
    await expect(createAgentToken(actor, { agentName: "x", roleKey: "agent" })).rejects.toMatchObject({ type: "denied" });
    await expect(revokeAgentToken(actor, token.id)).rejects.toMatchObject({ type: "denied" });
    expect(await db.agentToken.count()).toBe(1);
  });

  it("C-1: a role must belong to the token's workspace", async () => {
    await seedAgent(owner("org_other", "user_other"), "agent");
    await db.agentRole.updateMany({ where: { orgId: "org_other" }, data: { key: "other" } });
    await expect(createAgentToken(owner(), { agentName: "x", roleKey: "other" })).rejects.toMatchObject({ type: "not_found" });
  });
});
