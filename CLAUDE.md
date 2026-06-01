# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **#100Day Challenge** workspace containing web app projects. Currently active project:

- **`開発部/whisky-note/`** — WhiskyNote: a Japanese-language PWA for logging and sharing whisky tasting notes
- **`開発部/mood-forecast/`** — empty, placeholder for future project
- **`企画部/`** — empty, planning department placeholder

## WhiskyNote Architecture

A **vanilla JS single-page app** (no build step, no bundler) deployed to Firebase Hosting.

### File structure
| File | Role |
|------|------|
| `index.html` | All UI markup; screens toggled via CSS classes (`open`, `visible`) |
| `app.js` | All app logic — state, Firestore sync, rendering, event handling |
| `whisky-db.js` | Static `WHISKY_DB` array — local whisky reference data (Japanese whiskies) |
| `styles.css` | All CSS |

### Key architectural patterns

**State model** — module-level `let` variables in `app.js`: `records` (current user's data), `allRecords` (all Firestore docs for community search), `currentUser`, `currentDetailId`, `currentRating`, `currentPhoto`, `currentAromas[]`, `currentFlavors[]`.

**Data persistence** — Firestore is source of truth; `localStorage` (`whisky_note_v1_{uid}`) is an offline-first cache populated by `onSnapshot`. Writes go directly to Firestore (`db.collection('whiskyRecords').doc(id).set(...)`); the `onSnapshot` listener handles the local state update.

**Auth** — Firebase Auth with Google Sign-In popup. `auth.onAuthStateChanged` drives the full UI lifecycle: login screen ↔ main app, Firestore listener start/stop.

**Modal pattern** — Three detail-style modals: add/edit modal (`whiskyModal`), inline-edit detail modal (`detailModal`), and wiki/community detail modal (`wikiDetailModal`). The detail modal rebuilds its entire `innerHTML` on open and wires up its own event listeners each time. `document.body.style.overflow = 'hidden'` is used to lock scroll; `open` class triggers CSS transitions.

**Tag lists** — `setupTagList(containerId, options, arr)` renders predefined tags + custom-input. It clones the container node to strip old listeners, then renders fresh. Tags mutate the shared `currentAromas`/`currentFlavors` arrays in place.

**Photo handling** — three-stage fallback: Canvas→JPEG resize (max 1200px, 0.82 quality) → `heic2any` for desktop HEIC → raw FileReader. Photos are stored as base64 data URLs inside Firestore documents.

**Search** — client-side filter across `records` (name/distillery). At `query.length >= 2`, also queries `allRecords` for community matches and searches `WHISKY_DB` for reference data. Results rendered in three separate sections below the user's own collection.

### Deployment

```bash
# Preview locally (serves from current directory)
firebase serve --only hosting

# Deploy to production
firebase deploy --only hosting
```

Firebase project: `whisky-note-e137d`

No package.json / no npm dependencies — CDN scripts only (Firebase compat SDK 10.12.0, heic2any 0.0.4).
