#!/usr/bin/env bun

import { jobCommands } from './commands/job'
import { inputCommands } from './commands/input'
import { buildCommands } from './commands/build'
import { refCommands } from './commands/refs'
import { repoCommands } from './commands/repos'

const [, , group, subcommand, ...rest] = process.argv

function printHelp() {
  console.log(`
agentboard - agentsyncboard CLI

Commands:
  agentboard job list [--agent <id>] [--status <status>] [--type <type>] [--parent <ref>]
  agentboard job context --job <ref>
  agentboard job create --title "..." --type <type> [--parent <ref>] [--repo <id>] [--branch <name>] [--base <branch>] [--description "..."] [--ref-job <ref> [--ref-label "..."]] ...
  agentboard job claim --job <ref> --agent <id>
  agentboard job edit --job <ref> [--title "..."] [--description "..."]
  agentboard job plan --job <ref> --agent <id> "<text>" [--from-file <path>]
  agentboard job checkpoint --job <ref> --agent <id> "<text>" [--from-file <path>]
  agentboard job artifact --job <ref> --agent <id> "<text>" [--from-file <path>]
  agentboard job comment --job <ref> --agent <id> "<text>" [--from-file <path>]
  agentboard job scratch --job <ref> --agent <id> "<text>" [--from-file <path>]
  agentboard job ready --job <ref>
  agentboard job reopen --job <ref>
  agentboard job done --job <ref>
  agentboard job worktree --job <ref>

  agentboard ref add --job <ref> --job-ref <ref> [--label "..."]
  agentboard ref add --job <ref> --file <path>   [--label "..."]
  agentboard ref remove --job <ref> --ref <ref-id>
  agentboard ref list --job <ref>

  agentboard input request --job <ref> --agent <id> --type yesno|choice|text --prompt "..." [--choices "a:Label|b:Label"] [--allow-free-text]
  agentboard input wait --job <ref> [--agent <id>]

  agentboard build run --job <ref>
  agentboard build status --job <ref>

  agentboard repo list
`)
}

async function main() {
  try {
    if (group === 'job') {
      await jobCommands(subcommand, rest)
      return
    }

    if (group === 'ref') {
      await refCommands(subcommand, rest)
      return
    }

    if (group === 'input') {
      await inputCommands(subcommand, rest)
      return
    }

    if (group === 'build') {
      await buildCommands(subcommand, rest)
      return
    }

    if (group === 'repo') {
      await repoCommands(subcommand)
      return
    }

    printHelp()
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
