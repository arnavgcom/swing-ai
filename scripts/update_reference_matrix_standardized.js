const fs = require('fs');
const path = require('path');

const repoRoot = '/Users/vikramgupta/workspace/swing-ai';
const matrixPath = path.join(repoRoot, 'shared/sport-configs/REFERENCE_MATRIX.md');
const configsDir = path.join(repoRoot, 'shared/sport-configs');
const analyzersDir = path.join(repoRoot, 'python_analysis/sports');

const STANDARDIZED_WEIGHTS = [
  { key: 'power', label: 'Power', weight: 0.30 },
  { key: 'control', label: 'Control', weight: 0.25 },
  { key: 'timing', label: 'Timing', weight: 0.25 },
  { key: 'technique', label: 'Technique', weight: 0.20 },
];

const ALIAS_WEIGHTS = {
  power: {
    power: 1.0,
    speed: 0.9,
    athleticism: 0.8,
    touch: 0.5,
  },
  control: {
    control: 1.0,
    stability: 0.9,
    placement: 0.8,
    accuracy: 0.8,
    alignment: 0.7,
    finesse: 0.7,
    deception: 0.6,
    reflexes: 0.5,
    balance: 0.7,
    movement: 0.6,
    shotselection: 0.6,
  },
  timing: {
    timing: 1.0,
    rhythm: 0.8,
    reflexes: 0.5,
  },
  technique: {
    technique: 1.0,
    followthrough: 0.8,
    spin: 0.6,
    arc: 0.6,
    footwork: 0.6,
    wallplay: 0.6,
    shotselection: 0.4,
    movement: 0.4,
    placement: 0.4,
    accuracy: 0.4,
    control: 0.5,
    deception: 0.5,
    finesse: 0.5,
  },
};

const FALLBACK_DEFAULT = 78;
const HIDDEN_LEGACY_KEYS = new Set(['followThrough', 'stability']);

const TECHNICAL_SCORE_DETAILS = [
  {
    name: 'Balance',
    formula: 'score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))',
    params: ['balanceScore', 'reactionTime'],
  },
  {
    name: 'Inertia',
    formula: 'score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))',
    params: ['stanceAngle', 'shoulderRotationSpeed'],
  },
  {
    name: 'Opposite Force',
    formula: 'score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))',
    params: ['kneeBendAngle', 'balanceScore', 'stanceAngle'],
  },
  {
    name: 'Momentum',
    formula: 'score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))',
    params: ['hipRotationSpeed', 'shoulderRotationSpeed', 'ballSpeed'],
  },
  {
    name: 'Elastic Energy',
    formula: 'score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))',
    params: ['racketLagAngle', 'kneeBendAngle', 'swingPathAngle'],
  },
  {
    name: 'Contact',
    formula: 'score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))',
    params: ['contactDistance', 'contactHeight', 'reactionTime'],
  },
];

const MOVEMENT_SCORE_DETAILS = [
  {
    name: 'Ready',
    formula: 'score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))',
    params: ['splitStepTime', 'balanceScore'],
  },
  {
    name: 'Read',
    formula: 'score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))',
    params: ['reactionTime', 'splitStepTime'],
  },
  {
    name: 'React',
    formula: 'score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))',
    params: ['reactionTime', 'balanceScore'],
  },
  {
    name: 'Respond',
    formula: 'score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))',
    params: ['ballSpeed', 'contactHeight', 'swingPathAngle'],
  },
  {
    name: 'Recover',
    formula: 'score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))',
    params: ['recoveryTime', 'balanceScore'],
  },
];

function normalizeKey(key) {
  return String(key || '').toLowerCase().trim();
}

function canonicalScoreKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatRange(range) {
  if (!range || !Array.isArray(range) || range.length !== 2) return '-';
  return `${range[0]} - ${range[1]}`;
}

