import { mkdirSync } from 'fs'
import path from 'path'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

const dataDir = path.resolve(process.cwd(), '..', 'data')
mkdirSync(dataDir, { recursive: true })

const sqlite = new Database(path.join(dataDir, 'agentsyncboard.db'), { create: true })
sqlite.run('PRAGMA journal_mode = WAL')
sqlite.run('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

function shouldMigrateJobTypes(tableName: 'jobs' | 'job_type_mandates'): boolean {
  const row = sqlite
    .query<{ sql: string | null }, [string]>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName)

  const sql = row?.sql ?? ''
  // Migrate if the schema still lists removed types, or if jobs is missing 'approved' status
  if (tableName === 'jobs') {
    return sql.includes("'analysis'") || sql.includes("'arch'") || !sql.includes("'approved'")
  }
  return sql.includes("'analysis'") || sql.includes("'arch'")
}

function rebuildJobsTable(): void {
  sqlite.run('PRAGMA foreign_keys = OFF')
  sqlite.run('PRAGMA legacy_alter_table = ON')
  sqlite.run('BEGIN')

  try {
    sqlite.run('ALTER TABLE jobs RENAME TO jobs_old')
    sqlite.run(`
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        ref_num INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('impl','plan','review','goal','convo')),
        title TEXT NOT NULL,
        description TEXT,
        repo_id TEXT REFERENCES repos(id),
        branch_name TEXT,
        base_branch TEXT,
        parent_job_id TEXT,
        folder_id TEXT REFERENCES folders(id),
        status TEXT NOT NULL DEFAULT 'open'
          CHECK(status IN ('open','in-progress','blocked','in-review','approved','done')),
        agent_id TEXT,
        auto_merge INTEGER NOT NULL DEFAULT 0,
        require_review INTEGER NOT NULL DEFAULT 1,
        plan TEXT,
        latest_update TEXT,
        artifact TEXT,
        scratchpad TEXT,
        handoff_summary TEXT,
        blocked_reason TEXT,
        conflicted_at TEXT,
        conflict_details TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    sqlite.run(`
      INSERT INTO jobs (
        id, ref_num, type, title, description, repo_id, branch_name, base_branch,
        parent_job_id, folder_id, status, agent_id, auto_merge, require_review,
        plan, latest_update, artifact, scratchpad, handoff_summary, blocked_reason,
        conflicted_at, conflict_details, completed_at, created_at, updated_at
      )
      SELECT
        id, ref_num,
        CASE WHEN type IN ('analysis','arch') THEN 'plan' ELSE type END,
        title, description, repo_id, branch_name, base_branch,
        parent_job_id, folder_id, status, agent_id, auto_merge, require_review,
        plan, latest_update, artifact, scratchpad, handoff_summary, blocked_reason,
        conflicted_at, conflict_details, completed_at, created_at, updated_at
      FROM jobs_old
    `)
    sqlite.run('DROP TABLE jobs_old')
    sqlite.run('COMMIT')
  } catch (error) {
    sqlite.run('ROLLBACK')
    throw error
  } finally {
    sqlite.run('PRAGMA legacy_alter_table = OFF')
    sqlite.run('PRAGMA foreign_keys = ON')
  }
}

function rebuildJobTypeMandatesTable(): void {
  sqlite.run('PRAGMA foreign_keys = OFF')
  sqlite.run('PRAGMA legacy_alter_table = ON')
  sqlite.run('BEGIN')

  try {
    sqlite.run('DROP INDEX IF EXISTS idx_job_type_mandates_type_repo')
    sqlite.run('ALTER TABLE job_type_mandates RENAME TO job_type_mandates_old')
    sqlite.run(`
      CREATE TABLE job_type_mandates (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('impl','plan','review','goal','convo')),
        repo_id TEXT REFERENCES repos(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    sqlite.run(`
      INSERT INTO job_type_mandates (id, type, repo_id, file_path, updated_at)
      SELECT id, type, repo_id, file_path, updated_at
      FROM job_type_mandates_old
      WHERE type NOT IN ('analysis','arch')
    `)
    sqlite.run('DROP TABLE job_type_mandates_old')
    sqlite.run(`
      CREATE UNIQUE INDEX idx_job_type_mandates_type_repo
      ON job_type_mandates(type, COALESCE(repo_id, ''))
    `)
    sqlite.run('COMMIT')
  } catch (error) {
    sqlite.run('ROLLBACK')
    throw error
  } finally {
    sqlite.run('PRAGMA legacy_alter_table = OFF')
    sqlite.run('PRAGMA foreign_keys = ON')
  }
}

export function initDb(): void {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS repos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      base_branch TEXT NOT NULL DEFAULT 'main',
      build_command TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      parent_folder_id TEXT REFERENCES folders(id),
      created_at TEXT NOT NULL
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      ref_num INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('impl','plan','review','goal','convo')),
      title TEXT NOT NULL,
      description TEXT,
      repo_id TEXT REFERENCES repos(id),
      branch_name TEXT,
      base_branch TEXT,
      parent_job_id TEXT,
      folder_id TEXT REFERENCES folders(id),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK(status IN ('open','in-progress','blocked','in-review','approved','done')),
      agent_id TEXT,
      auto_merge INTEGER NOT NULL DEFAULT 0,
      require_review INTEGER NOT NULL DEFAULT 1,
      plan TEXT,
      latest_update TEXT,
      artifact TEXT,
      handoff_summary TEXT,
      blocked_reason TEXT,
      conflicted_at TEXT,
      conflict_details TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS job_dependencies (
      id TEXT PRIMARY KEY,
      blocker_job_id TEXT NOT NULL REFERENCES jobs(id),
      blocked_job_id TEXT NOT NULL REFERENCES jobs(id),
      created_at TEXT NOT NULL
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      author TEXT NOT NULL CHECK(author IN ('agent','user')),
      agent_id TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS input_requests (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('yesno','choice','text')),
      prompt TEXT NOT NULL,
      choices TEXT,
      allow_free_text INTEGER NOT NULL DEFAULT 0,
      answer TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','answered','timeout')),
      previous_status TEXT,
      timeout_secs INTEGER,
      requested_at TEXT NOT NULL,
      answered_at TEXT
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS build_results (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('running','passed','failed')),
      output TEXT NOT NULL DEFAULT '',
      triggered_at TEXT NOT NULL,
      completed_at TEXT
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS job_references (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('job','file')),
      target_job_id TEXT,
      file_path TEXT,
      label TEXT,
      created_at TEXT NOT NULL
    )
  `)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS job_type_mandates (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('impl','plan','review','goal','convo')),
      repo_id TEXT REFERENCES repos(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  sqlite.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_job_type_mandates_type_repo
    ON job_type_mandates(type, COALESCE(repo_id, ''))
  `)

  if (shouldMigrateJobTypes('jobs')) {
    rebuildJobsTable()
  }

  if (shouldMigrateJobTypes('job_type_mandates')) {
    rebuildJobTypeMandatesTable()
  }

  const jobsCols = sqlite
    .query<{ name: string }, []>("PRAGMA table_info(jobs)")
    .all()
  const colNames = jobsCols.map(c => c.name)
  if (!colNames.includes('scratchpad')) {
    sqlite.run('ALTER TABLE jobs ADD COLUMN scratchpad TEXT')
  }
  if (!colNames.includes('review_outcome')) {
    sqlite.run('ALTER TABLE jobs ADD COLUMN review_outcome TEXT')
  }
}
