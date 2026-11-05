import { Bot, Check, User } from "lucide-react";

import { cn } from "@/lib/utils";

type Actor = { kind: "person" | "agent"; name: string };

type PreviewCard = {
  title: string;
  label?: { text: string; className: string };
  actor: Actor;
  highlight?: boolean;
};

const columns: { title: string; cards: PreviewCard[] }[] = [
  {
    title: "To do",
    cards: [
      {
        title: "Draft onboarding checklist",
        label: { text: "Docs", className: "bg-sky-100 text-sky-800" },
        actor: { kind: "agent", name: "Writer agent" },
      },
      {
        title: "Renew domain and certificates",
        label: { text: "Admin", className: "bg-violet-100 text-violet-800" },
        actor: { kind: "person", name: "You" },
      },
    ],
  },
  {
    title: "Doing",
    cards: [
      {
        title: "Fix flaky export job",
        label: { text: "Bug", className: "bg-rose-100 text-rose-800" },
        actor: { kind: "agent", name: "Build agent" },
        highlight: true,
      },
    ],
  },
  {
    title: "Done",
    cards: [
      {
        title: "Summarize last week's feedback",
        actor: { kind: "agent", name: "Research agent" },
      },
      {
        title: "Approve Q3 priorities",
        actor: { kind: "person", name: "You" },
      },
    ],
  },
];

const ActorChip = ({ actor }: { actor: Actor }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
      actor.kind === "agent"
        ? "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-600/20"
        : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/20",
    )}
  >
    {actor.kind === "agent" ? (
      <Bot className="size-3" />
    ) : (
      <User className="size-3" />
    )}
    {actor.name}
  </span>
);

/**
 * Decorative, static illustration of a shared board. It is not interactive and
 * is described for assistive technology by a single label.
 */
export const BoardPreview = () => {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div
        role="img"
        aria-label="Illustration of a board with To do, Doing and Done lists. Cards carry a chip naming who changed them last, a person or an agent, and an activity panel lists the latest moves."
        className="relative"
      >
        <div
          aria-hidden="true"
          className="absolute -inset-x-6 -inset-y-8 -z-10 rounded-[2rem] bg-gradient-to-br from-sky-500/15 via-cyan-400/10 to-amber-300/15 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-sky-700 to-cyan-700 px-4 py-2.5 text-white">
            <span className="size-2.5 rounded-full bg-white/50" />
            <span className="size-2.5 rounded-full bg-white/50" />
            <span className="size-2.5 rounded-full bg-white/50" />
            <span className="ml-2 truncate text-sm font-semibold">
              Operations board
            </span>
            <span className="ml-auto hidden items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] sm:inline-flex">
              <User className="size-3" /> 2 people
              <span className="mx-1 opacity-60">·</span>
              <Bot className="size-3" /> 3 agents
            </span>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1fr_17rem]">
            <div className="grid grid-cols-1 gap-3 bg-slate-50 p-3 sm:grid-cols-3 sm:p-4">
              {columns.map((column, columnIndex) => (
                <div
                  key={column.title}
                  className={cn(
                    "rounded-xl bg-slate-100 p-2.5",
                    columnIndex > 0 && "hidden sm:block",
                  )}
                >
                  <p className="mb-2 px-1 text-xs font-semibold text-slate-700">
                    {column.title}
                  </p>
                  <div className="space-y-2">
                    {column.cards.map((card) => (
                      <div
                        key={card.title}
                        className={cn(
                          "rounded-lg border bg-white p-2.5 text-left shadow-xs",
                          card.highlight
                            ? "border-sky-300 ring-2 ring-sky-500/20"
                            : "border-slate-200",
                        )}
                      >
                        {card.label && (
                          <span
                            className={cn(
                              "mb-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                              card.label.className,
                            )}
                          >
                            {card.label.text}
                          </span>
                        )}
                        <p className="text-[13px] leading-snug text-slate-800">
                          {card.title}
                        </p>
                        <div className="mt-2">
                          <ActorChip actor={card.actor} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-4 text-left lg:border-t-0 lg:border-l">
              <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Activity
              </p>
              <ol className="space-y-3 text-[13px] text-slate-700">
                <li className="flex gap-2">
                  <Bot className="mt-0.5 size-4 shrink-0 text-sky-600" />
                  <span>
                    <strong className="font-semibold">Build agent</strong> moved
                    “Fix flaky export job” to Doing
                    <span className="block text-[11px] text-slate-500">
                      via MCP · agent token
                    </span>
                  </span>
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong className="font-semibold">You</strong> approved a
                    proposal from Writer agent
                    <span className="block text-[11px] text-slate-500">
                      via the board
                    </span>
                  </span>
                </li>
                <li className="flex gap-2">
                  <Bot className="mt-0.5 size-4 shrink-0 text-sky-600" />
                  <span>
                    <strong className="font-semibold">Research agent</strong>{" "}
                    reported friction: “search can’t filter by label”
                    <span className="block text-[11px] text-slate-500">
                      to the suggestion box
                    </span>
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Illustration. Agent access, approvals and friction reports are coming
        soon.
      </p>
    </div>
  );
};
