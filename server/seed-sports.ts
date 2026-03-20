import { db } from "./db";
import { sports, sportMovements } from "@shared/schema";
import { eq } from "drizzle-orm";
import { buildInsertAuditFields } from "./audit-metadata";

const SPORTS_DATA = [
  {
    name: "Tennis",
    icon: "tennisball-outline",
    color: "#10B981",
    description: "Analyze your tennis strokes with AI-powered biomechanics",
    sortOrder: 1,
    movements: [
      { name: "Forehand", description: "Forward stroke on dominant side", icon: "arrow-forward-circle-outline", sortOrder: 1 },
      { name: "Backhand", description: "Stroke on non-dominant side", icon: "arrow-back-circle-outline", sortOrder: 2 },
      { name: "Serve", description: "Overhead serving motion", icon: "arrow-up-circle-outline", sortOrder: 3 },
      { name: "Volley", description: "Net play and quick exchanges", icon: "flash-outline", sortOrder: 4 },
      { name: "Game", description: "Full match play analysis", icon: "trophy-outline", sortOrder: 5 },
    ],
  },
  {
    name: "Golf",
    icon: "golf-outline",
    color: "#22D3EE",
    description: "Perfect your swing with precision motion analysis",
    sortOrder: 2,
    movements: [
      { name: "Drive", description: "Long-distance tee shot", icon: "rocket-outline", sortOrder: 1 },
      { name: "Iron Shot", description: "Mid-range approach shots", icon: "navigate-outline", sortOrder: 2 },
      { name: "Chip", description: "Short game around the green", icon: "trending-up-outline", sortOrder: 3 },
      { name: "Putt", description: "Putting technique on the green", icon: "radio-button-on-outline", sortOrder: 4 },
      { name: "Full Swing", description: "Complete swing mechanics", icon: "sync-outline", sortOrder: 5 },
    ],
  },
  {
    name: "Pickleball",
    icon: "ellipse-outline",
    color: "#F59E0B",
    description: "Sharpen your pickleball technique with smart analysis",
    sortOrder: 3,
    movements: [
      { name: "Dink", description: "Soft shot near the kitchen line", icon: "water-outline", sortOrder: 1 },
      { name: "Drive", description: "Hard flat offensive shot", icon: "arrow-forward-outline", sortOrder: 2 },
      { name: "Serve", description: "Underhand serve technique", icon: "arrow-up-outline", sortOrder: 3 },
      { name: "Volley", description: "Quick net exchanges", icon: "flash-outline", sortOrder: 4 },
      { name: "Third Shot Drop", description: "Transition shot to the kitchen", icon: "trending-down-outline", sortOrder: 5 },
    ],
  },
  {
    name: "Paddle",
    icon: "tablet-landscape-outline",
    color: "#8B5CF6",
    description: "Elevate your padel game with movement insights",
    sortOrder: 4,
    movements: [
      { name: "Forehand", description: "Dominant side wall play", icon: "arrow-forward-circle-outline", sortOrder: 1 },
      { name: "Backhand", description: "Non-dominant side strokes", icon: "arrow-back-circle-outline", sortOrder: 2 },
      { name: "Serve", description: "Underhand serve technique", icon: "arrow-up-outline", sortOrder: 3 },
      { name: "Smash", description: "Overhead power shot", icon: "flash-outline", sortOrder: 4 },
      { name: "Bandeja", description: "Defensive overhead slice", icon: "umbrella-outline", sortOrder: 5 },
    ],
  },
  {
    name: "Badminton",
    icon: "fitness-outline",
    color: "#EF4444",
    description: "Optimize your badminton strokes and footwork",
    sortOrder: 5,
    movements: [
      { name: "Clear", description: "High deep shot to the baseline", icon: "arrow-up-circle-outline", sortOrder: 1 },
      { name: "Smash", description: "Powerful overhead attack", icon: "flash-outline", sortOrder: 2 },
      { name: "Drop", description: "Soft shot just over the net", icon: "trending-down-outline", sortOrder: 3 },
      { name: "Net Shot", description: "Delicate play at the net", icon: "git-network-outline", sortOrder: 4 },
      { name: "Serve", description: "Short or long serve technique", icon: "arrow-up-outline", sortOrder: 5 },
    ],
  },
  {
    name: "Table Tennis",
    icon: "radio-button-off-outline",
    color: "#3B82F6",
    description: "Analyze your table tennis technique at high speed",
    sortOrder: 6,
    movements: [
      { name: "Forehand", description: "Dominant side topspin drive", icon: "arrow-forward-circle-outline", sortOrder: 1 },
      { name: "Backhand", description: "Quick backhand flick or drive", icon: "arrow-back-circle-outline", sortOrder: 2 },
      { name: "Serve", description: "Spin serve techniques", icon: "arrow-up-outline", sortOrder: 3 },
      { name: "Loop", description: "Heavy topspin attack", icon: "sync-outline", sortOrder: 4 },
      { name: "Chop", description: "Defensive backspin return", icon: "cut-outline", sortOrder: 5 },
    ],
  },
];

export async function seedSports() {
  const existingSports = await db.select().from(sports);
  if (existingSports.length > 0) {
    return;
  }

  console.log("Seeding sports and movements...");

  for (const sportData of SPORTS_DATA) {
    const [sport] = await db
      .insert(sports)
      .values({
        name: sportData.name,
        icon: sportData.icon,
        color: sportData.color,
        description: sportData.description,
        sortOrder: sportData.sortOrder,
        ...buildInsertAuditFields(),
      })
      .returning();

    for (const movement of sportData.movements) {
      await db.insert(sportMovements).values({
        sportId: sport.id,
        name: movement.name,
        description: movement.description,
        icon: movement.icon,
        sortOrder: movement.sortOrder,
        ...buildInsertAuditFields(),
      });
    }
  }

  console.log("Sports and movements seeded successfully");
}
