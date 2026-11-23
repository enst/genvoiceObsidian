# Obsidian GenVoice Plugin

The GenVoice team's plugin for task notes in a shared Obsidian vault.

## What it does

| Feature | When | What changes |
| --- | --- | --- |
| Template picker | You create a new, empty note | The chosen template is written into that note, with `{{date}}` replaced by today and you added to `people` and `createdBy` |
| Last edit date | You edit a note | The `updatedDate:` line in the properties becomes today (once a day, not on every key) |
| Entry header | You start a new entry below the `+++` line of a task note | A separator line, today's date and your username are inserted above it |
| People clean-up | After you save a note that has both `people` and `assignedTo` | One name per line, lower case, no duplicates; everyone in `assignedTo` is also in `people` |
| Archiving | After you set `status: archived` | The note moves to `<top folder>/_Archived/<year>/<month>/<name>_<YYYYMMDDHHmm>.md` |
| **Set Task Status** (editor menu) | You pick a status | The `status` property; choices come from `All/status.md` |
| **Assign Task To** (editor menu) | You pick a collaborator | `assignedTo` and `people`; choices are the notes in `All/Collaborators/` |
| **Validate People in Folder** (command) | You run it | People clean-up for every note in the active note's folder and its subfolders |

The folders and keywords can be changed in the plugin settings. Dashboards built on these properties need the Dataview plugin.

## Rules the plugin follows (since 1.1.0)

**It only reacts to what you do on this computer.** Obsidian reports a change made by a sync tool exactly like a change you typed: the note is "modified", re-indexed, and reloaded into the editor if it is open. The plugin therefore checks, before every automatic change, that the editor holds text that is not on disk yet, or that the file was written just now while you were working on that note. A colleague's change that arrives by sync is left alone: their copy of the plugin has already handled it. Without this check every computer rewrites and moves the same note at the same moment, which is where conflict copies and duplicate archives come from.

**It changes only the property it means to change.** Properties are edited line by line. Dates (`2026-03-30`), empty values, comments, quotes and the order of the other properties stay exactly as they were. A property written in a form the plugin does not read (nested YAML, multi-line strings) is not touched.

**Just looking at a note never changes it.**

**Notes in `_Archived` and in the template folder are never moved.** A note at the vault root is not archived either, because there is no folder to archive it into; the plugin says so.

### With SyncHub

When the vault is synced by SyncHub, the plugin reads the two files SyncHub keeps in `.synchub/`:

- A note inside a personal folder (`个人/<name>/…`) is archived to `个人/<name>/_Archived/…`.
- A note you cannot write to gets no automatic changes, and the menus tell you it is read-only.
- If you cannot write to the archive folder, the note stays where it is and you are told.

In a vault without SyncHub nothing is restricted.

## Development

```
npm ci
npm run build   # type-check, then bundle main.ts into main.js
npm test        # unit tests, and the whole plugin against a fake Obsidian
npm run dev     # rebuild on change
```

- `main.ts` wires Obsidian's events to the features.
- `src/logic.ts`, `src/frontmatter.ts` and `src/people.ts` hold the decisions and the text rewriting as plain functions with no Obsidian imports. They are what the unit tests cover.
- `test/fake-obsidian.mjs` is the fake Obsidian. It fires events in the order the real application does (measured on Obsidian 1.15.1); `test/plugin.test.mjs` uses it to check what the plugin does when you type, and what it leaves alone when a change arrives by sync.

`main.js` is committed: it is the file that gets installed. Rebuild it before committing a change to the source, and raise `version` in `manifest.json`.

Requires Obsidian 1.1.0 or later.
