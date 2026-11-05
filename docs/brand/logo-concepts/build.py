#!/usr/bin/env python3
"""Regenerate every logo concept SVG and the preview page.

Run from anywhere: python3 docs/brand/logo-concepts/build.py

Marks sit on a 32-unit grid. Ink stands for people and the app's sky accent for
agents. The wordmark is lowercase "cardigan" built from strokes, so no font is
needed. Output is deterministic: rerunning without edits changes nothing.
"""

import base64
import html
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent

# Ink is Tailwind neutral-900 / neutral-50. Sky is the app's primary button
# color (Tailwind v4 sky-700) on light and sky-400 on dark, converted from
# oklch(50% 0.134 242.749) and oklch(74.6% 0.16 232.661).
THEMES = {
    "light": {"ink": "#171717", "sky": "#0069a8"},
    "dark": {"ink": "#fafafa", "sky": "#00bcff"},
}


def n(v):
    """Format a number with at most two decimals and no trailing zeros."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def circle(cx, cy, r):
    """A full circle as one closed path, so it can join a compound path."""
    return f"M{n(cx - r)} {n(cy)}a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0Z"


# ---- Marks: each returns the inner SVG for a 32x32 viewBox. ----


def stitch(ink, sky, uid):
    # Two rows of a knit stitch; each V is a person loop and an agent loop.
    rows = []
    for y in (4, 16):
        rows.append(f'<path d="M7 {y}L13.2 {y + 8}" stroke="{ink}" stroke-width="6" stroke-linecap="round"/>')
        rows.append(f'<path d="M25 {y}L18.8 {y + 8}" stroke="{sky}" stroke-width="6" stroke-linecap="round"/>')
    return "".join(rows)


def handoff(ink, sky, uid):
    # The agent's card is tilted behind the person's; a mask cuts a clear gap.
    return (
        f'<mask id="{uid}-gap"><rect width="32" height="32" fill="#fff"/>'
        '<rect x="9" y="11" width="22" height="18" rx="5" fill="#000"/></mask>'
        f'<g mask="url(#{uid}-gap)"><rect x="2.5" y="4" width="18" height="14" rx="3.2" '
        f'fill="{sky}" transform="rotate(-10 11.5 11)"/></g>'
        f'<path fill-rule="evenodd" fill="{ink}" d="M14 13h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H14'
        'a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3ZM15 17.5h7.5v2.5H15Z"/>'
    )


def open_c(ink, sky, uid):
    # A ring of width 6 opened on the right; a card lands in the gap.
    return (
        f'<path d="M25.03 6.65A13 13 0 1 0 25.03 25.35L20.86 21.04A7 7 0 1 1 20.86 10.96Z" fill="{ink}"/>'
        f'<rect x="24" y="11" width="6.5" height="10" rx="2" fill="{sky}"/>'
    )


def button(ink, sky, uid):
    # Four holes on a 2x2 grid, like a tiny board, plus a faint rim.
    holes = "".join(circle(cx, cy, 2.6) for cx in (12, 20) for cy in (12, 20))
    rim = circle(16, 16, 11.4) + circle(16, 16, 10.2)
    return (
        f'<path fill-rule="evenodd" fill="{sky}" d="{circle(16, 16, 14.5)}{holes}"/>'
        f'<path fill-rule="evenodd" fill="{ink}" fill-opacity=".22" d="{rim}"/>'
    )


def placket(ink, sky, uid):
    # People panel and agent panel meet at the neckline, buttoned down the seam.
    # Holes sit on whole 16 px pixels (cy 16 and 24, r 2) with 4-unit gaps to
    # the neckline, each other and the hem, so both stay visible as favicons.
    return (
        f'<mask id="{uid}-holes"><rect width="32" height="32" fill="#fff"/>'
        '<circle cx="16" cy="16" r="2" fill="#000"/><circle cx="16" cy="24" r="2" fill="#000"/></mask>'
        f'<g mask="url(#{uid}-holes)">'
        f'<path d="M5 2h6.5L16 10V30H7a4 4 0 0 1-4-4V4a2 2 0 0 1 2-2Z" fill="{ink}"/>'
        f'<path d="M27 2h-6.5L16 10V30h9a4 4 0 0 0 4-4V4a2 2 0 0 0-2-2Z" fill="{sky}"/></g>'
    )


# key, title, mark, wordmark stroke, letter gap, i-dot color, one-line rationale
CONCEPTS = [
    ("stitch", "Stitch", stitch, 3.4, 6.8, "sky",
     "Two strands, one fabric: each knit stitch is a V of two loops, a person and an agent, "
     "stacked into a column that also reads as a double check."),
    ("handoff", "Handoff", handoff, 4.2, 7.2, "ink",
     "Two cards mid-pass: the agent's card slides behind the person's. "
     "Work moves between people and agents on one board."),
    ("open-c", "Open C", open_c, 3.6, 6.8, "ink",
     "A bold C for Cardigan, held open; the last card slots into the gap and completes the letter, "
     "the moment work lands where it belongs."),
    ("button", "Button", button, 3.0, 6.6, "sky",
     "A cardigan button fastens two sides into one garment, and four holes on a grid make a tiny board. "
     "Also a nod to a UI button."),
    ("placket", "Placket", placket, 4.0, 7.0, "ink",
     "The front of a cardigan: a people panel and an agent panel meet at the neckline, "
     "held by a column of buttons that doubles as a list."),
]

# ---- Wordmark: lowercase "cardigan" from round-capped strokes. ----

CY = 29  # x-height center line in the 52-unit lockup
OUTER = 10  # bowl radius plus half the stroke, so every weight shares one x-height


def wordmark(sw, gap):
    """Return (path data, i-dot (cx, cy, r), right edge) for the strokes."""
    r = OUTER - sw / 2
    top, bot = CY - r, CY + r
    d = []
    # c: a bowl opened 48 degrees either side of horizontal
    a = math.radians(48)
    x = 67 + r * math.cos(a)
    d.append(f"M{n(x)} {n(CY - r * math.sin(a))}A{n(r)} {n(r)} 0 1 0 {n(x)} {n(CY + r * math.sin(a))}")

    def bowl_with_stem(x, stem_top):
        d.append(circle(x + r, CY, r))
        d.append(f"M{n(x + 2 * r)} {n(stem_top)}V{n(bot)}")
        return x + 2 * r

    x = bowl_with_stem(x + gap, top)  # a
    x += gap  # r
    d.append(f"M{n(x)} {n(top)}V{n(bot)}")
    d.append(f"M{n(x)} {n(top + 0.95 * r)}A{n(0.95 * r)} {n(0.95 * r)} 0 0 1 {n(x + 0.95 * r)} {n(top)}")
    x = bowl_with_stem(x + 0.95 * r + gap, CY - r - 9)  # d
    x += gap  # i
    d.append(f"M{n(x)} {n(top)}V{n(bot)}")
    dot = (x, top - 2.12 * sw, 0.66 * sw)
    x += gap  # g: bowl, stem and a hook that ends 160 degrees round
    d.append(circle(x + r, CY, r))
    h = 0.9 * r
    hx, hy = x + 2 * r - h + h * math.cos(math.radians(160)), bot + h * math.sin(math.radians(160))
    d.append(f"M{n(x + 2 * r)} {n(top)}V{n(bot)}A{n(h)} {n(h)} 0 0 1 {n(hx)} {n(hy)}")
    x = bowl_with_stem(x + 2 * r + gap, top)  # a
    x += gap  # n
    d.append(f"M{n(x)} {n(top)}V{n(bot)}M{n(x)} {n(bot)}V{CY}A{n(r)} {n(r)} 0 0 1 {n(x + 2 * r)} {CY}V{n(bot)}")
    return "".join(d), dot, x + 2 * r + sw / 2 + 2


def svg(w, h, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n(w)} {n(h)}" width="{n(w)}" height="{n(h)}" '
        f'role="img" aria-label="Cardigan"><title>Cardigan</title>{body}</svg>'
    )


def build_files(key, mark, sw, gap, dot_role, theme):
    c = THEMES[theme]
    mark_svg = svg(32, 32, mark(c["ink"], c["sky"], f"{key}-{theme}"))
    d, (dx, dy, dr), width = wordmark(sw, gap)
    lockup_svg = svg(width, 52, (
        f'<g transform="translate(0 2.5) scale(1.38)">{mark(c["ink"], c["sky"], f"{key}-{theme}-lockup")}</g>'
        f'<path d="{d}" fill="none" stroke="{c["ink"]}" stroke-width="{n(sw)}" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
        f'<circle cx="{n(dx)}" cy="{n(dy)}" r="{n(dr)}" fill="{c[dot_role]}"/>'
    ))
    return mark_svg, lockup_svg


# ---- Preview page ----

CSS = """:root { --bg: #fafafa; --fg: #171717; --muted: #737373; --line: #e5e5e5; --card: #fff;
  --sky: SKY; --dark-bg: #0a0a0a; --dark-card: #171717; --dark-line: rgba(255,255,255,.1); }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg);
  font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1120px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -.01em; }
