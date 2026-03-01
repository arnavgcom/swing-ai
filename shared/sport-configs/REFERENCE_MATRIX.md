# AceX AI — Sport Configuration Reference Matrix

Complete reference for all sport categories, metrics, optimal ranges, sub-scores, and overall score formulas.

---

## Summary

| # | Sport | Category | Config Key | Metrics | Sub-Scores | Score Label |
|---|-------|----------|------------|---------|------------|-------------|
| 1 | Tennis | Forehand | `tennis-forehand` | 13 | 5 | Forehand Score |
| 2 | Tennis | Backhand | `tennis-backhand` | 13 | 5 | Backhand Score |
| 3 | Tennis | Serve | `tennis-serve` | 13 | 5 | Serve Score |
| 4 | Tennis | Volley | `tennis-volley` | 10 | 4 | Volley Score |
| 5 | Tennis | Game | `tennis-game` | 8 | 4 | Game Score |
| 6 | Golf | Drive | `golf-drive` | 12 | 5 | Drive Score |
| 7 | Golf | Iron Shot | `golf-iron` | 10 | 5 | Iron Shot Score |
| 8 | Golf | Chip | `golf-chip` | 8 | 4 | Chip Score |
| 9 | Golf | Putt | `golf-putt` | 8 | 4 | Putting Score |
| 10 | Golf | Full Swing | `golf-full-swing` | 10 | 5 | Full Swing Score |

---

## Overall Score Formula

For every sport category, the overall score is a weighted sum of sub-scores:

```
overallScore = Σ (weight_i × subScore_i)
```

Each sub-score is computed by the Python analyzer on a 0–100 scale. The weights are listed in each category's Scores table below.

---

## 1. Tennis — Forehand

**Config Key:** `tennis-forehand`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 25% |
| stability | Stability | 20% |
| timing | Timing | 25% |
| followThrough | Follow-through | 15% |
| consistency | Consistency | 15% |

**Formula:** `overallScore = 0.25 × power + 0.20 × stability + 0.25 × timing + 0.15 × followThrough + 0.15 × consistency`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 25 – 40 |
| elbowAngle | Elbow Angle | deg | biomechanics | 120 – 160 |
| shoulderRotation | Shoulder Rotation | deg/s | biomechanics | 500 – 900 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| ballSpeed | Ball Speed | mph | ball | 55 – 100 |
| trajectoryArc | Trajectory Arc | deg | ball | 8 – 25 |
| spinRate | Spin Rate | rpm | ball | 800 – 2800 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| backswingDuration | Backswing | s | timing | 0.3 – 0.7 |
| contactTiming | Contact Timing | s | timing | 0.02 – 0.08 |
| followThroughDuration | Follow-through | s | timing | 0.4 – 1.0 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |
| contactHeight | Contact Height | m | technique | 0.85 – 1.10 |

---

## 2. Tennis — Backhand

**Config Key:** `tennis-backhand`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 20% |
| stability | Stability | 25% |
| timing | Timing | 25% |
| followThrough | Follow-through | 15% |
| consistency | Consistency | 15% |

**Formula:** `overallScore = 0.20 × power + 0.25 × stability + 0.25 × timing + 0.15 × followThrough + 0.15 × consistency`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 20 – 35 |
| elbowAngle | Elbow Angle | deg | biomechanics | 110 – 155 |
| shoulderRotation | Shoulder Rotation | deg/s | biomechanics | 400 – 800 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| ballSpeed | Ball Speed | mph | ball | 45 – 90 |
| trajectoryArc | Trajectory Arc | deg | ball | 8 – 22 |
| spinRate | Spin Rate | rpm | ball | 700 – 2500 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| backswingDuration | Backswing | s | timing | 0.3 – 0.8 |
| contactTiming | Contact Timing | s | timing | 0.02 – 0.08 |
| followThroughDuration | Follow-through | s | timing | 0.4 – 1.0 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |
| contactHeight | Contact Height | m | technique | 0.80 – 1.05 |

---

## 3. Tennis — Serve

**Config Key:** `tennis-serve`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 30% |
| accuracy | Accuracy | 25% |
| timing | Timing | 20% |
| technique | Technique | 15% |
| consistency | Consistency | 10% |

