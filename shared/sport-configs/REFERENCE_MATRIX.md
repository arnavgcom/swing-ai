# Swing AI - Sport Configuration Reference Matrix

Clean, standardized reference for all sport categories.

## Summary

| # | Sport | Category | Config Key | Metrics | Sub-Scores | Score Label |
|---|-------|----------|------------|---------|------------|-------------|
| 1 | Tennis | Forehand | `tennis-forehand` | 13 | 4 | Forehand Score |
| 2 | Tennis | Backhand | `tennis-backhand` | 13 | 4 | Backhand Score |
| 3 | Tennis | Serve | `tennis-serve` | 13 | 4 | Serve Score |
| 4 | Tennis | Volley | `tennis-volley` | 10 | 4 | Volley Score |
| 5 | Tennis | Game | `tennis-game` | 8 | 4 | Game Score |
| 6 | Golf | Drive | `golf-drive` | 12 | 4 | Drive Score |
| 7 | Golf | Iron Shot | `golf-iron` | 10 | 4 | Iron Shot Score |
| 8 | Golf | Chip | `golf-chip` | 8 | 4 | Chip Score |
| 9 | Golf | Putt | `golf-putt` | 8 | 4 | Putting Score |
| 10 | Golf | Full Swing | `golf-full-swing` | 10 | 4 | Full Swing Score |
| 11 | Badminton | Clear | `badminton-clear` | 7 | 4 | Clear Score |
| 12 | Badminton | Smash | `badminton-smash` | 7 | 4 | Smash Score |
| 13 | Badminton | Drop Shot | `badminton-drop` | 6 | 4 | Drop Shot Score |
| 14 | Badminton | Net Shot | `badminton-net-shot` | 6 | 4 | Net Shot Score |
| 15 | Badminton | Serve | `badminton-serve` | 5 | 4 | Serve Score |
| 16 | Paddle | Forehand | `paddle-forehand` | 9 | 4 | Forehand Score |
| 17 | Paddle | Backhand | `paddle-backhand` | 8 | 4 | Backhand Score |
| 18 | Paddle | Serve | `paddle-serve` | 6 | 4 | Serve Score |
| 19 | Paddle | Smash | `paddle-smash` | 7 | 4 | Smash Score |
| 20 | Paddle | Bandeja | `paddle-bandeja` | 7 | 4 | Bandeja Score |
| 21 | Pickleball | Dink | `pickleball-dink` | 7 | 4 | Dink Score |
| 22 | Pickleball | Drive | `pickleball-drive` | 7 | 4 | Drive Score |
| 23 | Pickleball | Serve | `pickleball-serve` | 6 | 4 | Serve Score |
| 24 | Pickleball | Volley | `pickleball-volley` | 7 | 4 | Volley Score |
| 25 | Pickleball | Third Shot Drop | `pickleball-third-shot-drop` | 6 | 4 | Third Shot Drop Score |
| 26 | Table Tennis | Forehand | `tabletennis-forehand` | 7 | 4 | Forehand Score |
| 27 | Table Tennis | Backhand | `tabletennis-backhand` | 6 | 4 | Backhand Score |
| 28 | Table Tennis | Serve | `tabletennis-serve` | 6 | 4 | Serve Score |
| 29 | Table Tennis | Loop | `tabletennis-loop` | 6 | 4 | Loop Score |
| 30 | Table Tennis | Chop | `tabletennis-chop` | 6 | 4 | Chop Score |

## Scoring Contract

- Tactical sub-scores are standardized to `power`, `control`, `timing`, and `technique`.
- Runtime standardized tactical formula: `tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`.
- `consistency` is excluded from the standardized tactical output.
- App overall formula: `overallScore = (technicalScore + tacticalScore + movementScore) / 3`.

## 1. Tennis - Forehand

### Sport Category