function parseNumber(raw) {
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

function uniqueSorted(items) {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}

function extractMetricKeysFromExpr(expr, helperVarExpr, visitedVars = new Set()) {
  const metricKeys = new Set();
  if (!expr) return metricKeys;

  for (const m of expr.matchAll(/m\["([^"]+)"\]/g)) {
    metricKeys.add(m[1]);
  }

  const tokenRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const ignored = new Set(['self', 'm', 'np', 'round', 'int', 'float', 'max', 'min', 'abs', 'clamp']);
  for (const t of expr.matchAll(tokenRegex)) {
    const token = t[1];
    if (ignored.has(token) || visitedVars.has(token)) continue;
    if (helperVarExpr.has(token)) {
      visitedVars.add(token);
      const nested = extractMetricKeysFromExpr(helperVarExpr.get(token) || '', helperVarExpr, visitedVars);
      nested.forEach((k) => metricKeys.add(k));
    }
  }

  return metricKeys;
}

function parseConfig(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const sportName = src.match(/sportName:\s*"([^"]+)"/)?.[1];
  const movementName = src.match(/movementName:\s*"([^"]+)"/)?.[1];
  const configKey = src.match(/configKey:\s*"([^"]+)"/)?.[1] || path.basename(filePath, '.ts');
  const overallScoreLabel = src.match(/overallScoreLabel:\s*"([^"]+)"/)?.[1] || 'Overall Score';

  const scoresBlock = src.match(/scores:\s*\[(.*?)\],\n\s*metrics:/s)?.[1] || '';
  const scores = [...scoresBlock.matchAll(/\{\s*key:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"\s*,\s*weight:\s*([0-9.]+)\s*\}/g)]
    .map((m) => ({ key: m[1], label: m[2], weight: Number(m[3]) }))
    .filter((s) => normalizeKey(s.key) !== 'consistency');

  const metricsBlock = src.match(/metrics:\s*\[(.*?)\]\s*,\s*\};/s)?.[1] || '';
  const metricChunks = metricsBlock.match(/\{[\s\S]*?\}/g) || [];
  const metrics = metricChunks.map((chunk) => {
    const key = chunk.match(/key:\s*"([^"]+)"/)?.[1] || '';
    const label = chunk.match(/label:\s*"([^"]+)"/)?.[1] || key;
    const unit = chunk.match(/unit:\s*"([^"]+)"/)?.[1] || '-';
    const category = chunk.match(/category:\s*"([^"]+)"/)?.[1] || '-';
    const rangeRaw = chunk.match(/optimalRange:\s*\[([^\]]+)\]/)?.[1];
    let optimalRange = null;
    if (rangeRaw) {
      const parts = rangeRaw.split(',').map((v) => parseNumber(v)).filter((v) => v !== null);
      if (parts.length === 2) optimalRange = [parts[0], parts[1]];
    }
    return { key, label, unit, category, optimalRange };
  }).filter((m) => m.key);

  if (!sportName || !movementName) return null;

  return {
    sportName,
    movementName,
    configKey,
    overallScoreLabel,
    scores,
    metrics,
    sourceFile: `shared/sport-configs/${path.basename(filePath)}`,
  };
}

function analyzerPathForConfig(configKey) {
  return path.join(analyzersDir, `${String(configKey || '').replace(/-/g, '_')}.py`);
}

