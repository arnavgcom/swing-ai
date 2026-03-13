const { Client } = require("pg");

const DEFAULT_FILENAME = "E4F8624F-B1FC-409D-8DE6-D05250AA5B88.mp4";
const DEFAULT_LIMIT = 10;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("NO_DATABASE_URL");
    process.exit(2);
  }

  const filename = process.env.VIDEO_FILENAME || DEFAULT_FILENAME;
  const includeConfusionPairs = process.env.INCLUDE_CONFUSION_PAIRS === "1";
  const limit = Number(process.env.ROW_LIMIT || DEFAULT_LIMIT);

  const client = new Client({ connectionString });

  const discrepancyCols = includeConfusionPairs
    ? "d.mismatches,d.mismatch_rate_pct,d.auto_shots,d.manual_shots,d.confusion_pairs"
    : "d.mismatches,d.mismatch_rate_pct,d.auto_shots,d.manual_shots";

  const query = `
    with target as (
      select a.id, a.video_filename, a.detected_movement, a.created_at
      from analyses a
      where a.video_filename = $1
      order by a.created_at desc
      limit $2
    )
    select
      t.id,
      t.video_filename,
      t.detected_movement,
      t.created_at,
      ann.user_id,
      ann.ordered_shot_labels,
      ann.updated_at as ann_updated,
      ${discrepancyCols}
    from target t
    left join analysis_shot_annotations ann on ann.analysis_id = t.id
    left join analysis_shot_discrepancies d on d.analysis_id = t.id and d.user_id = ann.user_id
    order by t.created_at desc;
  `;

  console.time("db:connect");
  await client.connect();
  console.timeEnd("db:connect");

  console.time("db:query");
  const result = await client.query(query, [filename, limit]);
  console.timeEnd("db:query");

  console.time("json:print");
  console.log(
    JSON.stringify(
      {
        filename,
        limit,
        includeConfusionPairs,
        rows: result.rows,
      },
      null,
      2,
    ),
  );
  console.timeEnd("json:print");

  await client.end();
}

main().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});
