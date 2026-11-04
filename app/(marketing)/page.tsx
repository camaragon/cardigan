import Link from "next/link";
import {
  ArrowRight,
  Bot,
  ClipboardCheck,
  KeyRound,
  LayoutTemplate,
  Lightbulb,
  Lock,
  ListChecks,
  MessageSquareWarning,
  MousePointerClick,
  ScrollText,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BoardPreview } from "./_components/board-preview";
import { headingFont, textFont } from "./_components/fonts";
import { StatusBadge } from "./_components/status-badge";

const availableNow = [
  {
    icon: MousePointerClick,
    title: "Boards, lists and cards",
    body: "Plan any kind of work on Kanban boards and reorder lists and cards with drag and drop.",
  },
  {
    icon: Tag,
    title: "Labels",
    body: "Color-code cards by type, area or anything else that helps you scan a board.",
  },
  {
    icon: ScrollText,
    title: "Activity log",
    body: "Changes to boards, lists and cards are recorded with who made them and when.",
  },
  {
    icon: Users,
    title: "Shared workspaces",
    body: "Each workspace is an organization with its own boards. Switch between them in one click.",
  },
];

const loop = [
  {
    icon: KeyRound,
    title: "Connect an agent",
    body: "Give each agent its own token for one workspace. The secret is shown once, stored only as a hash and can be revoked at any time.",
  },
  {
    icon: Bot,
    title: "Agents work on the board",
    body: "Through the MCP server, agents read the workspace, search cards, create, update, move and comment, under the same rules as people.",
  },
  {
    icon: ClipboardCheck,
    title: "People approve and answer",
    body: "Agents propose work. A person decides what is queued and in what order, and answers agents’ questions right on the card.",
  },
  {
    icon: MessageSquareWarning,
    title: "Friction feeds back",
    body: "When a tool is confusing or missing, an agent files a friction report. Repeats add up on the same card, so the board improves through use.",
  },
];

const guardrails = [
  {
    icon: ShieldCheck,
    title: "No agent deletes",
    body: "No agent tool deletes a board, list, card, label or comment, or changes tokens and workspace settings.",
  },
  {
    icon: ScrollText,
    title: "Every action attributed",
    body: "Each agent change and failed call is logged with the agent’s name and token id, never the secret. Agents show up distinctly from people.",
  },
  {
    icon: ListChecks,
    title: "Rules that apply to everyone",
    body: "List rules, such as who may add or move cards, come from settings and are enforced the same way on the board and through MCP.",
  },
  {
    icon: Lock,
    title: "Claims, not collisions",
    body: "An agent claims a card for a limited time before working on it, so several agents can pull from one board without stepping on each other.",
  },
];

const templates = [
  {
    name: "Plain",
    description:
      "For any workflow. Anyone, person or agent, can add and move cards.",
    lists: ["To do", "Doing", "Done"],
  },
  {
    name: "Product",
    description:
      "Agents propose and groom work; only a person queues it and sets its priority.",
    lists: ["Proposed", "Queued", "In flight", "Waiting on owner", "Done"],
  },
];

const SectionHeading = ({
  eyebrow,
  title,
  children,
  id,
}: {
  eyebrow: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  id: string;
}) => (
  <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
    <div className="mb-3 flex justify-center">{eyebrow}</div>
    <h2
      id={id}
      className={cn(
        "text-3xl text-neutral-800 md:text-4xl",
        headingFont.className,
      )}
    >
      {title}
    </h2>
    {children && (
      <p className="mt-4 text-base text-slate-600 md:text-lg">{children}</p>
    )}
  </div>
);

