import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Entry point for the make.fun bounty "The agent builds a game from one prompt".
// The entry is a post on X: this program copies POST.json (which names the post)
// from the repository to /output. That is all it has to do.
const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
mkdirSync(out, { recursive: true });
copyFileSync(join(here, "POST.json"), join(out, "POST.json"));
console.log("POST.json copied to " + join(out, "POST.json"));
