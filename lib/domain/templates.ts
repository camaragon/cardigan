/** Seed data only: templates never govern a board after creation (ADR 0006). */
export interface BoardTemplate {
  key: string;
  name: string;
  description: string;
  lists: string[];
  labels: { name: string; color: string }[];
  notice?: string;
}

export const TEMPLATES = {
  blank: {
    key: "blank",
    name: "Blank",
    description: "Start with an empty board.",
    lists: [],
    labels: [],
  },
  product_management: {
    key: "product_management",
    name: "Product management",
    description: "Take work from backlog through review and acceptance.",
    lists: ["Backlog", "To Do", "In Progress", "In Review", "Ready For Acceptance", "Done"],
    labels: [
      { name: "Feature", color: "#61bd4f" },
      { name: "Bug", color: "#eb5a46" },
      { name: "Chore", color: "#c377e0" },
    ],
    notice: "Work moves left to right. In Review is for review of finished work; Ready For Acceptance waits for the owner to accept and move it to Done.",
  },
} satisfies Record<string, BoardTemplate>;

export type BoardTemplateKey = keyof typeof TEMPLATES;
