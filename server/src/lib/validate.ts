export function assertImplFields(body: {
  repoId?: string | null
  branchName?: string | null
}): void {
  if (!body.repoId) throw new Error('impl jobs require repoId')
  if (!body.branchName) throw new Error('impl jobs require branchName')
}
