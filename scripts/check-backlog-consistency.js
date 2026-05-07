#!/usr/bin/env node
// Enforces the backlog rule: no file may exist in both backlog/todo/ and backlog/completed/.
// Run automatically as a pre-commit hook (git always invokes hooks from the repo root).
// Exit 1 blocks the commit.

import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const todoDir = join(root, 'backlog', 'todo')
const completedDir = join(root, 'backlog', 'completed')

if (!existsSync(todoDir) || !existsSync(completedDir)) {
  process.exit(0) // directories not present — nothing to check
}

const todoFiles = new Set(readdirSync(todoDir).filter((f) => f.endsWith('.md') && f !== 'README.md'))
const completedFiles = new Set(
  readdirSync(completedDir).filter((f) => f.endsWith('.md') && f !== 'README.md')
)

const duplicates = [...todoFiles].filter((f) => completedFiles.has(f))

if (duplicates.length > 0) {
  console.error('\n\x1b[31m✖ Backlog consistency error\x1b[0m')
  console.error('The following files exist in both backlog/todo/ and backlog/completed/:')
  for (const f of duplicates) {
    console.error(`  • ${f}`)
  }
  console.error(
    '\nDelete the file(s) from backlog/todo/ before committing.\n' +
      'See CLAUDE.md § Backlog for the completion workflow.\n'
  )
  process.exit(1)
}
