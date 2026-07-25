# Migration: Task Demo to Prism Runtime

## Goal

Retire demo Task artifacts so runtime semantics are Prism-specific.

## Plan

1. Add Prism entities and Prism agents.
2. Remove demo Task agent from active agents path.
3. Remove demo Task entity from active entities path.
4. Preserve a historical copy under docs for reference.

## Status

- Prism entities and agents are now present in active runtime paths.
- Demo Task entity and task_manager agent were removed from active runtime paths.

## Historical Reference

- Demo entity: Task with fields title (required) and completed (boolean default false).
- Demo agent: task_manager with full CRUD access on Task and memory scope both.

## Rollback

If Prism entities fail validation, restore demo files from git history and disable Prism agents.
