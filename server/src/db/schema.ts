import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const repos = sqliteTable('repos', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  baseBranch: text('base_branch').notNull().default('main'),
  buildCommand: text('build_command'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  parentFolderId: text('parent_folder_id'),
  createdAt: text('created_at').notNull(),
})

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  refNum: integer('ref_num').notNull(),
  type: text('type', { enum: ['impl', 'plan', 'review', 'analysis', 'goal', 'arch', 'convo'] }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  repoId: text('repo_id').references(() => repos.id),
  branchName: text('branch_name'),
  baseBranch: text('base_branch'),
  parentJobId: text('parent_job_id'),
  folderId: text('folder_id').references(() => folders.id),
  status: text('status', {
    enum: ['open', 'in-progress', 'blocked', 'in-review', 'done'],
  }).notNull().default('open'),
  agentId: text('agent_id'),
  autoMerge: integer('auto_merge', { mode: 'boolean' }).notNull().default(false),
  requireReview: integer('require_review', { mode: 'boolean' }).notNull().default(true),
  plan: text('plan'),
  latestUpdate: text('latest_update'),
  artifact: text('artifact'),
  scratchpad: text('scratchpad'),
  handoffSummary: text('handoff_summary'),
  blockedReason: text('blocked_reason'),
  conflictedAt: text('conflicted_at'),
  conflictDetails: text('conflict_details'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const jobDependencies = sqliteTable('job_dependencies', {
  id: text('id').primaryKey(),
  blockerJobId: text('blocker_job_id').notNull().references(() => jobs.id),
  blockedJobId: text('blocked_job_id').notNull().references(() => jobs.id),
  createdAt: text('created_at').notNull(),
})

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  author: text('author', { enum: ['agent', 'user'] }).notNull(),
  agentId: text('agent_id'),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
})

export const inputRequests = sqliteTable('input_requests', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull(),
  type: text('type', { enum: ['yesno', 'choice', 'text'] }).notNull(),
  prompt: text('prompt').notNull(),
  choices: text('choices'),
  allowFreeText: integer('allow_free_text', { mode: 'boolean' }).notNull().default(false),
  answer: text('answer'),
  status: text('status', { enum: ['pending', 'answered', 'timeout'] }).notNull().default('pending'),
  previousStatus: text('previous_status'),
  timeoutSecs: integer('timeout_secs'),
  requestedAt: text('requested_at').notNull(),
  answeredAt: text('answered_at'),
})

export const buildResults = sqliteTable('build_results', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['running', 'passed', 'failed'] }).notNull(),
  output: text('output').notNull().default(''),
  triggeredAt: text('triggered_at').notNull(),
  completedAt: text('completed_at'),
})

export const jobReferences = sqliteTable('job_references', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['job', 'file'] }).notNull(),
  targetJobId: text('target_job_id'),
  filePath: text('file_path'),
  label: text('label'),
  createdAt: text('created_at').notNull(),
})

export const jobTypeMandates = sqliteTable('job_type_mandates', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['impl', 'plan', 'review', 'analysis', 'goal', 'arch', 'convo'] }).notNull(),
  repoId: text('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  updatedAt: text('updated_at').notNull(),
})
export type JobTypeMandate = typeof jobTypeMandates.$inferSelect

export type Repo = typeof repos.$inferSelect
export type NewRepo = typeof repos.$inferInsert
export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
export type JobDependency = typeof jobDependencies.$inferSelect
export type Comment = typeof comments.$inferSelect
export type InputRequest = typeof inputRequests.$inferSelect
export type BuildResult = typeof buildResults.$inferSelect
export type JobReference = typeof jobReferences.$inferSelect