**Formula:** `overallScore = 0.30 × power + 0.25 × accuracy + 0.20 × timing + 0.15 × technique + 0.10 × consistency`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 30 – 50 |
| shoulderRotation | Shoulder Rotation | deg/s | biomechanics | 600 – 1100 |
| tossHeight | Toss Height | m | technique | 0.3 – 0.8 |
| trophyAngle | Trophy Position | deg | technique | 80 – 110 |
| pronation | Pronation | deg/s | technique | 400 – 900 |
| ballSpeed | Serve Speed | mph | ball | 70 – 130 |
| trajectoryArc | Trajectory Arc | deg | ball | 3 – 15 |
| spinRate | Spin Rate | rpm | ball | 1000 – 3500 |
| balanceScore | Balance | /100 | biomechanics | 65 – 95 |
| backswingDuration | Wind-up | s | timing | 0.8 – 1.5 |
| contactTiming | Contact Timing | s | timing | 0.02 – 0.06 |
| contactHeight | Contact Height | m | technique | 2.2 – 2.8 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 4. Tennis — Volley

**Config Key:** `tennis-volley`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| reflexes | Reflexes | 30% |
| stability | Stability | 25% |
| placement | Placement | 25% |
| technique | Technique | 20% |

**Formula:** `overallScore = 0.30 × reflexes + 0.25 × stability + 0.25 × placement + 0.20 × technique`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| reactionSpeed | Reaction Speed | ms | timing | 150 – 350 |
| racketPrep | Racket Prep | /100 | technique | 70 – 98 |
| wristFirmness | Wrist Firmness | /100 | technique | 75 – 98 |
| splitStepTiming | Split Step | s | timing | 0.1 – 0.4 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| contactHeight | Contact Height | m | technique | 0.8 – 1.5 |
| stepForward | Step Forward | /100 | biomechanics | 60 – 95 |
| ballSpeed | Ball Speed | mph | ball | 30 – 70 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 5. Tennis — Game

**Config Key:** `tennis-game`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| movement | Movement | 25% |
| shotSelection | Shot Selection | 25% |
| consistency | Consistency | 25% |
| power | Power | 25% |

**Formula:** `overallScore = 0.25 × movement + 0.25 × shotSelection + 0.25 × consistency + 0.25 × power`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| courtCoverage | Court Coverage | /100 | biomechanics | 60 – 95 |
| recoverySpeed | Recovery Speed | m/s | biomechanics | 2.0 – 5.0 |
| avgBallSpeed | Avg Ball Speed | mph | ball | 50 – 90 |
| shotVariety | Shot Variety | /100 | technique | 50 – 90 |
| balanceScore | Balance | /100 | biomechanics | 65 – 95 |
| rallyLength | Rally Length | shots | consistency | 4 – 12 |
| shotConsistency | Consistency | /100 | consistency | 65 – 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 – 90 |

---

## 6. Golf — Drive

**Config Key:** `golf-drive`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 30% |
| technique | Technique | 25% |
| consistency | Consistency | 20% |
| timing | Timing | 15% |
| balance | Balance | 10% |

**Formula:** `overallScore = 0.30 × power + 0.25 × technique + 0.20 × consistency + 0.15 × timing + 0.10 × balance`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| clubHeadSpeed | Club Head Speed | mph | power | 85 – 115 |
| hipRotation | Hip Rotation | deg | biomechanics | 35 – 55 |
| shoulderRotation | Shoulder Turn | deg | biomechanics | 75 – 100 |
| xFactor | X-Factor | deg | biomechanics | 30 – 50 |
| spineAngle | Spine Angle | deg | technique | 25 – 40 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| tempoRatio | Tempo Ratio | :1 | timing | 2.5 – 3.5 |
| backswingDuration | Backswing | s | timing | 0.7 – 1.2 |
| downswingDuration | Downswing | s | timing | 0.2 – 0.4 |
| followThroughDuration | Follow-through | s | timing | 0.5 – 1.0 |
| headStability | Head Stability | /100 | technique | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | consistency | 65 – 95 |

---

