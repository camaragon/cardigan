"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const KeyPrefixInput = ({ value, onChange, errors, disabled }: {
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  disabled?: boolean;
}) => {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold text-neutral-700">Card key prefix</Label>
      <Input id={id} name="keyPrefix" value={value} onChange={event => onChange(event.target.value.toUpperCase())}
        required minLength={2} maxLength={10} pattern="[A-Z][A-Z0-9]{1,9}" autoComplete="off" spellCheck={false}
        disabled={disabled} aria-invalid={Boolean(errors?.length)} aria-describedby={`${id}-hint ${id}-errors`} />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">2–10 letters or digits, starting with a letter. Example: DEMO-1.</p>
      <div id={`${id}-errors`} aria-live="polite" className="text-xs text-rose-500">{errors?.join(". ")}</div>
    </div>
  );
};
