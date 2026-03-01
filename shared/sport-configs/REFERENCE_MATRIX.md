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
| 11 | Pickleball | Dink | `pickleball-dink` | 7 | 6 | Dink Score |
| 12 | Pickleball | Drive | `pickleball-drive` | 7 | 6 | Drive Score |
| 13 | Pickleball | Serve | `pickleball-serve` | 6 | 6 | Serve Score |
| 14 | Pickleball | Volley | `pickleball-volley` | 7 | 6 | Volley Score |
| 15 | Pickleball | Third Shot Drop | `pickleball-third-shot-drop` | 6 | 6 | Third Shot Drop Score |
| 16 | Paddle | Forehand | `paddle-forehand` | 9 | 5 | Forehand Score |
| 17 | Paddle | Backhand | `paddle-backhand` | 8 | 5 | Backhand Score |
| 18 | Paddle | Serve | `paddle-serve` | 6 | 4 | Serve Score |
| 19 | Paddle | Smash | `paddle-smash` | 7 | 4 | Smash Score |
| 20 | Paddle | Bandeja | `paddle-bandeja` | 7 | 4 | Bandeja Score |
| 21 | Badminton | Clear | `badminton-clear` | 7 | 5 | Clear Score |
| 22 | Badminton | Smash | `badminton-smash` | 7 | 5 | Smash Score |
| 23 | Badminton | Drop | `badminton-drop` | 6 | 5 | Drop Shot Score |
| 24 | Badminton | Net Shot | `badminton-net-shot` | 6 | 5 | Net Shot Score |
| 25 | Badminton | Serve | `badminton-serve` | 5 | 4 | Serve Score |
| 26 | Table Tennis | Forehand | `tabletennis-forehand` | 7 | 5 | Forehand Score |
| 27 | Table Tennis | Backhand | `tabletennis-backhand` | 6 | 5 | Backhand Score |
| 28 | Table Tennis | Serve | `tabletennis-serve` | 6 | 5 | Serve Score |
| 29 | Table Tennis | Loop | `tabletennis-loop` | 6 | 5 | Loop Score |
| 30 | Table Tennis | Chop | `tabletennis-chop` | 6 | 5 | Chop Score |

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

## 11. Pickleball — Dink

**Config Key:** `pickleball-dink`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| touch | Soft Touch | 25% |
| technique | Technique | 20% |
| arc | Arc Control | 15% |
| stability | Stability | 15% |
| consistency | Consistency | 15% |
| rhythm | Rhythm | 10% |

**Formula:** `overallScore = 0.25 × touch + 0.20 × technique + 0.15 × arc + 0.15 × stability + 0.15 × consistency + 0.10 × rhythm`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleAngle | Paddle Angle | deg | technique | 25 – 50 |
| softTouch | Soft Touch | /100 | technique | 70 – 98 |
| wristStability | Wrist Stability | /100 | biomechanics | 75 – 98 |
| arcHeight | Arc Height | m | ball | 0.05 – 0.30 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 12. Pickleball — Drive

**Config Key:** `pickleball-drive`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 25% |
| technique | Technique | 20% |
| trajectory | Trajectory | 15% |
| stability | Stability | 15% |
| consistency | Consistency | 15% |
| rhythm | Rhythm | 10% |

**Formula:** `overallScore = 0.25 × power + 0.20 × technique + 0.15 × trajectory + 0.15 × stability + 0.15 × consistency + 0.10 × rhythm`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleSpeed | Paddle Speed | m/s | power | 15 – 30 |
| bodyRotation | Body Rotation | deg/s | biomechanics | 300 – 700 |
| ballSpeed | Ball Speed | mph | ball | 35 – 65 |
| trajectoryAngle | Trajectory | deg | ball | 2 – 12 |
| balanceScore | Balance | /100 | biomechanics | 65 – 95 |
| shotConsistency | Consistency | /100 | consistency | 65 – 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 – 90 |

---

## 13. Pickleball — Serve

**Config Key:** `pickleball-serve`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| technique | Technique | 25% |
| placement | Placement | 20% |
| power | Power | 15% |
| stability | Stability | 15% |
| consistency | Consistency | 15% |
| rhythm | Rhythm | 10% |

**Formula:** `overallScore = 0.25 × technique + 0.20 × placement + 0.15 × power + 0.15 × stability + 0.15 × consistency + 0.10 × rhythm`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleAngle | Paddle Angle | deg | technique | 20 – 45 |
| tossConsistency | Toss Consistency | /100 | technique | 70 – 98 |
| ballSpeed | Ball Speed | mph | ball | 25 – 50 |
| placement | Placement | /100 | ball | 65 – 95 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 14. Pickleball — Volley

**Config Key:** `pickleball-volley`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| reflexes | Reflexes | 25% |
| technique | Technique | 20% |
| stability | Stability | 15% |
| power | Power | 15% |
| consistency | Consistency | 15% |
| rhythm | Rhythm | 10% |

