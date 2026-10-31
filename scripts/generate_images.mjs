#!/usr/bin/env node
/**
 * Generate the storybook illustrations with fal's
 * openai/gpt-image-2.5/flare/text-to-image model.
 *
 *   npm run generate                 # all missing pages
 *   npm run generate -- --force      # regenerate everything
 *   npm run generate -- --only scene-05-father-runs
 *   npm run generate -- --dry-run    # print prompts, no billing
 *
 * Every page reuses the same style and character descriptions from
 * prompts/scenes.json so faces, clothing, and places stay consistent.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fal } from "@fal-ai/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMPTS_PATH = path.join(ROOT, "prompts", "scenes.json");
const IMAGES_DIR = path.join(ROOT, "images");
const MANIFEST_PATH = path.join(IMAGES_DIR, "manifest.json");

const loadEnv = () => {
  if (process.env.FAL_KEY) return "environment";
  for (const candidate of [path.join(ROOT, ".env"), path.join(ROOT, "..", "prodigal-son", ".env")]) {
    try {
      const text = fs.readFileSync(candidate, "utf8");
      for (const line of text.split("\n")) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, raw] = match;
        let value = raw.trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
      if (process.env.FAL_KEY) return path.relative(ROOT, candidate);
    } catch {
      // try the next env file
    }
  }
  return "missing";
};

const parseArgs = (argv) => {
  const opts = { quality: "high", size: "landscape_4_3", force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`Missing value for ${arg}`);
      return next;
    };
    switch (arg) {
      case "--quality":
        opts.quality = value();
        break;
      case "--size":
        opts.size = value();
        break;
      case "--only":
        opts.only = value().split(",").map((s) => s.trim());
        break;
      case "--force":
        opts.force = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--help":
      case "-h":
        console.log(
          "Usage: node scripts/generate_images.mjs [--force] [--only id,id] [--quality level] [--size preset] [--dry-run]"
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
};

const buildPrompt = (book, page) => {
  const cast = (page.cast ?? [])
    .map((key) => {
      if (!book.characters[key]) throw new Error(`Unknown character key: ${key}`);
      return book.characters[key];
    })
    .join("; ");
  return `${book.style}. Characters and setting: ${cast}. Scene: ${page.scene}.`;
};

const loadManifest = () => {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return { model: null, generatedAt: null, pages: {} };
  }
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  const book = JSON.parse(fs.readFileSync(PROMPTS_PATH, "utf8"));
  const pages = book.pages.filter((page) => !opts.only || opts.only.includes(page.id));

  if (pages.length === 0) {
    console.error(`[book] no pages matched${opts.only ? `: ${opts.only.join(", ")}` : ""}`);
    process.exit(1);
  }

  const prompts = pages.map((page) => ({ page, prompt: buildPrompt(book, page) }));

  if (opts.dryRun) {
    for (const { page, prompt } of prompts) console.log(`\n### ${page.id} -> images/${page.file}\n${prompt}`);
    console.log(`\n[book] dry run: ${prompts.length} page prompt(s), no request sent`);
    return;
  }

  const keySource = loadEnv();
  if (keySource === "missing") {
    console.error(
      "FAL_KEY is not set. Approve the fal device link or add FAL_KEY to .env (git-ignored)."
    );
    process.exit(2);
  }
  console.log(`[book] key loaded from ${keySource}`);

  fal.config({ credentials: process.env.FAL_KEY });
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const manifest = loadManifest();
  manifest.model = book.model;

  let made = 0;
  for (const { page, prompt } of prompts) {
    const outputPath = path.join(IMAGES_DIR, page.file);
    if (!opts.force && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log(`[book] ${page.id}: exists, skipping`);
      continue;
    }

    console.log(`[book] ${page.id}: requesting (${opts.quality}, ${opts.size})`);
    const result = await fal.subscribe(book.model, {
      input: {
        prompt,
        image_size: opts.size,
        quality: opts.quality,
        num_images: 1,
        output_format: "png",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          for (const log of update.logs ?? []) console.log(`[book]   ${log.message}`);
        }
      },
    });

    const data = result?.data ?? result;
    const image = data?.images?.[0];
    if (!image?.url) throw new Error(`No image returned for ${page.id}`);

    const response = await fetch(image.url);
    if (!response.ok) throw new Error(`Download failed for ${page.id}: HTTP ${response.status}`);
    fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));

    manifest.pages[page.id] = {
      title: page.title,
      file: page.file,
      prompt,
      requestId: result?.requestId ?? null,
      width: image.width,
      height: image.height,
      sourceUrl: image.url,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    made += 1;
    console.log(`[book] ${page.id}: saved images/${page.file} (${image.width}x${image.height})`);
  }

  manifest.generatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`[book] done: ${made} generated, ${prompts.length - made} skipped`);
};

main().catch((error) => {
  const detail =
    error?.body !== undefined ? JSON.stringify(error.body) : error?.message ?? String(error);
  if (/exhausted balance/i.test(detail)) {
    console.error(
      "fal balance exhausted. Add credits at https://fal.ai/dashboard/usage-billing/credits"
    );
  } else {
    console.error(`[book] failed: ${detail}`);
  }
  process.exit(1);
});
