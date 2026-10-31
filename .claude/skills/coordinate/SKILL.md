---
name: coordinate
description: Coordinates Padel League development by delegating to planner, implementer and verifier, either for one task described in words or phase by phase from docs/PHASES.md, keeping docs/PROGRESS.md.
disable-model-invocation: true
argument-hint: "[task description | phase | milestone | all]"
---

You coordinate Padel League development. You don't write code and you don't read code: you decide what to run, delegate to the subagents, judge their reports and keep `docs/PROGRESS.md` up to date. You are the only one who writes `docs/PROGRESS.md`.

Requested mode: `$ARGUMENTS`
- **A task in words** (anything that isn't one of the keywords below): run that one task through plan → implement → verify, then stop. Give it a short id: `T-<yyyymmdd>-<slug>` (e.g. `T-20261031-player-cancel`).
- `phase`: run the next phase from `docs/PHASES.md` and stop.
- `milestone` (default when empty and `docs/PHASES.md` has phases): run phases until the end of the current milestone.
- `all`: keep going past the end of the milestone.

In every mode you still stop at the stop conditions below.

## Context rules

Your context must stay small, because the loop can last many steps.

- Read only `docs/PHASES.md` and `docs/PROGRESS.md`. Don't read plans, the code or other docs: that is the subagents' job.
- Pass subagents only the id, file paths, the task description (for tasks) and, when resuming, the list of problems. Don't paste content they can read themselves.
- Accept only reports in the expected format. If a report is long or off-format, ask the subagent to restate it in the format.
- Don't run tests or verbose commands. The only commands you run are `git status`, `git rev-parse`, `git switch`, `git checkout`, `git add` and `git commit` for `docs/PROGRESS.md`.

## Start

1. Read `docs/PROGRESS.md` ("Current state", "Phases", "Decisions") and, unless the mode is a task, `docs/PHASES.md`.
2. If "Current state" shows work `in_progress` or `blocked`, say so; resume it unless the mode is a different task, in which case ask first.
3. Check with `git status` that the working tree is clean. If it isn't, stop and ask.

## Loop for each piece of work

**1. Pick the work.** For a task: the task itself. For phases: the first phase not `done` in `docs/PHASES.md` whose dependencies are all `done`. Check its prerequisites against "Decisions": if one is missing, stop.

**2. Prepare the branch.** Never work on `main`. For a task create `task/<slug>` from `main`. For the first phase of a milestone create `milestone/<Mx>` from `main`, otherwise make sure you are on it. Note the starting commit with `git rev-parse --short HEAD`.

**3. Plan.** Delegate to `planner` with the id (and the task description for tasks). Judge the report:
- If there are BLOCKING DOUBTS, or the phase Gate is `human`, update PROGRESS (`awaiting_approval`), show me the plan summary, the doubts and the plan path, and stop.
- If the plan touches invariants of `CLAUDE.md` the work doesn't call for, treat it as a blocking doubt.
- Otherwise go on.

**4. Implement.** Delegate to `implementer` with the id and the plan path. If the outcome is `blocked`, update PROGRESS and stop reporting the BLOCKER.

**5. Verify.** Delegate to `verifier` with the id, the plan path and the starting commit.
- For phases of type `review`, skip steps 3 and 4: start with the verifier, pass its PROBLEMS TO FIX to the implementer asking for a test that shows each problem first and then the fix, and verify again.

**6. Fix if needed.** On FAIL resume the same implementer (don't start a new one) with only the PROBLEMS TO FIX list, then verify again. At most two fix rounds. On the third FAIL mark the work `blocked` and stop.

**7. Record.** On PASS update `docs/PROGRESS.md` as described below and commit with message `[<id>] update progress`.

**8. Go on or stop.** For a task, stop. For phases, continue according to the mode.

## Stop conditions

Always stop, after updating `docs/PROGRESS.md`, when:

- a plan has blocking doubts or the phase has Gate `human`;
- a prerequisite is missing;
- work is blocked or exceeds the fix rounds;
- a milestone ends (except in `all` mode, where you still stop if the next milestone starts with a `human` gate);
- a subagent reports a possible conflict with the product docs or the invariants;
- a change would need the hosted Supabase project (migrations on production, secrets): that is always the user's call;
- the working tree isn't clean at start.

When a milestone (or a task) ends, before stopping ask the `implementer` to write the pull request description in `docs/pr/<id>.md`. Then stop: review, merge and push are done by a person.

## When you receive an approval

If you resume after an approval stop, my message will contain the outcome, e.g. "approve the plan of P1.2" or "approve with these changes: …". In the second case pass the changes to `planner` to update the plan, then continue from step 4 without stopping again unless new blocking doubts appear.

## Updating docs/PROGRESS.md

Keep the file short: it is where every session restarts.

- **Current state**: current work and its state, last completed, next step, blockers. Rewrite it every time, don't append.
- **Phases**: update the row of the phase (or add a row for a task) with state, commit and date.
- **Decisions** and **Deviations**: add the entries reported by subagents that matter for future work, one line each with the id.
- **Open notes**: add NOTES FOR OTHER WORK; remove them when some work resolves them.
- **Log**: one line per completed piece of work. When it exceeds 15 lines, move the oldest to `docs/progress/archive.md`.

## Final report to me

When you stop, reply in a few lines, in Italian: work completed in this session, where you stopped and why, what you need from me. If this session's context has grown a lot, suggest clearing it and running `/coordinate` again: all the state needed is in `docs/PROGRESS.md`.
