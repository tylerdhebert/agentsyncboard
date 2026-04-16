import { apiGet } from '../api'

type Repo = {
  id: string
  name: string
  path: string
  baseBranch: string
  buildCommand: string | null
}

export async function repoCommands(subcommand: string) {
  if (subcommand === 'list') {
    const repos = await apiGet<Repo[]>('/repos')
    if (repos.length === 0) {
      console.log('No repos configured.')
      return
    }
    for (const repo of repos) {
      console.log(`${repo.id}  ${repo.name}  (${repo.path})  base: ${repo.baseBranch}`)
    }
    return
  }

  throw new Error(`Unknown repo subcommand: ${subcommand}`)
}
