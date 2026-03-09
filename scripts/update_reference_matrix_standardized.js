const fs = require('fs');
const path = require('path');

const repoRoot = '/Users/vikramgupta/workspace/swing-ai';
const matrixPath = path.join(repoRoot, 'shared/sport-configs/REFERENCE_MATRIX.md');
const configsDir = path.join(repoRoot, 'shared/sport-configs');

function parseConfig(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const sportName = src.match(/sportName:\s*"([^"]+)"/)?.[1];
  const movementName = src.match(/movementName:\s*"([^"]+)"/)?.[1];
  const scoresBlock = src.match(/scores:\s*\[(.*?)\],\n\s*metrics:/s)?.[1];
  if (!sportName || !movementName || !scoresBlock) return null;

  const scores = [...scoresBlock.matchAll(/\{\s*key:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"\s*,\s*weight:\s*([0-9.]+)\s*\}/g)]
    .map((m) => ({ key: m[1], label: m[2], weight: Number(m[3]) }));

  if (!scores.length) return null;
  return { sportName, movementName, scores };
}

function buildScoresMarkdown(scores) {
  const rows = scores
    .map((s) => `| ${s.key} | ${s.label} | ${Math.round(s.weight * 100)}% |`)
    .join('\n');
  const formulaParts = scores.map((s) => `${s.weight.toFixed(2)} × ${s.key}`);
  return `### Scores\n\n| Key | Label | Weight |\n|-----|-------|--------|\n${rows}\n\n**Formula:** \`overallScore = ${formulaParts.join(' + ')}\``;
}

function normalizeKey(key) {
  return String(key || '').toLowerCase().trim();
}

const configFiles = fs.readdirSync(configsDir)
  .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts'].includes(f));

const configMap = new Map();
for (const file of configFiles) {
  const parsed = parseConfig(path.join(configsDir, file));
  if (!parsed) continue;
  configMap.set(`${normalizeKey(parsed.sportName)}|${normalizeKey(parsed.movementName)}`, parsed);
}

let matrix = fs.readFileSync(matrixPath, 'utf8');

matrix = matrix.replace(
  /(\|\s*#\s*\|[^\n]*\n\|---[^\n]*\n)([\s\S]*?)(\n\n---)/,
  (full, head, body, tail) => {
    const updatedBody = body.replace(/(\|\s*\d+\s*\|\s*[^|]+\|\s*[^|]+\|\s*`[^`]+`\s*\|\s*\d+\s*\|\s*)\d+(\s*\|\s*[^\n]+\|)/g, '$15$2');
    return `${head}${updatedBody}${tail}`;
  },
);

const sectionParts = matrix.split('\n---\n\n## ');
const first = sectionParts.shift();
const updatedSections = sectionParts.map((part, idx) => {
  const section = idx === 0 ? `## ${part}` : `## ${part}`;
  const titleMatch = section.match(/^##\s+\d+\.\s+(.+?)\s+—\s+(.+)$/m);
  if (!titleMatch) return section;

  const sportName = titleMatch[1].trim();
  const movementName = titleMatch[2].trim();
  const key = `${normalizeKey(sportName)}|${normalizeKey(movementName)}`;
  const cfg = configMap.get(key);
  if (!cfg) return section;

  let out = section;
  out = out.replace(/### Scores[\s\S]*?\n### Metrics/, `${buildScoresMarkdown(cfg.scores)}\n\n### Metrics`);

  const standardizedSubScoreBlock = [
    '### Sub-Score Computation Details',
    '',
    'Runtime scoring for this category is standardized to five keys in `python_analysis/base_analyzer.py`:',
    '',
    '- `power`',
    '- `control`',
    '- `timing`',
    '- `technique`',
    '- `consistency`',
    '',
    'Standardized overall formula used by runtime:',
    '',
    '`overallScore = 0.25 × power + 0.20 × control + 0.20 × timing + 0.20 × technique + 0.15 × consistency`',
    '',
    'Legacy analyzer-local keys may still appear in raw payloads/coaching text for backward compatibility, but score cards and config weights are normalized to the five keys above.',
  ].join('\n');

  out = out.replace(/### Sub-Score Computation Details[\s\S]*$/m, standardizedSubScoreBlock);

  return out;
});

const finalDoc = [first, ...updatedSections.map((s) => s.replace(/^##\s+/, '## '))].join('\n---\n\n');
fs.writeFileSync(matrixPath, finalDoc);
console.log(`Updated sections: ${updatedSections.length}`);