## 7. Golf — Iron Shot

**Config Key:** `golf-iron`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| technique | Technique | 30% |
| accuracy | Accuracy | 25% |
| consistency | Consistency | 20% |
| power | Power | 15% |
| balance | Balance | 10% |

**Formula:** `overallScore = 0.30 × technique + 0.25 × accuracy + 0.20 × consistency + 0.15 × power + 0.10 × balance`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| clubHeadSpeed | Club Head Speed | mph | power | 70 – 95 |
| hipRotation | Hip Rotation | deg | biomechanics | 30 – 50 |
| shoulderRotation | Shoulder Turn | deg | biomechanics | 70 – 95 |
| spineAngle | Spine Angle | deg | technique | 28 – 42 |
| divotAngle | Divot Angle | deg | technique | -5 – -1 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| tempoRatio | Tempo Ratio | :1 | timing | 2.5 – 3.5 |
| backswingDuration | Backswing | s | timing | 0.6 – 1.1 |
| headStability | Head Stability | /100 | technique | 75 – 98 |
| rhythmConsistency | Rhythm | /100 | consistency | 65 – 95 |

---

## 8. Golf — Chip

**Config Key:** `golf-chip`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| technique | Technique | 35% |
| touch | Touch | 25% |
| consistency | Consistency | 25% |
| balance | Balance | 15% |

**Formula:** `overallScore = 0.35 × technique + 0.25 × touch + 0.25 × consistency + 0.15 × balance`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristHinge | Wrist Hinge | deg | technique | 5 – 20 |
| armPendulum | Arm Pendulum | /100 | technique | 75 – 98 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| headStability | Head Stability | /100 | technique | 80 – 98 |
| strokeLength | Stroke Length | /100 | technique | 60 – 90 |
| contactQuality | Contact Quality | /100 | technique | 70 – 98 |
| followThroughRatio | Follow-through | /100 | timing | 70 – 95 |
| rhythmConsistency | Rhythm | /100 | consistency | 70 – 95 |

---

## 9. Golf — Putt

**Config Key:** `golf-putt`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| technique | Technique | 30% |
| consistency | Consistency | 30% |
| alignment | Alignment | 25% |
| touch | Touch | 15% |

**Formula:** `overallScore = 0.30 × technique + 0.30 × consistency + 0.25 × alignment + 0.15 × touch`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| pendulumScore | Pendulum | /100 | technique | 75 – 98 |
| headStability | Head Stability | /100 | technique | 85 – 98 |
| eyeLine | Eye Line | /100 | technique | 75 – 98 |
| strokeLength | Stroke Length | /100 | technique | 70 – 95 |
| wristStability | Wrist Stability | /100 | technique | 80 – 98 |
| balanceScore | Balance | /100 | biomechanics | 80 – 98 |
| tempoRatio | Tempo | :1 | timing | 0.8 – 1.2 |
| rhythmConsistency | Rhythm | /100 | consistency | 75 – 98 |

---

## 10. Golf — Full Swing

**Config Key:** `golf-full-swing`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 25% |
| technique | Technique | 25% |
| consistency | Consistency | 20% |
| timing | Timing | 15% |
| balance | Balance | 15% |

**Formula:** `overallScore = 0.25 × power + 0.25 × technique + 0.20 × consistency + 0.15 × timing + 0.15 × balance`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| clubHeadSpeed | Club Head Speed | mph | power | 80 – 110 |
| hipRotation | Hip Rotation | deg | biomechanics | 35 – 55 |
| shoulderRotation | Shoulder Turn | deg | biomechanics | 75 – 100 |
| xFactor | X-Factor | deg | biomechanics | 30 – 50 |
| spineAngle | Spine Angle | deg | technique | 25 – 40 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| tempoRatio | Tempo Ratio | :1 | timing | 2.5 – 3.5 |
| backswingDuration | Backswing | s | timing | 0.7 – 1.2 |
| headStability | Head Stability | /100 | technique | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | consistency | 65 – 95 |

---

## Cross-Category Metric Comparison

### Shared Metrics (appear in multiple categories)

