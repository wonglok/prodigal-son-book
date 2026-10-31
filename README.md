# The Prodigal Son — Illustrated Storybook

An illustrated retelling of the Parable of the Lost Son (**Luke 15:11–32**) as a
single-page, print-friendly web book. Ten illustrations are generated with fal's
`openai/gpt-image-2.5/flare/text-to-image` model using a locked style and
character bible so the father, both sons, their clothing, and the estate stay
consistent across every page.

## Structure

```
index.html            The book (cover, family page, nine story pages, closing)
styles.css            Typography, layout, responsive and print styles
fonts/                Cormorant Garamond + Inter (local woff2)
images/               Generated illustrations + manifest.json
prompts/scenes.json   Style, character bible, and per-page scene prompts
scripts/generate_images.mjs  fal generation pipeline
```

## Consistency method

Every prompt is assembled from the same three pieces in `prompts/scenes.json`:

1. a fixed **style** string (gouache/watercolour storybook, Mediterranean light,
   no text or borders),
2. verbatim **character/setting** descriptions (father, younger son, older son,
   estate, distant town, pig farm),
3. a short **scene** direction.

That keeps faces, hair, clothing colours, architecture, and palette stable while
the composition changes per page.

## Generate the images

```bash
npm install
# FAL_KEY from the environment, this project's .env, or ../prodigal-son/.env
npm run generate            # only missing pages
npm run generate -- --force # regenerate all
npm run generate -- --only scene-05-father-runs
npm run generate -- --dry-run   # print prompts, no billing
```

Outputs land in `images/` and are recorded in `images/manifest.json` with request
IDs, dimensions, and prompts. Generation is billable; `--quality high` (the
default) is the most expensive tier.

## View the book

```bash
npm run serve
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`. Turn pages with the arrow keys, the on-screen
buttons, or a swipe; the URL hash (`#1`–`#12`) links to a specific page and the
progress bar tracks your place. The layout is responsive and includes print
styles — use the browser's "Print to PDF" for a landscape A4 book.

The illustrations currently in `images/` are interim vector plates rendered from
the Remotion illustration system (same characters, palette, and settings on every
page). Running `npm run generate` replaces them with fal-generated art once
`FAL_KEY` is configured; the page filenames are unchanged, so the HTML needs no
edits.

## Deploy

The site is fully static. GitHub Pages can serve it from the repository root.