**Formula:** `overallScore = 0.25 × reflexes + 0.20 × technique + 0.15 × stability + 0.15 × power + 0.15 × consistency + 0.10 × rhythm`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| reactionSpeed | Reaction Speed | ms | timing | 120 – 300 |
| paddlePrep | Paddle Prep | /100 | technique | 70 – 98 |
| wristFirmness | Wrist Firmness | /100 | technique | 75 – 98 |
| balanceScore | Balance | /100 | biomechanics | 65 – 95 |
| ballSpeed | Ball Speed | mph | ball | 20 – 50 |
| shotConsistency | Consistency | /100 | consistency | 65 – 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 – 90 |

---

## 15. Pickleball — Third Shot Drop

**Config Key:** `pickleball-third-shot-drop`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| touch | Soft Touch | 25% |
| arc | Arc Control | 20% |
| technique | Technique | 20% |
| consistency | Consistency | 15% |
| stability | Stability | 10% |
| rhythm | Rhythm | 10% |

**Formula:** `overallScore = 0.25 × touch + 0.20 × arc + 0.20 × technique + 0.15 × consistency + 0.10 × stability + 0.10 × rhythm`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| arcHeight | Arc Height | m | ball | 0.10 – 0.40 |
| softTouch | Soft Touch | /100 | technique | 70 – 98 |
| paddleAngle | Paddle Angle | deg | technique | 30 – 55 |
| shotConsistency | Consistency | /100 | consistency | 65 – 95 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 16. Paddle — Forehand

**Config Key:** `paddle-forehand`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 20% |
| technique | Technique | 25% |
| wallPlay | Wall Play | 20% |
| consistency | Consistency | 15% |
| timing | Timing | 20% |

**Formula:** `overallScore = 0.20 × power + 0.25 × technique + 0.20 × wallPlay + 0.15 × consistency + 0.20 × timing`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 18 – 32 |
| elbowAngle | Elbow Angle | deg | biomechanics | 110 – 150 |
| shoulderRotation | Shoulder Rotation | deg/s | biomechanics | 400 – 800 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| ballSpeed | Ball Speed | mph | ball | 40 – 80 |
| wallPlayScore | Wall Play | /100 | technique | 60 – 95 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |
| contactHeight | Contact Height | m | technique | 0.70 – 1.10 |

---

## 17. Paddle — Backhand

**Config Key:** `paddle-backhand`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 20% |
| technique | Technique | 25% |
| stability | Stability | 20% |
| consistency | Consistency | 15% |
| timing | Timing | 20% |

**Formula:** `overallScore = 0.20 × power + 0.25 × technique + 0.20 × stability + 0.15 × consistency + 0.20 × timing`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 15 – 28 |
| elbowAngle | Elbow Angle | deg | biomechanics | 100 – 145 |
| shoulderRotation | Shoulder Rotation | deg/s | biomechanics | 350 – 750 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| ballSpeed | Ball Speed | mph | ball | 35 – 70 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |
| contactHeight | Contact Height | m | technique | 0.60 – 1.05 |

---

## 18. Paddle — Serve

**Config Key:** `paddle-serve`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| technique | Technique | 30% |
| placement | Placement | 25% |
| consistency | Consistency | 25% |
| timing | Timing | 20% |

**Formula:** `overallScore = 0.30 × technique + 0.25 × placement + 0.25 × consistency + 0.20 × timing`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleAngle | Paddle Angle | deg | technique | 15 – 45 |
| ballSpeed | Ball Speed | mph | ball | 30 – 60 |
| placementScore | Placement | /100 | technique | 65 – 98 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 19. Paddle — Smash

**Config Key:** `paddle-smash`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 30% |
| technique | Technique | 25% |
| athleticism | Athleticism | 25% |
| timing | Timing | 20% |

**Formula:** `overallScore = 0.30 × power + 0.25 × technique + 0.25 × athleticism + 0.20 × timing`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 22 – 38 |
| shoulderRotation | Shoulder Rotation | deg/s | biomechanics | 500 – 900 |
| jumpHeight | Jump Height | m | power | 0.10 – 0.50 |
| ballSpeed | Ball Speed | mph | ball | 50 – 90 |
| contactHeight | Contact Height | m | technique | 2.0 – 3.0 |
| balanceScore | Balance | /100 | biomechanics | 65 – 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 – 92 |

---

## 20. Paddle — Bandeja

**Config Key:** `paddle-bandeja`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| control | Control | 30% |
| technique | Technique | 25% |
| consistency | Consistency | 25% |
| timing | Timing | 20% |

