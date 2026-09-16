/**
 * Registers (or versions) the ValueXtract Agri Skill with Anthropic.
 *
 *   npm run skill:register              # create a new Skill
 *   npm run skill:register -- --skill-id skill_01…   # publish a new version
 *
 * Prints the Skill ID to paste into Settings → AI Configuration, or into
 * VALUEXTRACT_AGRI_SKILL_ID for local development.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });
import { registerSkill } from "../src/lib/anthropic/skill-registry";

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };

  const apiKey = get("--api-key") ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Set ANTHROPIC_API_KEY or pass --api-key.");
    process.exit(1);
  }

  const result = await registerSkill({
    apiKey,
    directory: get("--dir") ?? process.env.VALUEXTRACT_AGRI_SKILL_DIR ?? "./skill/valuextract-agri",
    displayName: get("--name") ?? "ValueXtract - Agri",
    existingSkillId: get("--skill-id"),
  });

  console.log("");
  console.log(`  ${result.mode === "created" ? "Registered" : "New version published"}`);
  console.log(`  Skill ID   : ${result.skillId}`);
  console.log(`  Version    : ${result.versionId}`);
  console.log(`  Name       : ${result.displayName}`);
  console.log(`  Files sent : ${result.fileCount}`);
  console.log("");
  console.log("  Add to .env.local or Settings → AI Configuration:");
  console.log(`  VALUEXTRACT_AGRI_SKILL_ID=${result.skillId}`);
  console.log("");
}

main().catch((error) => {
  console.error("Skill registration failed:", error?.message ?? error);
  process.exit(1);
});