- Sport: `Tennis`
- Category: `Forehand`
- Config Key: `tennis-forehand`
- Source Config: `shared/sport-configs/tennis-forehand.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 25 - 40 |
| elbowAngle | Elbow Angle | deg | biomechanics | 120 - 160 |
| shoulderRotation | Torso Rotation | deg/s | biomechanics | 500 - 900 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| ballSpeed | Ball Speed | mph | ball | 55 - 100 |
| trajectoryArc | Trajectory Arc | deg | ball | 8 - 25 |
| spinRate | Spin Rate | rpm | ball | 800 - 2800 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| backswingDuration | Backswing | s | timing | 0.3 - 0.7 |
| contactTiming | Contact Timing | s | timing | 0.02 - 0.08 |
| followThroughDuration | Follow-through | s | timing | 0.4 - 1 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |
| contactHeight | Contact Height | m | technique | 0.85 - 1.1 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp(((bal * 0.5 + rhythm * 0.3 + cc * 0.2) * 100), 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp(((ft * 0.5 + rot * 0.3 + self._normalize(m["contactHeight"], 0.5, 1.5) * 0.2) * 100), 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: ballSpeed, spinRate, wristSpeed
- control: balanceScore, rhythmConsistency, shotConsistency
- timing: backswingDuration, contactTiming, rhythmConsistency
- technique: contactHeight, followThroughDuration, shoulderRotation

Raw analyzer formulas used by standardization (from `python_analysis/sports/tennis_forehand.py`):
- `power = (self._normalize(m["ballSpeed"], 40.0, 130.0) * 0.5 + nr * 0.3 + self._normalize(m["spinRate"], 400.0, 3500.0) * 0.2) * 100`
- `timing = (self._normalize(0.12 - m["contactTiming"], 0.0, 0.10) * 0.4 + self._normalize(m["backswingDuration"], 0.3, 0.8) * 0.3 + rhythm * 0.3) * 100`

Intermediate variables used above:
- `bal = self._normalize(m["balanceScore"], 40.0, 98.0)`
- `cc = self._normalize(m["shotConsistency"], 40.0, 98.0)`
- `ft = self._normalize(m["followThroughDuration"], 0.3, 1.2)`
- `nr = self._normalize(m["wristSpeed"], 15.0, 45.0)`
- `rhythm = self._normalize(m["rhythmConsistency"], 50.0, 98.0)`
- `rot = self._normalize(m["shoulderRotation"], 350.0, 950.0)`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Forehand Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 2. Tennis - Backhand

### Sport Category

- Sport: `Tennis`
- Category: `Backhand`
- Config Key: `tennis-backhand`
- Source Config: `shared/sport-configs/tennis-backhand.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 20 - 35 |
| elbowAngle | Elbow Angle | deg | biomechanics | 110 - 155 |
| shoulderRotation | Torso Rotation | deg/s | biomechanics | 400 - 800 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| ballSpeed | Ball Speed | mph | ball | 45 - 90 |
| trajectoryArc | Trajectory Arc | deg | ball | 8 - 22 |
| spinRate | Spin Rate | rpm | ball | 700 - 2500 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| backswingDuration | Backswing | s | timing | 0.3 - 0.8 |
| contactTiming | Contact Timing | s | timing | 0.02 - 0.08 |
| followThroughDuration | Follow-through | s | timing | 0.4 - 1 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |
| contactHeight | Contact Height | m | technique | 0.8 - 1.05 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp(((bal * 0.5 + rhythm * 0.3 + cc * 0.2) * 100), 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp(((ft * 0.5 + rot * 0.3 + self._normalize(m["contactHeight"], 0.5, 1.4) * 0.2) * 100), 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: ballSpeed, spinRate, wristSpeed
- control: balanceScore, rhythmConsistency, shotConsistency
- timing: backswingDuration, contactTiming, rhythmConsistency
- technique: contactHeight, followThroughDuration, shoulderRotation

Raw analyzer formulas used by standardization (from `python_analysis/sports/tennis_backhand.py`):
- `power = (self._normalize(m["ballSpeed"], 35.0, 110.0) * 0.5 + nr * 0.3 + self._normalize(m["spinRate"], 400.0, 3000.0) * 0.2) * 100`
- `timing = (self._normalize(0.12 - m["contactTiming"], 0.0, 0.10) * 0.4 + self._normalize(m["backswingDuration"], 0.3, 0.8) * 0.3 + rhythm * 0.3) * 100`

Intermediate variables used above:
- `bal = self._normalize(m["balanceScore"], 40.0, 98.0)`
- `cc = self._normalize(m["shotConsistency"], 40.0, 98.0)`
- `ft = self._normalize(m["followThroughDuration"], 0.3, 1.2)`
- `nr = self._normalize(m["wristSpeed"], 12.0, 40.0)`
- `rhythm = self._normalize(m["rhythmConsistency"], 50.0, 98.0)`
- `rot = self._normalize(m["shoulderRotation"], 300.0, 850.0)`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Backhand Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 3. Tennis - Serve

### Sport Category

- Sport: `Tennis`
- Category: `Serve`
- Config Key: `tennis-serve`
- Source Config: `shared/sport-configs/tennis-serve.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 30 - 50 |
| shoulderRotation | Torso Rotation | deg/s | biomechanics | 600 - 1100 |
| tossHeight | Toss Height | m | technique | 0.3 - 0.8 |
| trophyAngle | Trophy Position | deg | technique | 80 - 110 |
| pronation | Pronation | deg/s | technique | 400 - 900 |
| ballSpeed | Serve Speed | mph | ball | 70 - 130 |
| trajectoryArc | Trajectory Arc | deg | ball | 3 - 15 |
| spinRate | Spin Rate | rpm | ball | 1000 - 3500 |
| balanceScore | Balance | /100 | biomechanics | 65 - 95 |
| backswingDuration | Wind-up | s | timing | 0.8 - 1.5 |
| contactTiming | Contact Timing | s | timing | 0.02 - 0.06 |
| contactHeight | Contact Height | m | technique | 2.2 - 2.8 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp(accuracy, 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp((technique * 1 + accuracy * 0.4) / 1.4, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: ballSpeed, spinRate, wristSpeed
- control: contactHeight, tossHeight, trajectoryArc
- timing: backswingDuration, contactTiming, rhythmConsistency
- technique: contactHeight, pronation, shoulderRotation, tossHeight, trajectoryArc, trophyAngle

Raw analyzer formulas used by standardization (from `python_analysis/sports/tennis_serve.py`):
- `accuracy = (self._normalize(m["tossHeight"], 0.3, 0.8) * 0.4 + self._normalize(m["contactHeight"], 2.2, 2.8) * 0.35 + self._normalize(m["trajectoryArc"], 3.0, 15.0) * 0.25) * 100`
- `power = (self._normalize(m["ballSpeed"], 50.0, 140.0) * 0.4 + self._normalize(m["wristSpeed"], 20.0, 55.0) * 0.35 + self._normalize(m["spinRate"], 500.0, 3800.0) * 0.25) * 100`
- `technique = (self._normalize(m["trophyAngle"], 80.0, 110.0) * 0.35 + self._normalize(m["pronation"], 400.0, 900.0) * 0.35 + self._normalize(m["shoulderRotation"], 400.0, 1200.0) * 0.3) * 100`
- `timing = (self._normalize(0.08 - m["contactTiming"], 0.0, 0.06) * 0.4 + self._normalize(m["backswingDuration"], 0.8, 1.5) * 0.3 + self._normalize(m["rhythmConsistency"], 50.0, 98.0) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Serve Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 4. Tennis - Volley

### Sport Category

- Sport: `Tennis`
- Category: `Volley`
- Config Key: `tennis-volley`
- Source Config: `shared/sport-configs/tennis-volley.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| reactionSpeed | Reaction Speed | ms | timing | 150 - 350 |
| racketPrep | Racket Prep | /100 | technique | 70 - 98 |
| wristFirmness | Wrist Firmness | /100 | technique | 75 - 98 |
| splitStepTiming | Split Step | s | timing | 0.1 - 0.4 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| contactHeight | Contact Height | m | technique | 0.8 - 1.5 |
| stepForward | Step Forward | /100 | biomechanics | 60 - 95 |
| ballSpeed | Ball Speed | mph | ball | 30 - 70 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = 78 (fallback; no matching aliases)`
- `control = round(clamp((((self._normalize(m["balanceScore"], 40, 98) * 0.5 + self._normalize(m["wristFirmness"], 50, 98) * 0.5) * 100) * 0.9 + placement * 0.8 + reflexes * 0.5) / 2.2, 0, 100))`
- `timing = round(clamp(reflexes, 0, 100))`
- `technique = round(clamp((technique * 1 + placement * 0.4) / 1.4, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: fallback default only
- control: balanceScore, ballSpeed, contactHeight, racketPrep, reactionSpeed, stepForward, wristFirmness
- timing: racketPrep, reactionSpeed
- technique: ballSpeed, contactHeight, racketPrep, shotConsistency, stepForward, wristFirmness

Raw analyzer formulas used by standardization (from `python_analysis/sports/tennis_volley.py`):
- `placement = (self._normalize(m["contactHeight"], 0.8, 1.5) * 0.4 + self._normalize(m["ballSpeed"], 30, 70) * 0.3 + self._normalize(m["stepForward"], 40, 98) * 0.3) * 100`
- `reflexes = (self._normalize(500 - m["reactionSpeed"], 0, 350) * 0.6 + self._normalize(m["racketPrep"], 50, 98) * 0.4) * 100`
- `technique = (self._normalize(m["racketPrep"], 50, 98) * 0.35 + self._normalize(m["wristFirmness"], 50, 98) * 0.35 + self._normalize(m["shotConsistency"], 40, 98) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Volley Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 5. Tennis - Game

### Sport Category

- Sport: `Tennis`
- Category: `Game`
- Config Key: `tennis-game`
- Source Config: `shared/sport-configs/tennis-game.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| courtCoverage | Court Coverage | /100 | biomechanics | 60 - 95 |
| recoverySpeed | Recovery Speed | m/s | biomechanics | 2 - 5 |
| avgBallSpeed | Avg Ball Speed | mph | ball | 50 - 90 |
| shotVariety | Shot Variety | /100 | technique | 50 - 90 |
| balanceScore | Balance | /100 | biomechanics | 65 - 95 |
| rallyLength | Rally Length | shots | consistency | 4 - 12 |
| shotConsistency | Consistency | /100 | consistency | 65 - 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 - 90 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp((movement * 0.6 + shotSelection * 0.6) / 1.2, 0, 100))`
- `timing = 78 (fallback; no matching aliases)`
- `technique = round(clamp((shotSelection * 0.4 + movement * 0.4) / 0.8, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: avgBallSpeed, recoverySpeed
- control: avgBallSpeed, courtCoverage, recoverySpeed, shotVariety
- timing: fallback default only
- technique: avgBallSpeed, courtCoverage, recoverySpeed, shotVariety

Raw analyzer formulas used by standardization (from `python_analysis/sports/tennis_game.py`):
- `movement = (self._normalize(m["courtCoverage"], 30, 98) * 0.5 + self._normalize(m["recoverySpeed"], 1.5, 6.0) * 0.5) * 100`
- `power = (self._normalize(m["avgBallSpeed"], 40, 100) * 0.6 + self._normalize(m["recoverySpeed"], 1.5, 6.0) * 0.4) * 100`
- `shotSelection = (self._normalize(m["shotVariety"], 30, 95) * 0.5 + self._normalize(m["avgBallSpeed"], 40, 100) * 0.5) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Game Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 6. Golf - Drive

### Sport Category

- Sport: `Golf`
- Category: `Drive`
- Config Key: `golf-drive`
- Source Config: `shared/sport-configs/golf-drive.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| clubHeadSpeed | Club Head Speed | mph | power | 85 - 115 |
| hipRotation | Hip Rotation | deg | biomechanics | 35 - 55 |
| shoulderRotation | Shoulder Turn | deg | biomechanics | 75 - 100 |
| xFactor | X-Factor | deg | biomechanics | 30 - 50 |
| spineAngle | Spine Angle | deg | technique | 25 - 40 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| tempoRatio | Tempo Ratio | :1 | timing | 2.5 - 3.5 |
| backswingDuration | Backswing | s | timing | 0.7 - 1.2 |
| downswingDuration | Downswing | s | timing | 0.2 - 0.4 |
| followThroughDuration | Follow-through | s | timing | 0.5 - 1 |
| headStability | Head Stability | /100 | technique | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | consistency | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp(balance, 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: clubHeadSpeed, shoulderRotation, xFactor
- control: balanceScore, headStability
- timing: backswingDuration, downswingDuration, tempoRatio
- technique: headStability, hipRotation, spineAngle

Raw analyzer formulas used by standardization (from `python_analysis/sports/golf_drive.py`):
- `balance = (self._normalize(m["balanceScore"], 40, 98) * 0.6 + self._normalize(m["headStability"], 40, 98) * 0.4) * 100`
- `power = (self._normalize(m["clubHeadSpeed"], 70, 125) * 0.5 + self._normalize(m["shoulderRotation"], 60, 110) * 0.3 + self._normalize(m["xFactor"], 15, 60) * 0.2) * 100`
- `technique = (self._normalize(m["spineAngle"], 25, 40) * 0.35 + self._normalize(m["headStability"], 40, 98) * 0.35 + self._normalize(m["hipRotation"], 25, 65) * 0.3) * 100`
- `timing = (self._normalize(m["tempoRatio"], 2.5, 3.5) * 0.4 + self._normalize(m["backswingDuration"], 0.7, 1.2) * 0.3 + self._normalize(m["downswingDuration"], 0.2, 0.4) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Drive Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 7. Golf - Iron Shot

### Sport Category

- Sport: `Golf`
- Category: `Iron Shot`
- Config Key: `golf-iron`
- Source Config: `shared/sport-configs/golf-iron.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| clubHeadSpeed | Club Head Speed | mph | power | 70 - 95 |
| hipRotation | Hip Rotation | deg | biomechanics | 30 - 50 |
| shoulderRotation | Shoulder Turn | deg | biomechanics | 70 - 95 |
| spineAngle | Spine Angle | deg | technique | 28 - 42 |
| divotAngle | Divot Angle | deg | technique | -5 - -1 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| tempoRatio | Tempo Ratio | :1 | timing | 2.5 - 3.5 |
| backswingDuration | Backswing | s | timing | 0.6 - 1.1 |
| headStability | Head Stability | /100 | technique | 75 - 98 |
| rhythmConsistency | Rhythm | /100 | consistency | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp((accuracy * 0.8 + balance * 0.7) / 1.5, 0, 100))`
- `timing = 78 (fallback; no matching aliases)`
- `technique = round(clamp((technique * 1 + accuracy * 0.4) / 1.4, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: clubHeadSpeed, hipRotation, shoulderRotation
- control: balanceScore, divotAngle, headStability, rhythmConsistency
- timing: fallback default only
- technique: divotAngle, headStability, hipRotation, rhythmConsistency, spineAngle

Raw analyzer formulas used by standardization (from `python_analysis/sports/golf_iron.py`):
- `accuracy = (self._normalize(abs(m["divotAngle"]), 1, 5) * 0.4 + self._normalize(m["headStability"], 40, 98) * 0.3 + self._normalize(m["rhythmConsistency"], 50, 98) * 0.3) * 100`
- `balance = (self._normalize(m["balanceScore"], 40, 98) * 0.6 + self._normalize(m["headStability"], 40, 98) * 0.4) * 100`
- `power = (self._normalize(m["clubHeadSpeed"], 55, 105) * 0.5 + self._normalize(m["shoulderRotation"], 55, 105) * 0.3 + self._normalize(m["hipRotation"], 20, 58) * 0.2) * 100`
- `technique = (self._normalize(m["spineAngle"], 28, 42) * 0.3 + self._normalize(m["headStability"], 40, 98) * 0.3 + self._normalize(abs(m["divotAngle"]), 1, 5) * 0.2 + self._normalize(m["hipRotation"], 20, 58) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Iron Shot Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 8. Golf - Chip

### Sport Category

- Sport: `Golf`
- Category: `Chip`
- Config Key: `golf-chip`
- Source Config: `shared/sport-configs/golf-chip.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristHinge | Wrist Hinge | deg | technique | 5 - 20 |
| armPendulum | Arm Pendulum | /100 | technique | 75 - 98 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| headStability | Head Stability | /100 | technique | 80 - 98 |
| strokeLength | Stroke Length | /100 | technique | 60 - 90 |
| contactQuality | Contact Quality | /100 | technique | 70 - 98 |
| followThroughRatio | Follow-through | /100 | timing | 70 - 95 |
| rhythmConsistency | Rhythm | /100 | consistency | 70 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(touch, 0, 100))`
- `control = round(clamp(balance, 0, 100))`
- `timing = 78 (fallback; no matching aliases)`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: contactQuality, followThroughRatio, strokeLength
- control: balanceScore, headStability
- timing: fallback default only
- technique: armPendulum, contactQuality, headStability, wristHinge

Raw analyzer formulas used by standardization (from `python_analysis/sports/golf_chip.py`):
- `balance = (self._normalize(m["balanceScore"], 50, 98) * 0.6 + self._normalize(m["headStability"], 50, 98) * 0.4) * 100`
- `technique = (self._normalize(m["wristHinge"], 5, 20) * 0.3 + self._normalize(m["armPendulum"], 50, 98) * 0.3 + self._normalize(m["headStability"], 50, 98) * 0.2 + self._normalize(m["contactQuality"], 50, 98) * 0.2) * 100`
- `touch = (self._normalize(m["strokeLength"], 40, 95) * 0.4 + self._normalize(m["contactQuality"], 50, 98) * 0.3 + self._normalize(m["followThroughRatio"], 50, 98) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Chip Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 9. Golf - Putt

### Sport Category

- Sport: `Golf`
- Category: `Putt`
- Config Key: `golf-putt`
- Source Config: `shared/sport-configs/golf-putt.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| pendulumScore | Pendulum | /100 | technique | 75 - 98 |
| headStability | Head Stability | /100 | technique | 85 - 98 |
| eyeLine | Eye Line | /100 | technique | 75 - 98 |
| strokeLength | Stroke Length | /100 | technique | 70 - 95 |
| wristStability | Wrist Stability | /100 | technique | 80 - 98 |
| balanceScore | Balance | /100 | biomechanics | 80 - 98 |
| tempoRatio | Tempo | :1 | timing | 0.8 - 1.2 |
| rhythmConsistency | Rhythm | /100 | consistency | 75 - 98 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(touch, 0, 100))`
- `control = round(clamp(alignment, 0, 100))`
- `timing = 78 (fallback; no matching aliases)`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: pendulumScore, strokeLength, tempoRatio
- control: eyeLine, headStability
- timing: fallback default only
- technique: eyeLine, headStability, pendulumScore, wristStability

Raw analyzer formulas used by standardization (from `python_analysis/sports/golf_putt.py`):
- `alignment = (self._normalize(m["eyeLine"], 55, 98) * 0.5 + self._normalize(m["headStability"], 55, 98) * 0.5) * 100`
- `technique = (self._normalize(m["pendulumScore"], 55, 98) * 0.3 + self._normalize(m["headStability"], 55, 98) * 0.3 + self._normalize(m["eyeLine"], 55, 98) * 0.2 + self._normalize(m["wristStability"], 55, 98) * 0.2) * 100`
- `touch = (self._normalize(m["strokeLength"], 50, 98) * 0.4 + self._normalize(m["tempoRatio"], 0.8, 1.2) * 0.3 + self._normalize(m["pendulumScore"], 55, 98) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Putting Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 10. Golf - Full Swing

### Sport Category

- Sport: `Golf`
- Category: `Full Swing`
- Config Key: `golf-full-swing`
- Source Config: `shared/sport-configs/golf-full-swing.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| clubHeadSpeed | Club Head Speed | mph | power | 80 - 110 |
| hipRotation | Hip Rotation | deg | biomechanics | 35 - 55 |
| shoulderRotation | Shoulder Turn | deg | biomechanics | 75 - 100 |
| xFactor | X-Factor | deg | biomechanics | 30 - 50 |
| spineAngle | Spine Angle | deg | technique | 25 - 40 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| tempoRatio | Tempo Ratio | :1 | timing | 2.5 - 3.5 |
| backswingDuration | Backswing | s | timing | 0.7 - 1.2 |
| headStability | Head Stability | /100 | technique | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | consistency | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp(balance, 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: clubHeadSpeed, shoulderRotation, xFactor
- control: balanceScore, headStability
- timing: backswingDuration, tempoRatio
- technique: headStability, hipRotation, spineAngle

Raw analyzer formulas used by standardization (from `python_analysis/sports/golf_full_swing.py`):
- `balance = (self._normalize(m["balanceScore"], 40, 98) * 0.6 + self._normalize(m["headStability"], 40, 98) * 0.4) * 100`
- `power = (self._normalize(m["clubHeadSpeed"], 65, 120) * 0.5 + self._normalize(m["shoulderRotation"], 60, 110) * 0.3 + self._normalize(m["xFactor"], 15, 55) * 0.2) * 100`
- `technique = (self._normalize(m["spineAngle"], 25, 40) * 0.35 + self._normalize(m["headStability"], 40, 98) * 0.35 + self._normalize(m["hipRotation"], 25, 60) * 0.3) * 100`
- `timing = (self._normalize(m["tempoRatio"], 2.5, 3.5) * 0.5 + self._normalize(m["backswingDuration"], 0.7, 1.2) * 0.5) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Full Swing Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 11. Badminton - Clear

### Sport Category

- Sport: `Badminton`
- Category: `Clear`
- Config Key: `badminton-clear`
- Source Config: `shared/sport-configs/badminton-clear.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| racketSpeed | Racket Speed | m/s | power | 25 - 45 |
| shuttleSpeed | Shuttle Speed | mph | ball | 80 - 150 |
| trajectoryHeight | Trajectory Height | m | ball | 5 - 10 |
| shoulderRotation | Torso Rotation | deg/s | biomechanics | 500 - 900 |
| footworkScore | Footwork | /100 | biomechanics | 65 - 95 |
| balanceScore | Balance | /100 | biomechanics | 65 - 95 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = 78 (fallback; no matching aliases)`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp((technique * 1 + footwork * 0.6) / 1.6, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: racketSpeed, shuttleSpeed
- control: fallback default only
- timing: rhythmConsistency
- technique: balanceScore, footworkScore, shoulderRotation, trajectoryHeight

Raw analyzer formulas used by standardization (from `python_analysis/sports/badminton_clear.py`):
- `footwork = (self._normalize(m["footworkScore"], 65.0, 95.0) * 0.6 + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.4) * 100`
- `power = (self._normalize(m["racketSpeed"], 25.0, 45.0) * 0.5 + self._normalize(m["shuttleSpeed"], 80.0, 150.0) * 0.5) * 100`
- `technique = (self._normalize(m["shoulderRotation"], 500.0, 900.0) * 0.5 + self._normalize(m["trajectoryHeight"], 5.0, 10.0) * 0.5) * 100`
- `timing = self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Clear Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 12. Badminton - Smash

### Sport Category

- Sport: `Badminton`
- Category: `Smash`
- Config Key: `badminton-smash`
- Source Config: `shared/sport-configs/badminton-smash.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| racketSpeed | Racket Speed | m/s | power | 35 - 60 |
| shuttleSpeed | Shuttle Speed | mph | ball | 150 - 300 |
| jumpHeight | Jump Height | m | biomechanics | 0.2 - 0.6 |
| contactHeight | Contact Height | m | technique | 2.5 - 3.2 |
| wristSnap | Wrist Snap | deg/s | technique | 400 - 800 |
| bodyRotation | Body Rotation | deg/s | biomechanics | 500 - 1000 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp((power * 1 + athleticism * 0.8) / 1.8, 0, 100))`
- `control = 78 (fallback; no matching aliases)`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: bodyRotation, jumpHeight, racketSpeed, shuttleSpeed, wristSnap
- control: fallback default only
- timing: rhythmConsistency
- technique: bodyRotation, contactHeight, wristSnap

Raw analyzer formulas used by standardization (from `python_analysis/sports/badminton_smash.py`):
- `athleticism = (self._normalize(m["jumpHeight"], 0.2, 0.6) * 0.5 + self._normalize(m["bodyRotation"], 500.0, 1000.0) * 0.5) * 100`
- `power = (self._normalize(m["racketSpeed"], 35.0, 60.0) * 0.4 + self._normalize(m["shuttleSpeed"], 150.0, 300.0) * 0.4 + self._normalize(m["wristSnap"], 400.0, 800.0) * 0.2) * 100`
- `technique = (self._normalize(m["wristSnap"], 400.0, 800.0) * 0.4 + self._normalize(m["contactHeight"], 2.5, 3.2) * 0.3 + self._normalize(m["bodyRotation"], 500.0, 1000.0) * 0.3) * 100`
- `timing = self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Smash Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 13. Badminton - Drop Shot

### Sport Category

- Sport: `Badminton`
- Category: `Drop Shot`
- Config Key: `badminton-drop`
- Source Config: `shared/sport-configs/badminton-drop.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| touchScore | Touch | /100 | technique | 70 - 98 |
| deceptionScore | Deception | /100 | technique | 65 - 95 |
| netClearance | Net Clearance | cm | ball | 2 - 15 |
| racketAngle | Racket Angle | deg | technique | 20 - 45 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(touch, 0, 100))`
- `control = round(clamp(deception, 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp((technique * 1 + deception * 0.5) / 1.5, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: netClearance, touchScore
- control: deceptionScore
- timing: rhythmConsistency
- technique: deceptionScore, racketAngle, touchScore

Raw analyzer formulas used by standardization (from `python_analysis/sports/badminton_drop.py`):
- `deception = self._normalize(m["deceptionScore"], 65.0, 95.0) * 100`
- `technique = (self._normalize(m["racketAngle"], 20.0, 45.0) * 0.5 + self._normalize(m["touchScore"], 70.0, 98.0) * 0.5) * 100`
- `timing = self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100`
- `touch = (self._normalize(m["touchScore"], 70.0, 98.0) * 0.5 + self._normalize(m["netClearance"], 2.0, 15.0) * 0.5) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Drop Shot Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 14. Badminton - Net Shot

### Sport Category

- Sport: `Badminton`
- Category: `Net Shot`
- Config Key: `badminton-net-shot`
- Source Config: `shared/sport-configs/badminton-net-shot.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| racketControl | Racket Control | /100 | technique | 70 - 98 |
| wristFinesse | Wrist Finesse | /100 | technique | 70 - 98 |
| balanceScore | Balance | /100 | biomechanics | 65 - 95 |
| footworkScore | Footwork | /100 | biomechanics | 65 - 95 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = 78 (fallback; no matching aliases)`
- `control = round(clamp((control * 1 + finesse * 0.7) / 1.7, 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp((footwork * 0.6 + control * 0.5 + finesse * 0.5) / 1.6, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: fallback default only
- control: balanceScore, racketControl, wristFinesse
- timing: rhythmConsistency
- technique: balanceScore, footworkScore, racketControl, wristFinesse

Raw analyzer formulas used by standardization (from `python_analysis/sports/badminton_net_shot.py`):
- `control = (self._normalize(m["racketControl"], 70.0, 98.0) * 0.6 + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.4) * 100`
- `finesse = (self._normalize(m["wristFinesse"], 70.0, 98.0) * 0.6 + self._normalize(m["racketControl"], 70.0, 98.0) * 0.4) * 100`
- `footwork = (self._normalize(m["footworkScore"], 65.0, 95.0) * 0.6 + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.4) * 100`
- `timing = self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Net Shot Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 15. Badminton - Serve

### Sport Category

- Sport: `Badminton`
- Category: `Serve`
- Config Key: `badminton-serve`
- Source Config: `shared/sport-configs/badminton-serve.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| racketAngle | Racket Angle | deg | technique | 15 - 40 |
| shuttleSpeed | Shuttle Speed | mph | ball | 30 - 100 |
| placementScore | Placement | /100 | ball | 70 - 98 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = 78 (fallback; no matching aliases)`
- `control = round(clamp(accuracy, 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp((technique * 1 + accuracy * 0.4) / 1.4, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: fallback default only
- control: placementScore, racketAngle
- timing: rhythmConsistency
- technique: placementScore, racketAngle, shuttleSpeed

Raw analyzer formulas used by standardization (from `python_analysis/sports/badminton_serve.py`):
- `accuracy = (self._normalize(m["placementScore"], 70.0, 98.0) * 0.5 + self._normalize(m["racketAngle"], 15.0, 40.0) * 0.5) * 100`
- `technique = (self._normalize(m["racketAngle"], 15.0, 40.0) * 0.5 + self._normalize(m["shuttleSpeed"], 30.0, 100.0) * 0.5) * 100`
- `timing = self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Serve Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 16. Paddle - Forehand

### Sport Category

- Sport: `Paddle`
- Category: `Forehand`
- Config Key: `paddle-forehand`
- Source Config: `shared/sport-configs/paddle-forehand.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 18 - 32 |
| elbowAngle | Elbow Angle | deg | biomechanics | 110 - 150 |
| shoulderRotation | Torso Rotation | deg/s | biomechanics | 400 - 800 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| ballSpeed | Ball Speed | mph | ball | 40 - 80 |
| wallPlayScore | Wall Play | /100 | technique | 60 - 95 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |
| contactHeight | Contact Height | m | technique | 0.7 - 1.1 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = 78 (fallback; no matching aliases)`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp((technique * 1 + wallPlay * 0.6) / 1.6, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: ballSpeed, shoulderRotation, wristSpeed
- control: fallback default only
- timing: balanceScore, rhythmConsistency, shotConsistency
- technique: balanceScore, contactHeight, elbowAngle, shotConsistency, shoulderRotation, wallPlayScore, wristSpeed

Raw analyzer formulas used by standardization (from `python_analysis/sports/paddle_forehand.py`):
- `power = (self._normalize(m["ballSpeed"], 40.0, 80.0) * 0.4 + self._normalize(m["wristSpeed"], 18.0, 32.0) * 0.35 + self._normalize(m["shoulderRotation"], 400.0, 800.0) * 0.25) * 100`
- `technique = (self._normalize(m["elbowAngle"], 110.0, 150.0) * 0.3 + self._normalize(m["contactHeight"], 0.7, 1.10) * 0.3 + self._normalize(m["shoulderRotation"], 400.0, 800.0) * 0.2 + self._normalize(m["wristSpeed"], 18.0, 32.0) * 0.2) * 100`
- `timing = (self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.5 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3 + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100`
- `wallPlay = (self._normalize(m["wallPlayScore"], 60.0, 95.0) * 0.6 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.2 + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Forehand Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 17. Paddle - Backhand

### Sport Category

- Sport: `Paddle`
- Category: `Backhand`
- Config Key: `paddle-backhand`
- Source Config: `shared/sport-configs/paddle-backhand.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 15 - 28 |
| elbowAngle | Elbow Angle | deg | biomechanics | 100 - 145 |
| shoulderRotation | Torso Rotation | deg/s | biomechanics | 350 - 750 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| ballSpeed | Ball Speed | mph | ball | 35 - 70 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |
| contactHeight | Contact Height | m | technique | 0.6 - 1.05 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp(((self._normalize(m["balanceScore"], 70.0, 98.0) * 0.5 + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3 + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100), 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: ballSpeed, shoulderRotation, wristSpeed
- control: balanceScore, rhythmConsistency, shotConsistency
- timing: balanceScore, rhythmConsistency, shotConsistency
- technique: contactHeight, elbowAngle, shoulderRotation, wristSpeed

Raw analyzer formulas used by standardization (from `python_analysis/sports/paddle_backhand.py`):
- `power = (self._normalize(m["ballSpeed"], 35.0, 70.0) * 0.4 + self._normalize(m["wristSpeed"], 15.0, 28.0) * 0.35 + self._normalize(m["shoulderRotation"], 350.0, 750.0) * 0.25) * 100`
- `technique = (self._normalize(m["elbowAngle"], 100.0, 145.0) * 0.3 + self._normalize(m["contactHeight"], 0.6, 1.05) * 0.3 + self._normalize(m["shoulderRotation"], 350.0, 750.0) * 0.2 + self._normalize(m["wristSpeed"], 15.0, 28.0) * 0.2) * 100`
- `timing = (self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.5 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3 + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Backhand Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 18. Paddle - Serve

### Sport Category

- Sport: `Paddle`
- Category: `Serve`
- Config Key: `paddle-serve`
- Source Config: `shared/sport-configs/paddle-serve.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleAngle | Paddle Angle | deg | technique | 15 - 45 |
| ballSpeed | Ball Speed | mph | ball | 30 - 60 |
| placementScore | Placement | /100 | technique | 65 - 98 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = 78 (fallback; no matching aliases)`
- `control = round(clamp(placement, 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp((technique * 1 + placement * 0.4) / 1.4, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: fallback default only
- control: ballSpeed, placementScore, shotConsistency
- timing: balanceScore, paddleAngle, rhythmConsistency
- technique: balanceScore, ballSpeed, paddleAngle, placementScore, rhythmConsistency, shotConsistency

Raw analyzer formulas used by standardization (from `python_analysis/sports/paddle_serve.py`):
- `placement = (self._normalize(m["placementScore"], 65.0, 98.0) * 0.5 + self._normalize(m["ballSpeed"], 30.0, 60.0) * 0.3 + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100`
- `technique = (self._normalize(m["paddleAngle"], 15.0, 45.0) * 0.4 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3 + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3) * 100`
- `timing = (self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.5 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3 + self._normalize(m["paddleAngle"], 15.0, 45.0) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Serve Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 19. Paddle - Smash

### Sport Category

- Sport: `Paddle`
- Category: `Smash`
- Config Key: `paddle-smash`
- Source Config: `shared/sport-configs/paddle-smash.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| wristSpeed | Wrist Speed | m/s | biomechanics | 22 - 38 |
| shoulderRotation | Torso Rotation | deg/s | biomechanics | 500 - 900 |
| jumpHeight | Jump Height | m | power | 0.1 - 0.5 |
| ballSpeed | Ball Speed | mph | ball | 50 - 90 |
| contactHeight | Contact Height | m | technique | 2 - 3 |
| balanceScore | Balance | /100 | biomechanics | 65 - 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 - 92 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp((power * 1 + athleticism * 0.8) / 1.8, 0, 100))`
- `control = 78 (fallback; no matching aliases)`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: balanceScore, ballSpeed, contactHeight, jumpHeight, shoulderRotation, wristSpeed
- control: fallback default only
- timing: balanceScore, contactHeight, rhythmConsistency
- technique: contactHeight, shoulderRotation, wristSpeed

Raw analyzer formulas used by standardization (from `python_analysis/sports/paddle_smash.py`):
- `athleticism = (self._normalize(m["jumpHeight"], 0.1, 0.5) * 0.4 + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.3 + self._normalize(m["contactHeight"], 2.0, 3.0) * 0.3) * 100`
- `power = (self._normalize(m["ballSpeed"], 50.0, 90.0) * 0.4 + self._normalize(m["wristSpeed"], 22.0, 38.0) * 0.35 + self._normalize(m["shoulderRotation"], 500.0, 900.0) * 0.25) * 100`
- `technique = (self._normalize(m["contactHeight"], 2.0, 3.0) * 0.4 + self._normalize(m["shoulderRotation"], 500.0, 900.0) * 0.3 + self._normalize(m["wristSpeed"], 22.0, 38.0) * 0.3) * 100`
- `timing = (self._normalize(m["rhythmConsistency"], 60.0, 92.0) * 0.5 + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.3 + self._normalize(m["contactHeight"], 2.0, 3.0) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Smash Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 20. Paddle - Bandeja

### Sport Category

- Sport: `Paddle`
- Category: `Bandeja`
- Config Key: `paddle-bandeja`
- Source Config: `shared/sport-configs/paddle-bandeja.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleAngle | Paddle Angle | deg | technique | 20 - 50 |
| ballSpeed | Ball Speed | mph | ball | 25 - 55 |
| wristControl | Wrist Control | /100 | technique | 70 - 98 |
| contactHeight | Contact Height | m | technique | 1.8 - 2.8 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = 78 (fallback; no matching aliases)`
- `control = round(clamp(control, 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp((technique * 1 + control * 0.5) / 1.5, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: fallback default only
- control: ballSpeed, paddleAngle, wristControl
- timing: balanceScore, rhythmConsistency, shotConsistency
- technique: ballSpeed, contactHeight, paddleAngle, wristControl

Raw analyzer formulas used by standardization (from `python_analysis/sports/paddle_bandeja.py`):
- `control = (self._normalize(m["wristControl"], 70.0, 98.0) * 0.4 + self._normalize(m["paddleAngle"], 20.0, 50.0) * 0.3 + self._normalize(m["ballSpeed"], 25.0, 55.0) * 0.3) * 100`
- `technique = (self._normalize(m["paddleAngle"], 20.0, 50.0) * 0.3 + self._normalize(m["contactHeight"], 1.8, 2.8) * 0.35 + self._normalize(m["wristControl"], 70.0, 98.0) * 0.35) * 100`
- `timing = (self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.5 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3 + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Bandeja Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 21. Pickleball - Dink

### Sport Category

- Sport: `Pickleball`
- Category: `Dink`
- Config Key: `pickleball-dink`
- Source Config: `shared/sport-configs/pickleball-dink.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleAngle | Paddle Angle | deg | technique | 25 - 50 |
| softTouch | Soft Touch | /100 | technique | 70 - 98 |
| wristStability | Wrist Stability | /100 | biomechanics | 75 - 98 |
| arcHeight | Arc Height | m | ball | 0.05 - 0.3 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(touch, 0, 100))`
- `control = round(clamp(((self._normalize(m["balanceScore"], 50, 98) * 0.6 + self._normalize(m["wristStability"], 50, 98) * 0.4) * 100), 0, 100))`
- `timing = round(clamp(rhythm, 0, 100))`
- `technique = round(clamp((technique * 1 + arc * 0.6) / 1.6, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: paddleAngle, softTouch, wristStability
- control: balanceScore, wristStability
- timing: rhythmConsistency
- technique: arcHeight, paddleAngle, softTouch, wristStability

Raw analyzer formulas used by standardization (from `python_analysis/sports/pickleball_dink.py`):
- `arc = (self._normalize(m["arcHeight"], 0.05, 0.30) * 0.6 + self._normalize(m["softTouch"], 50, 98) * 0.4) * 100`
- `rhythm = self._normalize(m["rhythmConsistency"], 50, 98) * 100`
- `technique = (self._normalize(m["paddleAngle"], 25, 50) * 0.4 + self._normalize(m["wristStability"], 50, 98) * 0.3 + self._normalize(m["softTouch"], 50, 98) * 0.3) * 100`
- `touch = (self._normalize(m["softTouch"], 50, 98) * 0.5 + self._normalize(m["wristStability"], 50, 98) * 0.3 + self._normalize(m["paddleAngle"], 25, 50) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Dink Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 22. Pickleball - Drive

### Sport Category

- Sport: `Pickleball`
- Category: `Drive`
- Config Key: `pickleball-drive`
- Source Config: `shared/sport-configs/pickleball-drive.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleSpeed | Paddle Speed | m/s | power | 15 - 30 |
| bodyRotation | Body Rotation | deg/s | biomechanics | 300 - 700 |
| ballSpeed | Ball Speed | mph | ball | 35 - 65 |
| trajectoryAngle | Trajectory | deg | ball | 2 - 12 |
| balanceScore | Balance | /100 | biomechanics | 65 - 95 |
| shotConsistency | Consistency | /100 | consistency | 65 - 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 - 90 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp((self._normalize(m["balanceScore"], 45, 98) * 100), 0, 100))`
- `timing = round(clamp(rhythm, 0, 100))`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: ballSpeed, bodyRotation, paddleSpeed
- control: balanceScore
- timing: rhythmConsistency
- technique: bodyRotation, paddleSpeed, shotConsistency

Raw analyzer formulas used by standardization (from `python_analysis/sports/pickleball_drive.py`):
- `power = (self._normalize(m["paddleSpeed"], 15, 30) * 0.5 + self._normalize(m["ballSpeed"], 35, 65) * 0.3 + self._normalize(m["bodyRotation"], 300, 700) * 0.2) * 100`
- `rhythm = self._normalize(m["rhythmConsistency"], 50, 98) * 100`
- `technique = (self._normalize(m["bodyRotation"], 300, 700) * 0.4 + self._normalize(m["paddleSpeed"], 15, 30) * 0.3 + self._normalize(m["shotConsistency"], 40, 98) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Drive Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 23. Pickleball - Serve

### Sport Category

- Sport: `Pickleball`
- Category: `Serve`
- Config Key: `pickleball-serve`
- Source Config: `shared/sport-configs/pickleball-serve.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| paddleAngle | Paddle Angle | deg | technique | 20 - 45 |
| tossConsistency | Toss Consistency | /100 | technique | 70 - 98 |
| ballSpeed | Ball Speed | mph | ball | 25 - 50 |
| placement | Placement | /100 | ball | 65 - 95 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp(((self._normalize(m["balanceScore"], 50, 98) * 100) * 0.9 + placement * 0.8) / 1.7, 0, 100))`
- `timing = round(clamp(rhythm, 0, 100))`
- `technique = round(clamp((technique * 1 + placement * 0.4) / 1.4, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: ballSpeed
- control: balanceScore, placement, tossConsistency
- timing: rhythmConsistency
- technique: paddleAngle, placement, rhythmConsistency, tossConsistency

Raw analyzer formulas used by standardization (from `python_analysis/sports/pickleball_serve.py`):
- `placement = (self._normalize(m["placement"], 50, 98) * 0.6 + self._normalize(m["tossConsistency"], 50, 98) * 0.4) * 100`
- `power = self._normalize(m["ballSpeed"], 25, 50) * 100`
- `rhythm = self._normalize(m["rhythmConsistency"], 50, 98) * 100`
- `technique = (self._normalize(m["paddleAngle"], 20, 45) * 0.4 + self._normalize(m["tossConsistency"], 50, 98) * 0.3 + self._normalize(m["rhythmConsistency"], 50, 98) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Serve Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 24. Pickleball - Volley

### Sport Category

- Sport: `Pickleball`
- Category: `Volley`
- Config Key: `pickleball-volley`
- Source Config: `shared/sport-configs/pickleball-volley.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| reactionSpeed | Reaction Speed | ms | timing | 120 - 300 |
| paddlePrep | Paddle Prep | /100 | technique | 70 - 98 |
| wristFirmness | Wrist Firmness | /100 | technique | 75 - 98 |
| balanceScore | Balance | /100 | biomechanics | 65 - 95 |
| ballSpeed | Ball Speed | mph | ball | 20 - 50 |
| shotConsistency | Consistency | /100 | consistency | 65 - 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 - 90 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp((((self._normalize(m["balanceScore"], 40, 98) * 0.6 + self._normalize(m["wristFirmness"], 50, 98) * 0.4) * 100) * 0.9 + reflexes * 0.5) / 1.4, 0, 100))`
- `timing = round(clamp((rhythm * 0.8 + reflexes * 0.5) / 1.3, 0, 100))`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: ballSpeed, paddlePrep
- control: balanceScore, paddlePrep, reactionSpeed, wristFirmness
- timing: paddlePrep, reactionSpeed, rhythmConsistency
- technique: paddlePrep, shotConsistency, wristFirmness

Raw analyzer formulas used by standardization (from `python_analysis/sports/pickleball_volley.py`):
- `power = (self._normalize(m["ballSpeed"], 20, 50) * 0.7 + self._normalize(m["paddlePrep"], 50, 98) * 0.3) * 100`
- `reflexes = (self._normalize(500 - m["reactionSpeed"], 0, 400) * 0.6 + self._normalize(m["paddlePrep"], 50, 98) * 0.4) * 100`
- `rhythm = self._normalize(m["rhythmConsistency"], 50, 98) * 100`
- `technique = (self._normalize(m["paddlePrep"], 50, 98) * 0.4 + self._normalize(m["wristFirmness"], 50, 98) * 0.3 + self._normalize(m["shotConsistency"], 40, 98) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Volley Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 25. Pickleball - Third Shot Drop

### Sport Category

- Sport: `Pickleball`
- Category: `Third Shot Drop`
- Config Key: `pickleball-third-shot-drop`
- Source Config: `shared/sport-configs/pickleball-third-shot-drop.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| arcHeight | Arc Height | m | ball | 0.1 - 0.4 |
| softTouch | Soft Touch | /100 | technique | 70 - 98 |
| paddleAngle | Paddle Angle | deg | technique | 30 - 55 |
| shotConsistency | Consistency | /100 | consistency | 65 - 95 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(touch, 0, 100))`
- `control = round(clamp((self._normalize(m["balanceScore"], 50, 98) * 100), 0, 100))`
- `timing = round(clamp(rhythm, 0, 100))`
- `technique = round(clamp((technique * 1 + arc * 0.6) / 1.6, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: arcHeight, paddleAngle, softTouch
- control: balanceScore
- timing: rhythmConsistency
- technique: arcHeight, paddleAngle, shotConsistency, softTouch

Raw analyzer formulas used by standardization (from `python_analysis/sports/pickleball_third_shot_drop.py`):
- `arc = (self._normalize(m["arcHeight"], 0.10, 0.40) * 0.6 + self._normalize(m["softTouch"], 50, 98) * 0.4) * 100`
- `rhythm = self._normalize(m["rhythmConsistency"], 50, 98) * 100`
- `technique = (self._normalize(m["paddleAngle"], 30, 55) * 0.4 + self._normalize(m["softTouch"], 50, 98) * 0.3 + self._normalize(m["shotConsistency"], 40, 98) * 0.3) * 100`
- `touch = (self._normalize(m["softTouch"], 50, 98) * 0.5 + self._normalize(m["paddleAngle"], 30, 55) * 0.3 + self._normalize(m["arcHeight"], 0.10, 0.40) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Third Shot Drop Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 26. Table Tennis - Forehand

### Sport Category

- Sport: `Table Tennis`
- Category: `Forehand`
- Config Key: `tabletennis-forehand`
- Source Config: `shared/sport-configs/tabletennis-forehand.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| batSpeed | Bat Speed | m/s | power | 8 - 18 |
| wristAction | Wrist Action | deg/s | technique | 300 - 700 |
| spinRate | Spin Rate | rpm | ball | 2000 - 5000 |
| footworkScore | Footwork | /100 | biomechanics | 65 - 95 |
| bodyRotation | Body Rotation | deg/s | biomechanics | 200 - 500 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = 78 (fallback; no matching aliases)`
- `timing = 78 (fallback; no matching aliases)`
- `technique = round(clamp((technique * 1 + spin * 0.6 + footwork * 0.6) / 2.2, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: batSpeed, bodyRotation, wristAction
- control: fallback default only
- timing: fallback default only
- technique: bodyRotation, footworkScore, rhythmConsistency, spinRate, wristAction

Raw analyzer formulas used by standardization (from `python_analysis/sports/tabletennis_forehand.py`):
- `footwork = (self._normalize(m["footworkScore"], 65.0, 95.0) * 0.7 + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3) * 100`
- `power = (self._normalize(m["batSpeed"], 8.0, 18.0) * 0.5 + self._normalize(m["bodyRotation"], 200.0, 500.0) * 0.3 + self._normalize(m["wristAction"], 300.0, 700.0) * 0.2) * 100`
- `spin = (self._normalize(m["spinRate"], 2000.0, 5000.0) * 0.6 + self._normalize(m["wristAction"], 300.0, 700.0) * 0.4) * 100`
- `technique = (self._normalize(m["wristAction"], 300.0, 700.0) * 0.4 + self._normalize(m["bodyRotation"], 200.0, 500.0) * 0.3 + self._normalize(m["footworkScore"], 65.0, 95.0) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Forehand Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 27. Table Tennis - Backhand

### Sport Category

- Sport: `Table Tennis`
- Category: `Backhand`
- Config Key: `tabletennis-backhand`
- Source Config: `shared/sport-configs/tabletennis-backhand.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| batSpeed | Bat Speed | m/s | power | 6 - 15 |
| timingScore | Timing | /100 | timing | 70 - 98 |
| batAngle | Bat Angle | deg | technique | 30 - 70 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(speed, 0, 100))`
- `control = round(clamp(((self._normalize(m["balanceScore"], 70.0, 98.0) * 0.6 + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.4) * 100), 0, 100))`
- `timing = round(clamp(timing, 0, 100))`
- `technique = round(clamp(technique, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: batSpeed, rhythmConsistency
- control: balanceScore, shotConsistency
- timing: rhythmConsistency, timingScore
- technique: balanceScore, batAngle, batSpeed

Raw analyzer formulas used by standardization (from `python_analysis/sports/tabletennis_backhand.py`):
- `speed = (self._normalize(m["batSpeed"], 6.0, 15.0) * 0.7 + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3) * 100`
- `technique = (self._normalize(m["batAngle"], 30.0, 70.0) * 0.5 + self._normalize(m["batSpeed"], 6.0, 15.0) * 0.3 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.2) * 100`
- `timing = (self._normalize(m["timingScore"], 70.0, 98.0) * 0.6 + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Backhand Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 28. Table Tennis - Serve

### Sport Category

- Sport: `Table Tennis`
- Category: `Serve`
- Config Key: `tabletennis-serve`
- Source Config: `shared/sport-configs/tabletennis-serve.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| spinVariation | Spin Variation | rpm | ball | 1500 - 4500 |
| batAngle | Bat Angle | deg | technique | 20 - 65 |
| ballSpeed | Ball Speed | mph | ball | 15 - 40 |
| tossHeight | Toss Height | cm | technique | 16 - 30 |
| placementScore | Placement | /100 | technique | 65 - 95 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = 78 (fallback; no matching aliases)`
- `control = round(clamp((placement * 0.8 + deception * 0.6) / 1.4, 0, 100))`
- `timing = 78 (fallback; no matching aliases)`
- `technique = round(clamp((technique * 1 + spin * 0.6 + placement * 0.4 + deception * 0.5) / 2.5, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: fallback default only
- control: ballSpeed, batAngle, placementScore, rhythmConsistency, spinVariation
- timing: fallback default only
- technique: ballSpeed, batAngle, placementScore, rhythmConsistency, spinVariation, tossHeight

Raw analyzer formulas used by standardization (from `python_analysis/sports/tabletennis_serve.py`):
- `deception = (self._normalize(m["spinVariation"], 1500.0, 4500.0) * 0.5 + self._normalize(m["batAngle"], 20.0, 65.0) * 0.3 + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.2) * 100`
- `placement = (self._normalize(m["placementScore"], 65.0, 95.0) * 0.6 + self._normalize(m["ballSpeed"], 15.0, 40.0) * 0.4) * 100`
- `spin = (self._normalize(m["spinVariation"], 1500.0, 4500.0) * 0.6 + self._normalize(m["batAngle"], 20.0, 65.0) * 0.4) * 100`
- `technique = (self._normalize(m["batAngle"], 20.0, 65.0) * 0.4 + self._normalize(m["tossHeight"], 16.0, 30.0) * 0.3 + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Serve Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 29. Table Tennis - Loop

### Sport Category

- Sport: `Table Tennis`
- Category: `Loop`
- Config Key: `tabletennis-loop`
- Source Config: `shared/sport-configs/tabletennis-loop.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| batSpeed | Bat Speed | m/s | power | 10 - 22 |
| bodyRotation | Body Rotation | deg/s | biomechanics | 250 - 600 |
| spinRate | Spin Rate | rpm | ball | 3000 - 6000 |
| contactPoint | Contact Point | /100 | technique | 65 - 95 |
| balanceScore | Balance | /100 | biomechanics | 65 - 95 |
| rhythmConsistency | Rhythm | /100 | timing | 60 - 92 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = round(clamp(power, 0, 100))`
- `control = round(clamp(((self._normalize(m["balanceScore"], 65.0, 95.0) * 0.6 + self._normalize(m["rhythmConsistency"], 60.0, 92.0) * 0.4) * 100), 0, 100))`
- `timing = 78 (fallback; no matching aliases)`
- `technique = round(clamp((technique * 1 + spin * 0.6) / 1.6, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: batSpeed, bodyRotation, spinRate
- control: balanceScore, rhythmConsistency
- timing: fallback default only
- technique: balanceScore, batSpeed, bodyRotation, contactPoint, spinRate

Raw analyzer formulas used by standardization (from `python_analysis/sports/tabletennis_loop.py`):
- `power = (self._normalize(m["batSpeed"], 10.0, 22.0) * 0.5 + self._normalize(m["bodyRotation"], 250.0, 600.0) * 0.3 + self._normalize(m["spinRate"], 3000.0, 6000.0) * 0.2) * 100`
- `spin = (self._normalize(m["spinRate"], 3000.0, 6000.0) * 0.6 + self._normalize(m["batSpeed"], 10.0, 22.0) * 0.4) * 100`
- `technique = (self._normalize(m["contactPoint"], 65.0, 95.0) * 0.4 + self._normalize(m["bodyRotation"], 250.0, 600.0) * 0.3 + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.3) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Loop Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

## 30. Table Tennis - Chop

### Sport Category

- Sport: `Table Tennis`
- Category: `Chop`
- Config Key: `tabletennis-chop`
- Source Config: `shared/sport-configs/tabletennis-chop.ts`

### Metrics Table

| Key | Label | Unit | Category | Optimal Range |
|-----|-------|------|----------|---------------|
| batAngle | Bat Angle | deg | technique | 40 - 75 |
| shotConsistency | Consistency | /100 | consistency | 70 - 98 |
| spinRate | Spin Rate | rpm | ball | 1500 - 4000 |
| balanceScore | Balance | /100 | biomechanics | 70 - 98 |
| footworkScore | Footwork | /100 | biomechanics | 65 - 95 |
| rhythmConsistency | Rhythm | /100 | timing | 65 - 95 |

### Scores (Ordered)

#### Technical

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Balance | `score10(0.8*norm(balanceScore,55,98) + 0.2*invNorm(reactionTime,180,480))` | balanceScore, reactionTime |
| Inertia | `score10(0.6*norm(stanceAngle,15,65) + 0.4*norm(shoulderRotationSpeed,300,1100))` | shoulderRotationSpeed, stanceAngle |
| Opposite Force | `score10(0.4*norm(kneeBendAngle,25,120) + 0.35*norm(balanceScore,55,98) + 0.25*norm(stanceAngle,15,65))` | balanceScore, kneeBendAngle, stanceAngle |
| Momentum | `score10(0.45*norm(hipRotationSpeed,250,1100) + 0.35*norm(shoulderRotationSpeed,300,1200) + 0.2*norm(ballSpeed,35,140))` | ballSpeed, hipRotationSpeed, shoulderRotationSpeed |
| Elastic Energy | `score10(0.6*norm(racketLagAngle,15,75) + 0.2*norm(kneeBendAngle,25,120) + 0.2*norm(swingPathAngle,5,45))` | kneeBendAngle, racketLagAngle, swingPathAngle |
| Contact | `score10(0.45*norm(contactDistance,0.35,1.15) + 0.35*norm(contactHeight,0.75,2.9) + 0.2*invNorm(reactionTime,180,480))` | contactDistance, contactHeight, reactionTime |

- `technicalScore = mean([Balance, Inertia, Opposite Force, Momentum, Elastic Energy, Contact])`

#### Tactical

| Sub-Score | Label | Weight |
|-----------|-------|--------|
| power | Power | 30% |
| control | Control | 25% |
| timing | Timing | 25% |
| technique | Technique | 20% |

**Standard Tactical Formula**
`tacticalScore = 0.30 × power + 0.25 × control + 0.25 × timing + 0.20 × technique`

Exact standardized tactical sub-score formulas (`0-100`):
- `power = 78 (fallback; no matching aliases)`
- `control = round(clamp(((self._normalize(m["balanceScore"], 70.0, 98.0) * 0.6 + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100), 0, 100))`
- `timing = 78 (fallback; no matching aliases)`
- `technique = round(clamp((technique * 1 + spin * 0.6 + footwork * 0.6) / 2.2, 0, 100))`

Underlying parameters influencing each tactical sub-score:
- power: fallback default only
- control: balanceScore, rhythmConsistency
- timing: fallback default only
- technique: balanceScore, batAngle, footworkScore, spinRate

Raw analyzer formulas used by standardization (from `python_analysis/sports/tabletennis_chop.py`):
- `footwork = (self._normalize(m["footworkScore"], 65.0, 95.0) * 0.7 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3) * 100`
- `spin = (self._normalize(m["spinRate"], 1500.0, 4000.0) * 0.6 + self._normalize(m["batAngle"], 40.0, 75.0) * 0.4) * 100`
- `technique = (self._normalize(m["batAngle"], 40.0, 75.0) * 0.5 + self._normalize(m["spinRate"], 1500.0, 4000.0) * 0.3 + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.2) * 100`

Note: `consistency` is excluded from standardized tactical sub-scores.

#### Movement

| Score | Formula | Underlying Parameters |
|-------|---------|------------------------|
| Ready | `score10(0.6*invNorm(splitStepTime,0.12,0.45) + 0.4*norm(balanceScore,55,98))` | balanceScore, splitStepTime |
| Read | `score10(0.55*invNorm(reactionTime,180,480) + 0.45*invNorm(splitStepTime,0.12,0.45))` | reactionTime, splitStepTime |
| React | `score10(0.7*invNorm(reactionTime,170,500) + 0.3*norm(balanceScore,55,98))` | balanceScore, reactionTime |
| Respond | `score10(0.45*norm(ballSpeed,35,140) + 0.3*norm(contactHeight,0.75,2.9) + 0.25*norm(swingPathAngle,8,55))` | ballSpeed, contactHeight, swingPathAngle |
| Recover | `score10(0.65*invNorm(recoveryTime,0.6,3.2) + 0.35*norm(balanceScore,55,98))` | balanceScore, recoveryTime |

- `movementScore = mean([Ready, Read, React, Respond, Recover])`

### Overall Score

- Score Label: `Chop Score`
- `overallScore = (technicalScore + tacticalScore + movementScore) / 3`

---

> Maintenance: regenerate this document via `node scripts/update_reference_matrix_standardized.js` whenever configs or scoring logic change.