**Formula:** `overallScore = 0.30 × control + 0.25 × technique + 0.25 × consistency + 0.20 × timing`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleAngle | Paddle Angle | deg | technique | 20 – 50 |
| ballSpeed | Ball Speed | mph | ball | 25 – 55 |
| wristControl | Wrist Control | /100 | technique | 70 – 98 |
| contactHeight | Contact Height | m | technique | 1.8 – 2.8 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 21. Badminton — Clear

**Config Key:** `badminton-clear`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 25% |
| technique | Technique | 25% |
| footwork | Footwork | 20% |
| timing | Timing | 15% |
| consistency | Consistency | 15% |

**Formula:** `overallScore = 0.25 × power + 0.25 × technique + 0.20 × footwork + 0.15 × timing + 0.15 × consistency`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| racketSpeed | Racket Speed | m/s | power | 25 – 45 |
| shuttleSpeed | Shuttle Speed | mph | ball | 80 – 150 |
| trajectoryHeight | Trajectory Height | m | ball | 5 – 10 |
| shoulderRotation | Shoulder Rotation | deg/s | biomechanics | 500 – 900 |
| footworkScore | Footwork | /100 | biomechanics | 65 – 95 |
| balanceScore | Balance | /100 | biomechanics | 65 – 95 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 22. Badminton — Smash

**Config Key:** `badminton-smash`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 30% |
| technique | Technique | 25% |
| timing | Timing | 20% |
| athleticism | Athleticism | 15% |
| consistency | Consistency | 10% |

**Formula:** `overallScore = 0.30 × power + 0.25 × technique + 0.20 × timing + 0.15 × athleticism + 0.10 × consistency`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| racketSpeed | Racket Speed | m/s | power | 35 – 60 |
| shuttleSpeed | Shuttle Speed | mph | ball | 150 – 300 |
| jumpHeight | Jump Height | m | biomechanics | 0.2 – 0.6 |
| contactHeight | Contact Height | m | technique | 2.5 – 3.2 |
| wristSnap | Wrist Snap | deg/s | technique | 400 – 800 |
| bodyRotation | Body Rotation | deg/s | biomechanics | 500 – 1000 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 23. Badminton — Drop

**Config Key:** `badminton-drop`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| touch | Touch | 30% |
| deception | Deception | 25% |
| technique | Technique | 20% |
| consistency | Consistency | 15% |
| timing | Timing | 10% |

**Formula:** `overallScore = 0.30 × touch + 0.25 × deception + 0.20 × technique + 0.15 × consistency + 0.10 × timing`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| touchScore | Touch | /100 | technique | 70 – 98 |
| deceptionScore | Deception | /100 | technique | 65 – 95 |
| netClearance | Net Clearance | cm | ball | 2 – 15 |
| racketAngle | Racket Angle | deg | technique | 20 – 45 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 24. Badminton — Net Shot

**Config Key:** `badminton-net-shot`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| control | Control | 30% |
| finesse | Finesse | 25% |
| footwork | Footwork | 20% |
| consistency | Consistency | 15% |
| timing | Timing | 10% |

**Formula:** `overallScore = 0.30 × control + 0.25 × finesse + 0.20 × footwork + 0.15 × consistency + 0.10 × timing`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| racketControl | Racket Control | /100 | technique | 70 – 98 |
| wristFinesse | Wrist Finesse | /100 | technique | 70 – 98 |
| balanceScore | Balance | /100 | biomechanics | 65 – 95 |
| footworkScore | Footwork | /100 | biomechanics | 65 – 95 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 25. Badminton — Serve

**Config Key:** `badminton-serve`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| accuracy | Accuracy | 30% |
| technique | Technique | 25% |
| consistency | Consistency | 25% |
| timing | Timing | 20% |

**Formula:** `overallScore = 0.30 × accuracy + 0.25 × technique + 0.25 × consistency + 0.20 × timing`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| racketAngle | Racket Angle | deg | technique | 15 – 40 |
| shuttleSpeed | Shuttle Speed | mph | ball | 30 – 100 |
| placementScore | Placement | /100 | ball | 70 – 98 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 26. Table Tennis — Forehand

**Config Key:** `tabletennis-forehand`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 20% |
| technique | Technique | 25% |
| spin | Spin | 20% |
| footwork | Footwork | 15% |
| consistency | Consistency | 20% |

**Formula:** `overallScore = 0.20 × power + 0.25 × technique + 0.20 × spin + 0.15 × footwork + 0.20 × consistency`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| batSpeed | Bat Speed | m/s | power | 8 – 18 |
| wristAction | Wrist Action | deg/s | technique | 300 – 700 |
| spinRate | Spin Rate | rpm | ball | 2000 – 5000 |
| footworkScore | Footwork | /100 | biomechanics | 65 – 95 |
| bodyRotation | Body Rotation | deg/s | biomechanics | 200 – 500 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 27. Table Tennis — Backhand

