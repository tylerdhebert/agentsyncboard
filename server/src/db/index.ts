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
      type TEXT NOT NULL CHECK(type IN ('impl','plan','review','analysis','goal')),
      title TEXT NOT NULL,
      description TEXT,
      repo_id TEXT REFERENCES repos(id),
      branch_name TEXT,
      base_branch TEXT,
      parent_job_id TEXT,
      folder_id TEXT REFERENCES folders(id),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK(status IN ('open','in-progress','blocked','in-review','done')),
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
}