| Metric Key | Tennis Categories | Golf Categories |
|------------|------------------|-----------------|
| balanceScore | Forehand, Backhand, Serve, Volley, Game | Drive, Iron, Chip, Putt, Full Swing |
| rhythmConsistency | Forehand, Backhand, Serve, Volley, Game | Drive, Iron, Chip, Putt, Full Swing |
| ballSpeed | Forehand, Backhand, Serve, Volley | — |
| contactHeight | Forehand, Backhand, Serve, Volley | — |
| shotConsistency | Forehand, Backhand, Volley, Game | — |
| backswingDuration | Forehand, Backhand, Serve | Drive, Iron, Full Swing |
| contactTiming | Forehand, Backhand, Serve | — |
| wristSpeed | Forehand, Backhand, Serve | — |
| shoulderRotation | Forehand, Backhand, Serve | Drive, Iron, Full Swing |
| trajectoryArc | Forehand, Backhand, Serve | — |
| spinRate | Forehand, Backhand, Serve | — |
| clubHeadSpeed | — | Drive, Iron, Full Swing |
| hipRotation | — | Drive, Iron, Full Swing |
| headStability | — | Drive, Iron, Chip, Putt, Full Swing |
| tempoRatio | — | Drive, Iron, Putt, Full Swing |
| spineAngle | — | Drive, Iron, Full Swing |
| xFactor | — | Drive, Full Swing |

### Unique Metrics (appear in only one category)

| Metric Key | Category | Description |
|------------|----------|-------------|
| elbowAngle | Tennis Forehand, Backhand | Elbow joint angle during stroke |
| followThroughDuration | Tennis Forehand, Backhand; Golf Drive | Post-contact follow-through time |
| tossHeight | Tennis Serve | Ball toss height relative to contact |
| trophyAngle | Tennis Serve | Elbow angle at trophy position |
| pronation | Tennis Serve | Forearm pronation speed |
| reactionSpeed | Tennis Volley | Time to initiate racket movement |
| racketPrep | Tennis Volley | Compact racket preparation quality |
| wristFirmness | Tennis Volley | Wrist stability at contact |
| splitStepTiming | Tennis Volley | Split step timing precision |
| stepForward | Tennis Volley | Quality of forward step |
| courtCoverage | Tennis Game | Court area covered during rallies |
| recoverySpeed | Tennis Game | Recovery to ready position speed |
| avgBallSpeed | Tennis Game | Average ball speed across all shots |
| shotVariety | Tennis Game | Shot diversity during play |
| rallyLength | Tennis Game | Average shots per rally |
| downswingDuration | Golf Drive | Downswing to impact time |
| divotAngle | Golf Iron | Angle of attack |
| wristHinge | Golf Chip | Wrist hinge amount |
| armPendulum | Golf Chip | Pendulum motion quality |
| strokeLength | Golf Chip, Putt | Stroke length appropriateness |
| contactQuality | Golf Chip | Ball-first contact quality |
| followThroughRatio | Golf Chip | Follow-through vs backswing ratio |
| pendulumScore | Golf Putt | Shoulder-driven pendulum quality |
| eyeLine | Golf Putt | Eyes positioned over ball |
| wristStability | Golf Putt | Wrist firmness during stroke |

---

## Source Files

Each category's config is defined in its own TypeScript file:

| Config Key | Source File |
|------------|------------|
| tennis-forehand | `shared/sport-configs/tennis-forehand.ts` |
| tennis-backhand | `shared/sport-configs/tennis-backhand.ts` |
| tennis-serve | `shared/sport-configs/tennis-serve.ts` |
| tennis-volley | `shared/sport-configs/tennis-volley.ts` |
| tennis-game | `shared/sport-configs/tennis-game.ts` |
| golf-drive | `shared/sport-configs/golf-drive.ts` |
| golf-iron | `shared/sport-configs/golf-iron.ts` |
| golf-chip | `shared/sport-configs/golf-chip.ts` |
| golf-putt | `shared/sport-configs/golf-putt.ts` |
| golf-full-swing | `shared/sport-configs/golf-full-swing.ts` |

Type definitions: `shared/sport-configs/types.ts`
Registry & lookup functions: `shared/sport-configs/index.ts`