**Config Key:** `tabletennis-backhand`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| speed | Speed | 20% |
| timing | Timing | 25% |
| technique | Technique | 20% |
| consistency | Consistency | 20% |
| stability | Stability | 15% |

**Formula:** `overallScore = 0.20 × speed + 0.25 × timing + 0.20 × technique + 0.20 × consistency + 0.15 × stability`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| batSpeed | Bat Speed | m/s | power | 6 – 15 |
| timingScore | Timing | /100 | timing | 70 – 98 |
| batAngle | Bat Angle | deg | technique | 30 – 70 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 28. Table Tennis — Serve

**Config Key:** `tabletennis-serve`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| spin | Spin | 25% |
| technique | Technique | 25% |
| placement | Placement | 20% |
| deception | Deception | 15% |
| consistency | Consistency | 15% |

**Formula:** `overallScore = 0.25 × spin + 0.25 × technique + 0.20 × placement + 0.15 × deception + 0.15 × consistency`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| spinVariation | Spin Variation | rpm | ball | 1500 – 4500 |
| batAngle | Bat Angle | deg | technique | 20 – 65 |
| ballSpeed | Ball Speed | mph | ball | 15 – 40 |
| tossHeight | Toss Height | cm | technique | 16 – 30 |
| placementScore | Placement | /100 | technique | 65 – 95 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

---

## 29. Table Tennis — Loop

**Config Key:** `tabletennis-loop`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| power | Power | 20% |
| spin | Spin | 25% |
| technique | Technique | 20% |
| stability | Stability | 15% |
| consistency | Consistency | 20% |

**Formula:** `overallScore = 0.20 × power + 0.25 × spin + 0.20 × technique + 0.15 × stability + 0.20 × consistency`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| batSpeed | Bat Speed | m/s | power | 10 – 22 |
| bodyRotation | Body Rotation | deg/s | biomechanics | 250 – 600 |
| spinRate | Spin Rate | rpm | ball | 3000 – 6000 |
| contactPoint | Contact Point | /100 | technique | 65 – 95 |
| balanceScore | Balance | /100 | biomechanics | 65 – 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 – 92 |

---

## 30. Table Tennis — Chop

**Config Key:** `tabletennis-chop`

### Scores

| Key | Label | Weight |
|-----|-------|--------|
| technique | Technique | 25% |
| consistency | Consistency | 25% |
| spin | Spin | 20% |
| stability | Stability | 15% |
| footwork | Footwork | 15% |

**Formula:** `overallScore = 0.25 × technique + 0.25 × consistency + 0.20 × spin + 0.15 × stability + 0.15 × footwork`

### Metrics

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| batAngle | Bat Angle | deg | technique | 40 – 75 |
| shotConsistency | Consistency | /100 | consistency | 70 – 98 |
| spinRate | Spin Rate | rpm | ball | 1500 – 4000 |
| balanceScore | Balance | /100 | biomechanics | 70 – 98 |
| footworkScore | Footwork | /100 | biomechanics | 65 – 95 |
| rhythmConsistency | Rhythm | /100 | timing | 65 – 95 |

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
| pickleball-dink | `shared/sport-configs/pickleball-dink.ts` |
| pickleball-drive | `shared/sport-configs/pickleball-drive.ts` |
| pickleball-serve | `shared/sport-configs/pickleball-serve.ts` |
| pickleball-volley | `shared/sport-configs/pickleball-volley.ts` |
| pickleball-third-shot-drop | `shared/sport-configs/pickleball-third-shot-drop.ts` |
| paddle-forehand | `shared/sport-configs/paddle-forehand.ts` |
| paddle-backhand | `shared/sport-configs/paddle-backhand.ts` |
| paddle-serve | `shared/sport-configs/paddle-serve.ts` |
| paddle-smash | `shared/sport-configs/paddle-smash.ts` |
| paddle-bandeja | `shared/sport-configs/paddle-bandeja.ts` |
| badminton-clear | `shared/sport-configs/badminton-clear.ts` |
| badminton-smash | `shared/sport-configs/badminton-smash.ts` |
| badminton-drop | `shared/sport-configs/badminton-drop.ts` |
| badminton-net-shot | `shared/sport-configs/badminton-net-shot.ts` |
| badminton-serve | `shared/sport-configs/badminton-serve.ts` |
| tabletennis-forehand | `shared/sport-configs/tabletennis-forehand.ts` |
| tabletennis-backhand | `shared/sport-configs/tabletennis-backhand.ts` |
| tabletennis-serve | `shared/sport-configs/tabletennis-serve.ts` |
| tabletennis-loop | `shared/sport-configs/tabletennis-loop.ts` |
| tabletennis-chop | `shared/sport-configs/tabletennis-chop.ts` |

Type definitions: `shared/sport-configs/types.ts`
Registry & lookup functions: `shared/sport-configs/index.ts`
