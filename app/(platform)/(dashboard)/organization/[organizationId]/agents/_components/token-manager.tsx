"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { createAgentToken } from "@/actions/create-agent-token";
import { revokeAgentToken } from "@/actions/revoke-agent-token";
import { FormInput } from "@/components/form/form-input";
import { FormSubmit } from "@/components/form/form-submit";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";

interface TokenRow {
  id: string;
  agentName: string;
  role: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface TokenManagerProps {
  roles: { key: string; name: string }[];
  tokens: TokenRow[];
}

export const TokenManager = ({ roles, tokens }: TokenManagerProps) => {
  const [secret, setSecret] = useState<{ agentName: string; secret: string } | null>(null);

  const create = useAction(createAgentToken, {
    onSuccess: (data) => {
      setSecret({ agentName: data.agentName, secret: data.secret });
      toast.success(`Token created for ${data.agentName}`);
    },
    onError: (error) => toast.error(error),
  });

  const revoke = useAction(revokeAgentToken, {
    onSuccess: () => toast.success("Token revoked"),
    onError: (error) => toast.error(error),
  });

  const onSubmit = (formData: FormData) => {
    create.execute({
      agentName: formData.get("agentName") as string,
      roleKey: formData.get("roleKey") as string,
    });
  };

  return (
    <div className="space-y-4">
      {secret && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm space-y-2">
          <p className="font-medium">
            Copy the token for {secret.agentName} now. It will not be shown again.
          </p>
          <code className="block break-all rounded bg-white p-2 text-xs">{secret.secret}</code>
          <div className="flex gap-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(secret.secret);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <form action={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <FormInput
            id="agentName"
            label="Agent name"
            placeholder="PM agent"
            className="h-8"
            errors={create.fieldErrors}
          />
        </div>
        <div className="space-y-1 sm:w-40">
          <label htmlFor="roleKey" className="block text-xs font-semibold text-neutral-700">
            Role
          </label>
          <select
            id="roleKey"
            name="roleKey"
            className="block h-8 w-full rounded-md border px-2 text-sm"
            defaultValue={roles[0]?.key}
          >
            {roles.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <FormSubmit className="w-full sm:w-auto">Create token</FormSubmit>
      </form>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agent tokens yet.</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-4 p-3 sm:p-4">
              <div className="min-w-0 break-words">
                <p className="font-medium">
                  {token.agentName}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {token.role} · {token.prefix}…
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {format(new Date(token.createdAt), "MMM d, yyyy")}
                  {token.lastUsedAt &&
                    ` · last used ${format(new Date(token.lastUsedAt), "MMM d, yyyy")}`}
                  {token.revokedAt &&
                    ` · revoked ${format(new Date(token.revokedAt), "MMM d, yyyy")}`}
                </p>
              </div>
              {!token.revokedAt && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={revoke.isLoading}
                  onClick={() => revoke.execute({ tokenId: token.id })}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
