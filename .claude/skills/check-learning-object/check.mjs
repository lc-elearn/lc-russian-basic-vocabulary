// Checks one lesson folder for the slips a conversion from the 2015 units makes.
// Usage: bun .claude/skills/check-learning-object/check.mjs lo-04-festivals
// Exits 1 if anything is found. Read-only.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const lo = process.argv[2];
if (!lo) {
  console.error('Usage: bun .claude/skills/check-learning-object/check.mjs <lo-folder>');
  process.exit(2);
}
const root = join('lo-config', lo);
if (!existsSync(root)) {
  console.error(`No such lesson: ${root}`);
  process.exit(2);
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.json')) files.push(p);
  }
};
walk(root);

const problems = [];
const report = (file, kind, detail) =>
  problems.push(`${file.split('\\').join('/')}: ${kind}: ${detail}`);

const CYR_VOWEL = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ';
const ACCENT = '\u0301';
// Latin letters that look Cyrillic, inside an otherwise Cyrillic word.
const MIXED =
  /[\p{Script=Cyrillic}\u0301]*[\p{Script=Cyrillic}][\p{Script=Cyrillic}\u0301]*[A-Za-zë][\p{L}\u0301]*|[A-Za-zë]+[\p{Script=Cyrillic}][\p{L}\u0301]*/gu;
const ASSET = /(?:images|audio)\/[^"'\s<>)]+\.(?:mp3|m4a|ogg|wav|png|jpe?g|gif|webp|svg)/g;

let assets = 0;
for (const file of files) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    report(file, 'invalid JSON', e.message);
    continue;
  }
  // Check the decoded string values, so JSON escapes such as \n are not read as letters.
  const strings = [];
  const collect = (v) => {
    if (typeof v === 'string') strings.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  collect(data);
  const text = strings.join('\n');

  // 1. A combining accent belongs only on a Cyrillic vowel (lesson 2 had it in place of "+").
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ACCENT && !CYR_VOWEL.includes(text[i - 1] ?? '')) {
      report(file, 'stray accent', JSON.stringify(text.slice(Math.max(0, i - 12), i + 8)));
    }
  }

  // 2. Latin homoglyphs inside Russian words (Дeлая, отдельнo, Latin ë).
  for (const m of text.matchAll(MIXED)) report(file, 'mixed Latin/Cyrillic word', m[0]);

  // 3. Every referenced image and recording exists under public/ (guard d is blind on Windows until template #86).
  for (const m of text.matchAll(ASSET)) {
    assets++;
    if (!existsSync(join('public', m[0]))) report(file, 'missing file', `public/${m[0]}`);
  }
}

// 4. Card and banner present, as every lesson has them.
const loJson = JSON.parse(readFileSync(join(root, 'lo.json'), 'utf8'));
if (!loJson.image) report(join(root, 'lo.json'), 'no card image', 'add "image"');
if (!loJson.hero?.src) report(join(root, 'lo.json'), 'no banner', 'add "hero.src"');

console.log(`${lo}: ${files.length} files, ${assets} media references checked.`);
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('No problems found.');
