#!/usr/bin/env bun

import { jobCommands } from './commands/job'
import { inputCommands } from './commands/input'
import { buildCommands } from './commands/build'

const [, , group, subcommand, ...rest] = process.argv

function printHelp() {
  console.log(`
agentboard - agentsyncboard CLI

Commands:
  agentboard job list [--agent <id>] [--status <status>]
  agentboard job context --job <ref>
  agentboard job create --title "..." --type <type> [--parent <ref>] [--repo <id>] [--branch <name>] [--base <branch>]
  agentboard job claim --job <ref> --agent <id>
  agentboard job plan --job <ref> --agent <id> "<text>"
  agentboard job checkpoint --job <ref> --agent <id> "<text>"
  agentboard job artifact --job <ref> --agent <id> "<text>"
  agentboard job comment --job <ref> --agent <id> "<text>"
  agentboard job ready --job <ref>
  agentboard job worktree --job <ref>

  agentboard input request --job <ref> --agent <id> --type yesno|choice|text --prompt "..." [--choices "a:Label,..."] [--allow-free-text]
  agentboard input wait --job <ref> [--agent <id>]

  agentboard build run --job <ref>
  agentboard build status --job <ref>
`)
}

async function main() {
  try {
    if (group === 'job') {
      await jobCommands(subcommand, rest)
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

    printHelp()
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
