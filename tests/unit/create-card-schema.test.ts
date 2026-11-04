import { describe, expect, it } from "vitest";
import { CreateCard } from "@/actions/create-card/schema";

const valid = { title: "Write tests", boardId: "board-1", listId: "list-1" };

const fieldErrors = (input: unknown) => {
  const result = CreateCard.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return result.error.flatten().fieldErrors;
};

describe("CreateCard schema", () => {
  it("accepts a valid card", () => {
    expect(CreateCard.parse(valid)).toEqual(valid);
  });

  it("requires a title", () => {
    expect(fieldErrors({ ...valid, title: undefined }).title).toEqual([
      "Title is required",
    ]);
  });

  it("rejects a non-string title with the same message", () => {
    expect(fieldErrors({ ...valid, title: 42 }).title).toEqual([
      "Title is required",
    ]);
  });

  it("rejects titles shorter than 3 characters", () => {
    expect(fieldErrors({ ...valid, title: "ab" }).title).toEqual([
      "Title must be at least 3 characters long",
    ]);
  });

  it("requires boardId and listId", () => {
    const errors = fieldErrors({ title: "Write tests" });
    expect(errors.boardId).toBeDefined();
    expect(errors.listId).toBeDefined();
  });
});
