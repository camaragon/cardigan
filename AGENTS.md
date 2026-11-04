# Agent Instructions

- Product scope lives in [the PRD](docs/product/prd.md); architecture decisions live in [docs/adr/](docs/adr/).
- **Cardigan is a public repository and product.** Never name the owner's other products, clients, agents or private infrastructure (host names, network names) anywhere: code, docs, ADRs, commit messages, PR titles and descriptions, issues, seed data or examples. This applies even when a change serves the owner's own workflow. Use generic words instead: a product workspace, the owner, a supervisor agent, a PM agent, a private host.

## Product requirements

Write a PRD in `docs/product/` only for a real product bet: a new product, a new
major user journey, a material change to a product promise, or open product
choices that would lead implementers to build different things. Keep it to about
a page, with status `draft`, `approved` or `superseded` and testable acceptance
criteria. No PRD for fixes, copy, settings, refactors, or work an approved PRD
already covers. Unvalidated ideas start as a few private lines elsewhere,
not a PRD.

## Architecture decisions

Write an ADR in `docs/adr/` only for an architecturally significant decision:
agent or approval authority (who can create, move, approve or delete work),
hard-to-reverse data or workspace isolation, a real choice between alternatives,
a major dependency or public interface, or superseding an ADR. Never for UI,
flags, refactors, fixes, tests, or docs. Use the next unused four-digit number in
`docs/adr/` and follow `docs/adr/0001-agent-access-through-mcp.md`: context,
decision, and consequences. Mark a replaced ADR as superseded rather than
rewriting it. Link the ADR from the PR description.

## Retired tools

OpenSpec and Beads (`bd`) are retired for new work: do not create OpenSpec
changes or Beads issues. `.beads/issues.jsonl` (all issues closed) and
`openspec/config.yaml` stay as history.

## Commits and branches

- Commit messages and PR titles follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `type(optional scope): lowercase imperative description`, using `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`, or `build`; mark breaking changes with `!` or a `BREAKING CHANGE:` footer.
- Name new branches `<type>/<short-kebab-description>` using a Conventional Commits type, such as `fix/card-ordering`.
- Never rename an open PR's head branch: GitHub closes the PR when its head branch is renamed.

## Pull requests

Work on a branch and open a pull request; never push to `main`. Before opening a
PR that changes code, run `npm run lint` and `npm run build`.
