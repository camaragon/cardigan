# Cardigan: an agent-native product tracking board

Status: draft
Maintainer: owner · Updated: 2026-11-04
Decisions: [agent access](../adr/0001-agent-access-through-mcp.md), [private deployment](../adr/0002-private-deployment.md), [backlog stays authoritative during transition](../adr/0003-backlog-authoritative-during-transition.md)

## Problem and why now

The owner runs several products with AI agents: a supervisor agent that executes
work from its own backlog, and a PM agent that proposes and grooms work. Proposals,
priorities and open questions for the owner are scattered across chats and task
files, so the owner has no single place to see and order the work for each
product, and agents have no structured way to read or propose it. Cardigan is a
working Kanban board with no users yet besides the owner, so it can be reshaped
now without migrating anyone.

## Goal and boundaries

Make Cardigan a standalone product tracking board that agents use as first-class
actors through an MCP server, and that improves through that use.

- **Product workspaces:** one Clerk organization (workspace) per product. Cardigan
  is a product too and has its own workspace. Products are never mixed on one board.
- **Agents propose; the owner decides:** agents create, comment on and tidy
  proposal cards. Only the owner moves a card into the Queue or changes its order;
  Queue order is the owner's priority order.
- **Waiting on owner:** open questions for the owner appear as read-only cards on
  the product's board. Answers stay in chat; the supervisor agent resolves the card.
- **Flywheel:** agents file friction they hit while using Cardigan as proposal
  cards on Cardigan's own workspace, and every human and agent action is attributed
  in the activity log, so usage data can drive improvements across all products.

Non-goals for this bet: public hosting, billing, a public REST or GraphQL API,
agent deletes, answering owner questions inside Cardigan, and replacing the
supervisor agent's backlog as the record of execution progress (see ADR 0003).

## Users and flow

1. The owner creates a product workspace and an agent token for each agent that
   works on it, and pastes the token into that agent's MCP configuration.
2. The PM agent files proposals (idempotent on its own external key), comments and
   tidies titles, labels and duplicates.
3. The owner drags chosen proposals into the Queue and orders it.
4. The supervisor agent reads Queue changes since its last check, executes from
   its own backlog, comments progress links on the card, and moves the card to
   Done when the work lands.
5. When the supervisor agent needs a decision, it posts a Waiting on owner card;
   the owner answers in chat and the agent resolves the card.

## Success

Proposal-to-decision time, share of proposals queued versus closed, friction
reports filed and resolved, MCP tool error rate, and owner time spent on the board.
The owner sets baselines and targets after the first month of attributed activity;
none are invented here.

## Acceptance criteria

- **AC-1 Agent tokens:** the owner can create a named agent token in a workspace's
  settings; it is shown once and stored only as a hash. Calls with it act only in
  that workspace: another workspace's board or card ids return not found. After
  revocation the next call fails as unauthorized. Creation and revocation are logged.
- **AC-2 MCP tools:** the MCP server offers list, create, move, comment and search
  for cards, plus a changed-since query, with the same validation as the UI.
- **AC-3 Idempotent create:** two creates with the same external key in one
  workspace return the same card id and leave one card and one create log entry.
- **AC-4 No agent deletes:** no MCP tool deletes a board, list, card, label or
  comment, and an agent cannot create, change or revoke tokens.
- **AC-5 Queue authority:** an agent move into the Queue or reorder within it is
  rejected and changes nothing; the same move by the owner in the UI succeeds.
- **AC-6 Attribution:** every agent mutation writes an activity entry naming the
  agent, its token and the MCP surface; the activity view shows agents distinctly
  from people. Human entries record the UI surface.
- **AC-7 Audited moves:** an owner drag of a card between lists or within a list
  writes an activity entry with the card, source list, target list and position.
- **AC-8 Approval visible to agents:** after the owner moves a proposal into the
  Queue, the changed-since query returns that move, attributed to the owner, with
  a new cursor; repeating the query with the old cursor returns the same events.
- **AC-9 Owner-call cards:** a Waiting on owner card created by the supervisor
  agent cannot be dragged, edited or deleted in the UI and says to answer in chat;
  the agent's resolution is attributed in the activity log.
- **AC-10 Friction reports:** an agent with any workspace token can file one
  friction proposal onto Cardigan's own workspace, attributed to the agent and
  source workspace, without gaining read access to that workspace.
- **AC-11 Private mode:** with private mode on and no Stripe or Unsplash keys, the
  app builds and runs on the tailnet only; no billing page, upgrade prompt or
  board cap appears, Stripe is never called, and boards get a default background.
- **AC-12 Workspaces:** Clerk sign-in and organization switching keep working, and
  a person sees only boards in workspaces they belong to.