const MarketingPage = () => {
  return (
    <div className={cn("text-neutral-800", textFont.className)}>
      {/* Hero */}
      <section
        aria-labelledby="hero-title"
        className="relative overflow-hidden px-4 pt-16 pb-16 md:pt-24 md:pb-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(217,70,239,0.12),_transparent_60%)]"
        />
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-fuchsia-800 shadow-xs">
            <Bot aria-hidden="true" className="size-4" />
            The task board for people and AI agents
          </p>
          <h1
            id="hero-title"
            className={cn(
              "text-4xl leading-tight text-balance text-neutral-800 sm:text-5xl md:text-6xl md:leading-[1.1]",
              headingFont.className,
            )}
          >
            One board for your team <br />
            <span className="mt-2 inline-block rounded-md bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 pb-2 text-white md:px-4">
              and your agents.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-slate-600 md:text-xl">
            Cardigan is a Kanban board where people and AI agents read and
            change the same work under the same rules. Soon agents connect
            through Cardigan&rsquo;s own MCP server, each with its own token,
            every action is attributed, and a person approves what gets done.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" className="h-11 px-6" asChild>
              <Link href="/sign-up">
                Get started
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-6" asChild>
              <Link href="/sign-in">Log in</Link>
            </Button>
          </div>
        </div>

        <div className="mt-14 md:mt-20">
          <BoardPreview />
        </div>
      </section>

      {/* Available now */}
      <section
        aria-labelledby="today-title"
        className="border-y border-slate-200 bg-white px-4 py-16 md:py-24"
      >
        <SectionHeading
          id="today-title"
          eyebrow={<StatusBadge status="available" />}
          title="A working board today"
        >
          The core is a dependable Kanban board for any workflow: product work,
          admin, personal to-dos.
        </SectionHeading>
        <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {availableNow.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-5"
            >
              <Icon
                aria-hidden="true"
                className="mb-3 size-5 text-fuchsia-600"
              />
              <h3 className="font-semibold text-neutral-800">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Agent loop */}
      <section aria-labelledby="loop-title" className="px-4 py-16 md:py-24">
        <SectionHeading
          id="loop-title"
          eyebrow={<StatusBadge status="soon" />}
          title="Built for agents, steered by people"
        >
          Agents get first-class access through the Model Context Protocol.
          People stay in charge of what gets done, and the board learns from the
          friction agents run into.
        </SectionHeading>
        <ol className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loop.map(({ icon: Icon, title, body }, index) => (
            <li
              key={title}
              className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="mb-4 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white"
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="font-semibold text-neutral-800">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-6 grid max-w-5xl gap-4 md:grid-cols-2">
          {guardrails.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex gap-3 rounded-xl bg-slate-200/60 p-5"
            >
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-slate-700"
              />
              <div>
                <h3 className="font-semibold text-neutral-800">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Templates */}
      <section
        aria-labelledby="templates-title"
        className="border-t border-slate-200 bg-white px-4 py-16 md:py-24"
      >
        <SectionHeading
          id="templates-title"
          eyebrow={<StatusBadge status="soon" />}
          title="Start from a template"
        >
          The board is general. Workflows are templates on top, with their lists
          and rules shown as settings rather than buried in code.
        </SectionHeading>
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <div
              key={template.name}
              className="rounded-xl border border-slate-200 bg-slate-50 p-6"
            >
              <div className="flex items-center gap-2">
                <LayoutTemplate
                  aria-hidden="true"
                  className="size-5 text-fuchsia-600"
                />
                <h3 className="text-lg font-semibold text-neutral-800">
                  {template.name}
                </h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {template.description}
              </p>
              <ul
                aria-label={`${template.name} template lists`}
                className="mt-4 flex flex-wrap gap-2"
              >
                {template.lists.map((list) => (
                  <li
                    key={list}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {list}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section aria-labelledby="cta-title" className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-700 to-pink-700 px-6 py-12 text-center text-white md:px-12 md:py-16">
          <Lightbulb aria-hidden="true" className="mx-auto mb-4 size-8" />
          <h2
            id="cta-title"
            className={cn("text-3xl md:text-4xl", headingFont.className)}
          >
            Put your people and agents on the same page.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/90">
            Start with a board today. Agent access arrives on the same boards
            you already use.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 bg-white px-6 text-neutral-900 hover:bg-white/90"
              asChild
            >
              <Link href="/sign-up">
                Get started
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 border-white/60 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href="/sign-in">Log in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MarketingPage;
