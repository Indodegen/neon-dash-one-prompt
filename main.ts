import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Entry point for the make.fun bounty "The agent builds a game from one prompt".
// The entry is a post on X: this program copies POST.json (which names the post)
// from the repository to /output. That is all it has to do.
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
mkdirSync(out, { recursive: true });
copyFileSync("POST.json", join(out, "POST.json"));
console.log("POST.json copied to " + join(out, "POST.json"));
