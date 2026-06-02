import postgres from "postgres";

function createClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return postgres(process.env.DATABASE_URL, {
    ssl: "require",
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10
  });
}

export function getDb() {
  if (!globalThis.marathonSkillsDb) {
    globalThis.marathonSkillsDb = createClient();
  }
  return globalThis.marathonSkillsDb;
}
