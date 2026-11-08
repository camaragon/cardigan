import { afterEach, expect, it, vi } from "vitest";
import { FetchError, fetcher } from "@/lib/fetcher";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { card: { findUnique: mocks.findUnique } } }));
import { GET } from "@/app/api/cards/[cardId]/route";
const read = () => GET(new Request("http://localhost/api/cards/deleted"), {
  params: Promise.resolve({ cardId: "deleted" }),
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it.each([401, 404, 500])("preserves HTTP %s for plaintext and JSON errors", async (status) => {
  for (const body of ["Read failed", JSON.stringify({ error: "Read failed" })]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));
    await expect(fetcher("/api/cards/deleted")).rejects.toMatchObject({ name: "FetchError", status });
    await expect(fetcher("/api/cards/deleted")).rejects.toBeInstanceOf(FetchError);
  }
});

it("returns successful JSON data", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"id":"demo"}')));
  await expect(fetcher("/api/cards/demo")).resolves.toEqual({ id: "demo" });
});

it("returns 404 for deleted or unavailable cards with the same workspace filter", async () => {
  mocks.auth.mockResolvedValue({ userId: "user", orgId: "workspace" });
  mocks.findUnique.mockResolvedValue(null);
  expect((await read()).status).toBe(404);
  expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "deleted", list: { board: { orgId: "workspace" } } },
  }));
});

it("keeps unauthenticated reads at 401 and server failures at 500", async () => {
  mocks.auth.mockResolvedValue({ userId: null, orgId: null });
  expect((await read()).status).toBe(401);
  expect(mocks.findUnique).not.toHaveBeenCalled();
  mocks.auth.mockResolvedValue({ userId: "user", orgId: "workspace" });
  mocks.findUnique.mockRejectedValue(new Error("Unavailable"));
  expect((await read()).status).toBe(500);
});
