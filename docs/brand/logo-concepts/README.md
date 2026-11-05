# Logo concepts

Five candidate marks for Cardigan, kept here so one can be picked. Nothing in the
app uses them yet; `public/logo.svg` is still the logo.

Open [`index.html`](index.html) in a browser for the preview: every mark at 16, 32,
64 and 256 px on light and dark, in a mock app header and in browser tabs, and a
strip comparing all five favicons. [`screenshots/`](screenshots/) has the same views
as images.

| Concept | Idea |
| --- | --- |
| [Stitch](stitch/) | A knit stitch of a person loop and an agent loop, two rows; also a double check |
| [Handoff](handoff/) | Two cards mid-pass, the agent's tilted behind the person's |
| [Open C](open-c/) | A bold open C completed by a card landing in its gap |
| [Button](button/) | A cardigan button whose four holes sit on a 2x2 grid, like a small board |
| [Placket](placket/) | A people panel and an agent panel held together by a column of buttons |

## Rules the marks follow

- Ink stands for people and sky for agents. Light: ink `#171717` (neutral-900) and
  sky `#0069a8`, the app's primary button color (Tailwind v4 `sky-700`). Dark: ink
  `#fafafa` (neutral-50) and sky `#00bcff` (`sky-400`).
- Marks are drawn on a 32-unit grid (`viewBox="0 0 32 32"`), so one unit is half a
  pixel at 16 px. Load-bearing shapes are at least 4 units; each README names any
  finer flourish.
- The wordmark is lowercase "cardigan" built from round-capped strokes, so no font
  file is needed. Its stroke weight is tuned per concept to match the mark.

Each folder has `mark-light.svg` and `mark-dark.svg` (the mark alone, usable as a
favicon), `lockup-light.svg` and `lockup-dark.svg` (mark plus wordmark), and a
README with the rationale and one risk to watch.

## Rebuild

`python3 docs/brand/logo-concepts/build.py` regenerates every SVG and `index.html`
from the shapes defined in that script. It needs only the Python standard library.
