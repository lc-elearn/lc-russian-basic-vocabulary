// Checks that one lesson has its card image and banner, as every lesson does.
// Usage: bun .claude/skills/check-learning-object/check.mjs lo-05-lifestyle
// Exits 1 if either is missing. Read-only.
// Stray accents and Latin letters inside Russian words are checked by the build
// (guard i, src/guards/text-integrity.ts), so this script no longer looks for them.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const lo = process.argv[2];
if (!lo) {
  console.error('Usage: bun .claude/skills/check-learning-object/check.mjs <lo-folder>');
  process.exit(2);
}
const file = join('lo-config', lo, 'lo.json');
if (!existsSync(file)) {
  console.error(`No such lesson: ${file}`);
  process.exit(2);
}

const loJson = JSON.parse(readFileSync(file, 'utf8'));
const problems = [];
if (!loJson.image) problems.push('no card image: add "image"');
if (!loJson.hero?.src) problems.push('no banner: add "hero.src"');

if (problems.length) {
  console.log(`${lo}: ${problems.length} problem(s):`);
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log(`${lo}: card and banner present.`);
