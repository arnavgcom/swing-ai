import React, { useEffect, useMemo, useRef, useState } from "react";
import { G, Line, Path, Polygon, Text as SvgText } from "react-native-svg";
import type { CorrectionResult, Landmark } from "@/lib/ghost-correction";

const ORANGE = "#F59E0B";
const STROKE_WIDTH = 3;
const HEAD_SIZE = 8;

type Direction = "up" | "down" | "left" | "right";

type Point = { x: number; y: number };

interface ArrowRenderInput {
  startPoint: Point;
  direction: Direction;
  length?: number;
  color?: string;
}

interface CurvedArrowInput {
  center: Point;
  radius: number;
  clockwise: boolean;
  color?: string;
}

interface CorrectionArrowRendererProps {
  correction: CorrectionResult;
  landmarks: Landmark[];
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getLandmarkPoint(
  landmarkMap: Map<number, Landmark>,
  id: number,
  width: number,
  height: number,
): Point | null {
  const lm = landmarkMap.get(id);
  if (!lm || lm.visibility < 0.3) return null;
  return { x: lm.x * width, y: lm.y * height };
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function average(points: Point[]): Point | null {
  if (!points.length) return null;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

function useOscillation(active: boolean): number {
  const [phase, setPhase] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const t = (elapsed % 1600) / 1600;
      setPhase(t * Math.PI * 2);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return phase;
}

function directionVector(direction: Direction): Point {
  if (direction === "up") return { x: 0, y: -1 };
  if (direction === "down") return { x: 0, y: 1 };
  if (direction === "left") return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

/**
 * Draw a straight correction arrow (shaft + head) from a start point.
 */
export function renderArrow({
  startPoint,
  direction,
  length = 34,
  color = ORANGE,
}: ArrowRenderInput): React.ReactElement {
  const v = directionVector(direction);
  const end = {
    x: startPoint.x + v.x * length,
    y: startPoint.y + v.y * length,
  };

  const left = {
    x: end.x - v.x * HEAD_SIZE + v.y * (HEAD_SIZE * 0.7),
    y: end.y - v.y * HEAD_SIZE - v.x * (HEAD_SIZE * 0.7),
  };
  const right = {
    x: end.x - v.x * HEAD_SIZE - v.y * (HEAD_SIZE * 0.7),
    y: end.y - v.y * HEAD_SIZE + v.x * (HEAD_SIZE * 0.7),
  };

  return (
    <G>
      <Line
        x1={startPoint.x}
        y1={startPoint.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      <Polygon
        points={`${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`}
        fill={color}
      />
    </G>
  );
}

function renderCurvedArrow({
  center,
  radius,
  clockwise,
  color = ORANGE,
}: CurvedArrowInput): React.ReactElement {
  const startAngle = clockwise ? (-160 * Math.PI) / 180 : (-20 * Math.PI) / 180;
  const endAngle = clockwise ? (20 * Math.PI) / 180 : (-200 * Math.PI) / 180;

  const start = {
    x: center.x + Math.cos(startAngle) * radius,
    y: center.y + Math.sin(startAngle) * radius,
  };
  const end = {
    x: center.x + Math.cos(endAngle) * radius,
    y: center.y + Math.sin(endAngle) * radius,
  };

  const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 ${clockwise ? 1 : 0} ${end.x} ${end.y}`;

  const tangent = {
    x: clockwise ? Math.sin(endAngle) : -Math.sin(endAngle),
    y: clockwise ? -Math.cos(endAngle) : Math.cos(endAngle),
  };

  const headTip = end;
  const headLeft = {
    x: headTip.x - tangent.x * HEAD_SIZE + tangent.y * (HEAD_SIZE * 0.7),
    y: headTip.y - tangent.y * HEAD_SIZE - tangent.x * (HEAD_SIZE * 0.7),
  };
  const headRight = {
    x: headTip.x - tangent.x * HEAD_SIZE - tangent.y * (HEAD_SIZE * 0.7),
    y: headTip.y - tangent.y * HEAD_SIZE + tangent.x * (HEAD_SIZE * 0.7),
  };

  return (
    <G>
      <Path d={arcPath} stroke={color} strokeWidth={STROKE_WIDTH} fill="none" strokeLinecap="round" />
      <Polygon
        points={`${headTip.x},${headTip.y} ${headLeft.x},${headLeft.y} ${headRight.x},${headRight.y}`}
        fill={color}
      />
    </G>
  );
}

function getCorrectionAnchor(
  correction: CorrectionResult,
  landmarkMap: Map<number, Landmark>,
  width: number,
  height: number,
): Point | null {
  const key = correction.metricKey.toLowerCase().replace(/_/g, "");

  const leftShoulder = getLandmarkPoint(landmarkMap, 11, width, height);
  const rightShoulder = getLandmarkPoint(landmarkMap, 12, width, height);
  const leftHip = getLandmarkPoint(landmarkMap, 23, width, height);
  const rightHip = getLandmarkPoint(landmarkMap, 24, width, height);
  const leftKnee = getLandmarkPoint(landmarkMap, 25, width, height);
  const rightKnee = getLandmarkPoint(landmarkMap, 26, width, height);
  const leftWrist = getLandmarkPoint(landmarkMap, 15, width, height);
  const rightWrist = getLandmarkPoint(landmarkMap, 16, width, height);

  if (key.includes("shoulder") && key.includes("rotation") && leftShoulder && rightShoulder) {
    const center = midpoint(leftShoulder, rightShoulder);
    return { x: center.x, y: center.y - 18 };
  }

  if (key.includes("hip") && key.includes("rotation") && leftHip && rightHip) {
    const center = midpoint(leftHip, rightHip);
    return { x: center.x, y: center.y - 14 };
  }

  if (key.includes("knee") && (key.includes("bend") || key.includes("angle"))) {
    const knees = [leftKnee, rightKnee].filter(Boolean) as Point[];
    const center = average(knees);
    if (center) return { x: center.x, y: center.y - 8 };
  }

  if (key.includes("contact") || key.includes("wrist")) {
    const wrists = [leftWrist, rightWrist].filter(Boolean) as Point[];
    const center = average(wrists);
    if (center) return { x: center.x - 22, y: center.y };
  }

  const fallbackPoints: Point[] = correction.jointIndices
    .map((id) => getLandmarkPoint(landmarkMap, id, width, height))
    .filter(Boolean) as Point[];
  return average(fallbackPoints);
}

interface ResolvedArrow {
  kind: "curved" | "straight";
  direction: Direction;
  clockwise?: boolean;
  label: string;
}

function resolveArrowForCorrection(correction: CorrectionResult): ResolvedArrow {
  const key = correction.metricKey.toLowerCase().replace(/_/g, "");

  if (key.includes("shoulder") && key.includes("rotation")) {
    return {
      kind: "curved",
      direction: "right",
      clockwise: correction.direction === "increase",
      label: correction.recommendation || "Rotate shoulders more",
    };
  }

  if (key.includes("hip") && key.includes("rotation")) {
    return {
      kind: "curved",
      direction: "right",
      clockwise: correction.direction === "increase",
      label: correction.recommendation || "Rotate hips through",
    };
  }

  if (key.includes("knee") && (key.includes("bend") || key.includes("angle"))) {
    return {
      kind: "straight",
      direction: "down",
      label: correction.recommendation || "Bend knees more",
    };
  }

  if (key.includes("contact") || key.includes("wrist")) {
    return {
      kind: "straight",
      direction: "right",
      label: correction.recommendation || "Move contact forward",
    };
  }

  if (correction.correctionType === "rotation") {
    return {
      kind: "curved",
      direction: "right",
      clockwise: correction.direction === "increase",
      label: correction.recommendation || "Increase rotation",
    };
  }

  if (correction.correctionType === "angle") {
    return {
      kind: "straight",
      direction: "down",
      label: correction.recommendation || "Adjust angle",
    };
  }

  return {
    kind: "straight",
    direction: "right",
    label: correction.recommendation || "Adjust position",
  };
}

/**
 * Render one correction arrow (curved or straight) from correction metadata and
 * joint coordinates.
 */
export function renderCorrectionArrow(
  correction: CorrectionResult,
  anchor: Point,
): React.ReactElement {
  const resolved = resolveArrowForCorrection(correction);
  if (resolved.kind === "curved") {
    return renderCurvedArrow({
      center: anchor,
      radius: 22,
      clockwise: !!resolved.clockwise,
      color: ORANGE,
    });
  }
  return renderArrow({
    startPoint: anchor,
    direction: resolved.direction,
    length: 36,
    color: ORANGE,
  });
}

export function CorrectionArrowRenderer({
  correction,
  landmarks,
  width,
  height,
}: CorrectionArrowRendererProps) {
  const landmarkMap = useMemo(() => {
    const map = new Map<number, Landmark>();
    for (const lm of landmarks) {
      map.set(lm.id, lm);
    }
    return map;
  }, [landmarks]);

  const baseAnchor = useMemo(
    () => getCorrectionAnchor(correction, landmarkMap, width, height),
    [correction, landmarkMap, width, height],
  );

  const resolved = useMemo(() => resolveArrowForCorrection(correction), [correction]);

  const phase = useOscillation(true);
  const dx = Math.sin(phase) * 2.5;
  const dy = Math.cos(phase) * 1.5;

  if (!baseAnchor) return null;

  const anchor = {
    x: clamp(baseAnchor.x + dx, 18, width - 18),
    y: clamp(baseAnchor.y + dy, 18, height - 18),
  };

  const labelX = clamp(anchor.x + 10, 10, width - 110);
  const labelY = clamp(anchor.y - 18, 16, height - 10);

  return (
    <G>
      {renderCorrectionArrow(correction, anchor)}
      <SvgText
        x={labelX}
        y={labelY}
        fill="#FFFFFF"
        fontSize={12}
        fontFamily="sans-serif"
      >
        {resolved.label}
      </SvgText>
    </G>
  );
}
