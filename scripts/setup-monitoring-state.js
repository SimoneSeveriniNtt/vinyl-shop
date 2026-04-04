const { Client } = require("pg");

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL missing");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(`
      create table if not exists public.monitoring_state (
        id text primary key,
        is_running boolean not null default false,
        started_at timestamptz null,
        heartbeat_at timestamptz null,
        finished_at timestamptz null,
        last_message text null,
        last_new_alerts integer null,
        monitored_count integer null,
        total_count integer null,
        processed_count integer null,
        last_duration_ms integer null,
        updated_at timestamptz not null default now()
      )
    `);

    await client.query("alter table public.monitoring_state add column if not exists total_count integer null");
    await client.query("alter table public.monitoring_state add column if not exists processed_count integer null");
    await client.query("alter table public.monitoring_state add column if not exists last_duration_ms integer null");

    await client.query(`
      insert into public.monitoring_state (id, is_running, updated_at)
      values ('album_monitor_manual', false, now())
      on conflict (id) do nothing
    `);

    console.log("SETUP_MONITORING_STATE_OK");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("SETUP_MONITORING_STATE_ERR", err.message);
  process.exit(1);
});