function extractComputeSubScoresBlock(src) {
  const start = src.indexOf('def _compute_sub_scores');
  if (start === -1) return null;
  const after = src.slice(start);
  const endMatch = after.match(/\n\s*def\s+_compute_overall_score\s*\(/);
  if (!endMatch) return null;
  return after.slice(0, endMatch.index);
}

function extractRawSubScoreFormulas(configKey) {
  const analyzerPath = analyzerPathForConfig(configKey);
  if (!fs.existsSync(analyzerPath)) return null;

  const src = fs.readFileSync(analyzerPath, 'utf8');
  const fnBlock = extractComputeSubScoresBlock(src);
  if (!fnBlock) return null;

  const lines = fnBlock.split('\n');
  const subScoreVarExpr = new Map();
  const helperVarExpr = new Map();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const assign = lines[i].match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (assign && !trimmed.startsWith('return') && !trimmed.includes('int(np.clip(round(')) {
      const lhs = assign[1];
      const rhs = assign[2].replace(/\s+/g, ' ').trim();
      if (!rhs.endsWith('{')) helperVarExpr.set(lhs, rhs);
    }

    const startMatch = lines[i].match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*int\(np\.clip\(round\(/);
    if (!startMatch) continue;

    const varName = startMatch[1];
    const chunkLines = [];
    for (let j = i; j < lines.length; j++) {
      chunkLines.push(lines[j]);
      if (lines[j].includes('), 0, 100))')) {
        i = j;
        break;
      }
    }

    const chunk = chunkLines.join('\n');
    const exprMatch = chunk.match(/int\(np\.clip\(round\(([\s\S]*?)\),\s*0,\s*100\)\)/);
    if (!exprMatch) continue;
    subScoreVarExpr.set(varName, exprMatch[1].trim().replace(/\s+/g, ' '));
  }

  const returnMatch = fnBlock.match(/return\s*\{([\s\S]*?)\n\s*\}/);
  if (!returnMatch) return null;

  const rawKeyExprMap = new Map();
  for (const m of returnMatch[1].matchAll(/"([^"]+)"\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    const rawKey = m[1];
    const varName = m[2];
    const expr = subScoreVarExpr.get(varName);
    if (expr) rawKeyExprMap.set(rawKey, expr);
  }
  if (!rawKeyExprMap.size) return null;

  const canonicalToRaw = new Map();
  for (const rawKey of rawKeyExprMap.keys()) {
    canonicalToRaw.set(canonicalScoreKey(rawKey), rawKey);
  }

  return {
    analyzerPath,
    rawKeyExprMap,
    helperVarExpr,
    canonicalToRaw,
  };
}

function buildStandardizedFormulaLine(targetKey, extracted) {
  const aliases = ALIAS_WEIGHTS[targetKey] || {};
  const terms = [];
  let denominator = 0;

  for (const [alias, weight] of Object.entries(aliases)) {
    const rawKey = extracted.canonicalToRaw.get(alias);
    if (!rawKey) continue;
    terms.push({ rawKey, weight });
    denominator += weight;
  }

  const renderTerm = (rawKey) => {
    if (HIDDEN_LEGACY_KEYS.has(rawKey) && extracted.rawKeyExprMap.has(rawKey)) {
      return `(${extracted.rawKeyExprMap.get(rawKey)})`;
    }
    return rawKey;
  };

  if (!terms.length) {
    return {
      line: `- \`${targetKey} = ${FALLBACK_DEFAULT} (fallback; no matching aliases)\``,
      usedRawKeys: [],
    };
  }

  if (terms.length === 1) {
    const rawKey = terms[0].rawKey;
    return {
      line: `- \`${targetKey} = round(clamp(${renderTerm(rawKey)}, 0, 100))\``,
      usedRawKeys: [rawKey],
    };
  }

  const numerator = terms.map((t) => `${renderTerm(t.rawKey)} * ${Number(t.weight.toFixed(2))}`).join(' + ');
  return {
    line: `- \`${targetKey} = round(clamp((${numerator}) / ${Number(denominator.toFixed(2))}, 0, 100))\``,
    usedRawKeys: terms.map((t) => t.rawKey),
  };
}

function buildFormulaBlock(configKey) {
  const extracted = extractRawSubScoreFormulas(configKey);
  if (!extracted) {
    return [
      'Standardized sub-score formulas could not be extracted automatically for this category.',
    ].join('\n');
  }

  const formulaLines = [];
  const keyDeps = new Map();
  const usedRawKeys = new Set();
  for (const key of ['power', 'control', 'timing', 'technique']) {
    const { line, usedRawKeys: used } = buildStandardizedFormulaLine(key, extracted);
    formulaLines.push(line);
    used.forEach((k) => usedRawKeys.add(k));

    const deps = new Set();
    used.forEach((rawKey) => {
      const expr = extracted.rawKeyExprMap.get(rawKey) || '';
      const keys = extractMetricKeysFromExpr(expr, extracted.helperVarExpr, new Set());
      keys.forEach((metricKey) => deps.add(metricKey));
    });
    keyDeps.set(key, uniqueSorted([...deps]));
  }

  const rawLines = [...usedRawKeys]
    .filter((key) => !HIDDEN_LEGACY_KEYS.has(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `- \`${key} = ${extracted.rawKeyExprMap.get(key)}\``);

  const helperDeps = new Set();
  const tokenRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const ignored = new Set(['self', 'm', 'np', 'round', 'int', 'float', 'max', 'min', 'abs', 'clamp']);

  function collectDeps(expr) {
    for (const tokenMatch of expr.matchAll(tokenRegex)) {
      const token = tokenMatch[1];
      if (ignored.has(token)) continue;
      if (extracted.helperVarExpr.has(token) && !helperDeps.has(token)) {
        helperDeps.add(token);
        collectDeps(extracted.helperVarExpr.get(token) || '');
      }
    }
  }

  usedRawKeys.forEach((key) => collectDeps(extracted.rawKeyExprMap.get(key) || ''));

  const helperLines = [...helperDeps]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `- \`${name} = ${extracted.helperVarExpr.get(name)}\``);

  const analyzerRel = path.relative(repoRoot, extracted.analyzerPath).replace(/\\/g, '/');

  const lines = [
    'Exact standardized tactical sub-score formulas (`0-100`):',
    ...formulaLines,
    '',
    'Underlying parameters influencing each tactical sub-score:',
    `- power: ${keyDeps.get('power')?.length ? keyDeps.get('power').join(', ') : 'fallback default only'}`,
    `- control: ${keyDeps.get('control')?.length ? keyDeps.get('control').join(', ') : 'fallback default only'}`,
    `- timing: ${keyDeps.get('timing')?.length ? keyDeps.get('timing').join(', ') : 'fallback default only'}`,
    `- technique: ${keyDeps.get('technique')?.length ? keyDeps.get('technique').join(', ') : 'fallback default only'}`,
    '',
    `Raw analyzer formulas used by standardization (from \`${analyzerRel}\`):`,
    ...rawLines,
  ];

  if (helperLines.length) {
    lines.push('', 'Intermediate variables used above:', ...helperLines);
  }

  lines.push('', 'Note: `consistency` is excluded from standardized tactical sub-scores.');
  return lines.join('\n');
}

function buildTypeScoreTable(title, details, aggregateFormulaLabel) {
  const rows = details.map((d) => {
    const params = uniqueSorted(d.params).join(', ');
    return `| ${d.name} | \`${d.formula}\` | ${params} |`;
  }).join('\n');

  return [
    `#### ${title}`,
    '',
    '| Score | Formula | Underlying Parameters |',
    '|-------|---------|------------------------|',
    rows,
    '',
    `- \`${aggregateFormulaLabel}\``,
  ].join('\n');
}

function buildMetricsTable(metrics) {
  const rows = metrics.map((m) =>
    `| ${m.key} | ${m.label} | ${m.unit} | ${m.category} | ${formatRange(m.optimalRange)} |`,
  ).join('\n');

  return [
    '### Metrics Table',
    '',
    '| Key | Label | Unit | Category | Optimal Range |',
    '|-----|-------|------|----------|---------------|',
    rows || '| - | - | - | - | - |',
  ].join('\n');
}

function buildScoresSection(cfg) {
  const rows = STANDARDIZED_WEIGHTS
    .map((s) => `| ${s.key} | ${s.label} | ${Math.round(s.weight * 100)}% |`)
    .join('\n');

  return [
    '### Scores (Ordered)',

    '',
    buildTypeScoreTable(
      'Technical',
      TECHNICAL_SCORE_DETAILS,
      'technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])',
    ),

    '',
    '#### Tactical',
    '',
    '| Sub-Score | Label | Weight |',
    '|-----------|-------|--------|',
    rows,
    '',
    '**Standard Tactical Formula**',
    '`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`',
    '',
    buildFormulaBlock(cfg.configKey),

    '',
    buildTypeScoreTable(
      'Movement',
      MOVEMENT_SCORE_DETAILS,
      'movementScore = mean([Ready, Read, React, Respond, Recover])',
    ),
  ].join('\n');
}

function buildOverallSection(cfg) {
  return [
    '### Overall Score',
    '',
    `- Score Label: \`${cfg.overallScoreLabel}\``,
    '- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`',
  ].join('\n');
}

function buildSection(index, cfg) {
  return [
    `## ${index}. ${cfg.sportName} - ${cfg.movementName}`,
    '',
    `### Sport Category`,
    '',
    `- Sport: \`${cfg.sportName}\``,
    `- Category: \`${cfg.movementName}\``,
    `- Config Key: \`${cfg.configKey}\``,
    `- Source Config: \`${cfg.sourceFile}\``,
    '',
    buildMetricsTable(cfg.metrics),
    '',
    buildScoresSection(cfg),
    '',
    buildOverallSection(cfg),
  ].join('\n');
}

function buildSummaryTable(configs) {
  const rows = configs.map((cfg, idx) => (
    `| ${idx + 1} | ${cfg.sportName} | ${cfg.movementName} | \`${cfg.configKey}\` | ${cfg.metrics.length} | 4 | ${cfg.overallScoreLabel} |`
  )).join('\n');

  return [
    '## Summary',
    '',
    '| # | Sport | Category | Config Key | Metrics | Sub-Scores | Score Label |',
    '|---|-------|----------|------------|---------|------------|-------------|',
    rows,
  ].join('\n');
}

function main() {
  const configFiles = fs.readdirSync(configsDir)
    .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts'].includes(f))
    .sort();

  const configs = configFiles
    .map((f) => parseConfig(path.join(configsDir, f)))
    .filter(Boolean)
    .sort((a, b) => {
      const sportOrder = {
        tennis: 1,
        golf: 2,
        badminton: 3,
        paddle: 4,
        pickleball: 5,
        tabletennis: 6,
      };

      const movementOrderBySport = {
        tennis: {
          forehand: 1,
          backhand: 2,
          serve: 3,
          volley: 4,
          game: 5,
        },
        golf: {
          drive: 1,
          ironshot: 2,
          chip: 3,
          putt: 4,
          fullswing: 5,
        },
        badminton: {
          clear: 1,
          smash: 2,
          dropshot: 3,
          netshot: 4,
          serve: 5,
        },
        paddle: {
          forehand: 1,
          backhand: 2,
          serve: 3,
          smash: 4,
          bandeja: 5,
        },
        pickleball: {
          dink: 1,
          drive: 2,
          serve: 3,
          volley: 4,
          thirdshotdrop: 5,
        },
        tabletennis: {
          forehand: 1,
          backhand: 2,
          serve: 3,
          loop: 4,
          chop: 5,
        },
      };

      const normA = normalizeKey(a.sportName).replace(/\s+/g, '');
      const normB = normalizeKey(b.sportName).replace(/\s+/g, '');
      const ordA = sportOrder[normA] || 999;
      const ordB = sportOrder[normB] || 999;

      if (ordA !== ordB) return ordA - ordB;

      const mA = canonicalScoreKey(a.movementName);
      const mB = canonicalScoreKey(b.movementName);
      const mOrdA = movementOrderBySport[normA]?.[mA] || 999;
      const mOrdB = movementOrderBySport[normB]?.[mB] || 999;
      if (mOrdA !== mOrdB) return mOrdA - mOrdB;

      return a.movementName.localeCompare(b.movementName);
    });

  const lines = [
    '# Swing AI - Sport Configuration Reference Matrix',
    '',
    'Clean, standardized reference for all sport categories.',
    '',
    buildSummaryTable(configs),
    '',
    '## Scoring Contract',
    '',
    '- Tactical sub-scores are standardized to `power`, `control`, `timing`, and `technique`.',
    '- Runtime standardized tactical formula: `tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`.',
    '- `consistency` is excluded from the standardized tactical output.',
    '- App overall formula: `overallScore = (technicalScore + tacticalScore + movementScore) / 3`.',
    '',
    ...configs.flatMap((cfg, idx) => [buildSection(idx + 1, cfg), '', '---', '']),
    '> Maintenance: regenerate this document via `node scripts/update_reference_matrix_standardized.js` whenever configs or scoring logic change.',
    '',
  ];

  const output = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(matrixPath, output);
  console.log(`Updated sections: ${configs.length}`);
}

main();
