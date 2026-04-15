import { $ } from 'bun'
import path from 'path'

export function worktreePath(repoPath: string, branchName: string): string {
  return path.join(repoPath, '..', '.git-worktrees', branchName)
}

export async function worktreeCreate(
  repoPath: string,
  branchName: string,
  baseBranch: string
): Promise<string> {
  const wtPath = worktreePath(repoPath, branchName)
  const existingBranches = await $`git -C ${repoPath} branch --list ${branchName}`.text()

  if (existingBranches.trim()) {
    await $`git -C ${repoPath} worktree add ${wtPath} ${branchName}`
  } else {
    await $`git -C ${repoPath} worktree add -b ${branchName} ${wtPath} ${baseBranch}`
  }

  return wtPath
}

export async function worktreeRemove(repoPath: string, branchName: string): Promise<void> {
  const wtPath = worktreePath(repoPath, branchName)
  try {
    await $`git -C ${repoPath} worktree remove --force ${wtPath}`
  } catch {
    // Worktree may already be gone.
  }
  try {
    await $`git -C ${repoPath} branch -D ${branchName}`
  } catch {
    // Branch may already be gone.
  }
}

export type DiffType = 'uncommitted' | 'branch' | 'combined'

export async function getDiff(
  repoPath: string,
  branchName: string,
  baseBranch: string,
  type: DiffType
): Promise<string> {
  const wtPath = worktreePath(repoPath, branchName)
  switch (type) {
    case 'uncommitted':
      return $`git -C ${wtPath} diff HEAD`.text()
    case 'branch':
      return $`git -C ${repoPath} diff ${baseBranch}...${branchName}`.text()
    case 'combined':
      return $`git -C ${wtPath} diff ${baseBranch}`.text()
  }
}

export async function getCommits(
  repoPath: string,
  branchName: string,
  baseBranch: string
): Promise<string> {
  return $`git -C ${repoPath} log --oneline ${baseBranch}..${branchName}`.text()
}

export type ConflictResult =
  | { hasConflicts: false }
  | { hasConflicts: true; details: string; files: string[] }

export async function checkConflicts(
  repoPath: string,
  branchName: string,
  baseBranch: string
): Promise<ConflictResult> {
  const base = await $`git -C ${repoPath} merge-base ${baseBranch} ${branchName}`.text()
  const mergeTreeOutput = await $`git -C ${repoPath} merge-tree ${base.trim()} ${baseBranch} ${branchName}`.text()

  if (!mergeTreeOutput.includes('<<<<<<<') && !mergeTreeOutput.includes('CONFLICT')) {
    return { hasConflicts: false }
  }

  const files = new Set<string>()
  for (const line of mergeTreeOutput.split('\n')) {
    const mergeMatch = line.match(/Merge conflict in (.+)$/)
    if (mergeMatch) {
      files.add(mergeMatch[1])
      continue
    }
    const conflictMatch = line.match(/CONFLICT.*? in (.+)$/)
    if (conflictMatch) {
      files.add(conflictMatch[1])
    }
  }

  return { hasConflicts: true, details: mergeTreeOutput, files: [...files] }
}

export async function mergeBranch(repoPath: string, branchName: string, baseBranch: string): Promise<void> {
  await $`git -C ${repoPath} checkout ${baseBranch}`
  await $`git -C ${repoPath} merge --no-ff ${branchName} -m ${`Merge ${branchName} into ${baseBranch}`}`
}
