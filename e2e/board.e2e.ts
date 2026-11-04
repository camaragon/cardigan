/**
 * Core journeys: create a board, add lists and a card, move the card.
 *
 * Agent steps (`agent.act` / `agent.assert`) handle UI that is awkward to
 * script, such as the board image picker and drag and drop. Each one is
 * followed by a deterministic check.
 *
 * Skipped unless the Clerk and model env vars are set (see e2e/README.md).
 */
import { describe, test } from "@e2e-dev/web";
import { expect } from "e2e";
import { clerkEnv, signInPath, skipReason, useClerkTestingToken } from "./clerk";

const SESSION = "member";

if (!skipReason) {
  test.setup("sign in as the test user", { sessions: [SESSION] }, async ({ app, browser, screen, session }) => {
    await useClerkTestingToken(browser);
    await app.open(await signInPath());

    // The proxy sends users with no active organization to /select-org.
    await expect(browser).toHaveURL(/\/(select-org|organization\/)/);
    if (new URL(await browser.url()).pathname.startsWith("/select-org")) {
      await screen.getByText(clerkEnv.orgName).tap();
    }
    await expect(browser).toHaveURL(/\/organization\/org_/);

    await session.save(SESSION);
  });
}

// Spread so the `session` option only exists when its setup is registered.
const options = skipReason ? { skip: skipReason } : { session: SESSION };

describe("boards", options, () => {
  test("create a board, add a list and a card", async ({ app, agent, browser, screen }) => {
    const id = Date.now().toString(36);
    const boardTitle = `E2E board ${id}`;
    const listTitle = `Todo ${id}`;
    const cardTitle = `First card ${id}`;

    await useClerkTestingToken(browser);
    await app.open("/select-org");
    await expect(browser).toHaveURL(/\/organization\/org_/);

    await agent.act(`create a new board titled "${boardTitle}", picking any background image`);
    await expect(browser).toHaveURL(/\/board\/[0-9a-f-]+$/);
    await expect(screen.getByText(boardTitle)).toBeVisible();

    // Deterministic: the list form has stable labels.
    await screen.getByText("Add a list").tap();
    await screen.getByPlaceholder("Enter list title...").fill(listTitle);
    await screen.getByRole("button", "Add list").tap();
    await expect(screen.getByText(listTitle)).toBeVisible();

    await agent.act(`add a card titled "${cardTitle}" to the "${listTitle}" list`);
    await expect(screen.getByText(cardTitle)).toBeVisible();

    // The card survives a reload, so it was saved.
    await browser.reload();
    await expect(screen.getByText(cardTitle)).toBeVisible();
  });

  test("move a card to another list", async ({ app, agent, browser, screen }) => {
    const id = Date.now().toString(36);
    const cardTitle = `Moving card ${id}`;

    await useClerkTestingToken(browser);
    await app.open("/select-org");
    await expect(browser).toHaveURL(/\/organization\/org_/);

    await agent.act(`create a new board titled "Move ${id}", picking any background image`);
    await expect(browser).toHaveURL(/\/board\/[0-9a-f-]+$/);

    for (const list of [`Todo ${id}`, `Done ${id}`]) {
      await screen.getByText("Add a list").tap();
      await screen.getByPlaceholder("Enter list title...").fill(list);
      await screen.getByRole("button", "Add list").tap();
      await expect(screen.getByText(list)).toBeVisible();
    }

    await agent.act(`add a card titled "${cardTitle}" to the "Todo ${id}" list`);
    await expect(screen.getByText(cardTitle)).toBeVisible();

    await agent.act(`drag the "${cardTitle}" card into the "Done ${id}" list`);

    // Reload so the check reads persisted order, not optimistic UI state.
    await browser.reload();
    await expect(screen.getByText(cardTitle)).toBeVisible();
    await agent.assert(`the "${cardTitle}" card is in the "Done ${id}" list, and "Todo ${id}" has no cards`);
  });
});