.intro { color: var(--muted); max-width: 70ch; margin: 0 0 16px; }
nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 24px; }
nav a { color: var(--sky); text-decoration: none; border: 1px solid var(--line); background: var(--card);
  padding: 4px 10px; border-radius: 999px; font-size: 13px; }
section { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 20px; margin: 0 0 24px; }
section > header { display: grid; grid-template-columns: 1fr auto; gap: 0 16px; margin-bottom: 16px; }
h2 { margin: 0; font-size: 20px; }
section > header p { grid-column: 1 / -1; margin: 4px 0 0; color: var(--muted); max-width: 75ch; }
code { font-size: 12px; color: var(--muted); }
header code { grid-column: 2; grid-row: 1; align-self: center; }
h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 20px 0 8px; }
.swatch { border-radius: 8px; padding: 20px; margin: 0 0 12px; overflow-x: auto; }
.swatch.light { background: #fff; border: 1px solid var(--line); }
.swatch.dark { background: var(--dark-bg); }
.sizes { display: flex; align-items: flex-end; gap: 28px; flex-wrap: wrap; }
figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
figcaption { font-size: 11px; color: #a3a3a3; font-variant-numeric: tabular-nums; }
.lockup { display: block; margin-top: 20px; max-width: 100%; height: auto; max-height: 52px; }
.appbar { height: 56px; display: flex; align-items: center; gap: 16px; padding: 0 16px; border-radius: 8px;
  margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
.appbar.light { background: #fff; border: 1px solid var(--line); }
.appbar.dark { background: var(--dark-card); border: 1px solid var(--dark-line); color: #fafafa; }
.appbar img { height: 30px; width: auto; }
.create { background: var(--sky); color: #fff; font-size: 13px; padding: 4px 8px; border-radius: 4px; }
.spacer { flex: 1; }
.org { font-size: 13px; opacity: .7; white-space: nowrap; }
.avatar { width: 30px; height: 30px; border-radius: 50%; background: #d4d4d4; flex: none; }
.dark .avatar { background: #404040; }
.tabs { display: flex; gap: 2px; padding: 8px 8px 0; border-radius: 8px 8px 0 0; margin-bottom: 8px; overflow: hidden; }
.tabs.light { background: #e7e7e9; color: #3c4043; }
.tabs.dark { background: #202124; color: #e8eaed; }
.tab { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px; font-size: 12px;
  border-radius: 8px 8px 0 0; min-width: 0; width: 230px; flex: none; }
.tab span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.tab i { font-style: normal; opacity: .5; }
.lineup .tab { width: auto; flex: 1 1 140px; }
.tabs.light .active, .lineup.light .tab { background: #fff; }
.tabs.dark .active, .lineup.dark .tab { background: #35363a; }
.tab .blank { width: 16px; height: 16px; flex: none; border-radius: 50%; border: 1.5px solid currentColor; opacity: .4; }
@media (max-width: 640px) { .org { display: none; } }"""


def uri(s):
    return "data:image/svg+xml;base64," + base64.b64encode(s.encode()).decode()


def img(s, size=None, height=None, alt="", cls=""):
    dims = f' width="{size}" height="{size}"' if size else f' height="{height}"'
    c = f' class="{cls}"' if cls else ""
    return f'<img{c} src="{uri(s)}"{dims} alt="{html.escape(alt)}">'


def concept_section(key, title, blurb, files):
    out = [f'<section id="{key}"><header><h2>{title}</h2><p>{html.escape(blurb)}</p><code>{key}/</code></header>']
    for theme in THEMES:
        mark, lockup = files[theme]
        figs = "".join(
            f'<figure>{img(mark, size=s, alt=f"{title} mark, {s} px, {theme}")}<figcaption>{s}</figcaption></figure>'
            for s in (16, 32, 64, 256)
        )
        out.append(f'<div class="swatch {theme}"><div class="sizes">{figs}</div>'
                   f'{img(lockup, height=52, alt=f"{title} lockup, {theme}", cls="lockup")}</div>')
    out.append("<h3>In the app header</h3>")
    for theme in THEMES:
        out.append(f'<div class="appbar {theme}">{img(files[theme][1], height=30)}<span class="create">Create</span>'
                   '<span class="spacer"></span><span class="org">Product workspace</span><span class="avatar"></span></div>')
    out.append("<h3>In a browser tab</h3>")
    for theme in THEMES:
        out.append(f'<div class="tabs {theme}"><div class="tab active">{img(files[theme][0], size=16)}'
                   '<span>Product board · Cardigan</span><i>×</i></div>'
                   '<div class="tab"><span class="blank"></span><span>New tab</span><i>×</i></div></div>')
    out.append("</section>")
    return "\n".join(out)


def page(all_files):
    nav = "".join(f'<a href="#{k}">{t}</a>' for k, t, *_ in CONCEPTS)
    strip = "\n".join(
        f'<div class="tabs {theme} lineup">'
        + "".join(f'<div class="tab">{img(all_files[k][theme][0], size=16)}<span>{t}</span></div>' for k, t, *_ in CONCEPTS)
        + "</div>"
        for theme in THEMES
    )
    sections = "\n".join(concept_section(k, t, blurb, all_files[k]) for k, t, _m, _s, _g, _d, blurb in CONCEPTS)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cardigan logo concepts</title>
<style>
{CSS.replace("SKY", THEMES["light"]["sky"])}
</style>
</head>
<body>
<main>
<h1>Cardigan logo concepts</h1>
<p class="intro">Five directions for an agent-native task board where people and AI agents work on the same boards.
Ink stands for people and the app's sky accent for agents. Each concept has a mark, a lockup with the wordmark, and
light and dark variants. Nothing here replaces the current logo. Regenerate with <code>python3 build.py</code>.</p>
<nav>{nav}</nav>
<section><header><h2>All favicons side by side</h2><p>Each mark at 16 px in a tab strip, light and dark browser chrome.</p></header>
{strip}
</section>
{sections}
</main>
</body>
</html>
"""


def main():
    all_files = {}
    for key, _title, mark, sw, gap, dot_role, _blurb in CONCEPTS:
        folder = OUT / key
        folder.mkdir(exist_ok=True)
        all_files[key] = {}
        for theme in THEMES:
            m, lockup = build_files(key, mark, sw, gap, dot_role, theme)
            (folder / f"mark-{theme}.svg").write_text(m + "\n")
            (folder / f"lockup-{theme}.svg").write_text(lockup + "\n")
            all_files[key][theme] = (m, lockup)
    (OUT / "index.html").write_text(page(all_files))


if __name__ == "__main__":
    main()
