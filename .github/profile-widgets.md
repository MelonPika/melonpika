# Profile widgets

The README keeps each section between matching `BEGIN` and `END` comments. Edit the introduction, tools, contact links, and learning badges directly. The featured repository block is generated from [profile.json](profile.json).

## Sections and updates

| Section | Images or source | Updated by |
| --- | --- | --- |
| Header, footer, typing | Local SVG artwork | Manual artwork updates |
| Cozy Corner | Transparent portrait and live Shields.io badges | README edits |
| Learning & Badges | Official IBM and Google artwork with public verification links | Verified credential updates |
| Header counts | Local repository, follower, and star badges | `profile-refresh.yml` |
| Featured Repositories | Public projects listed in `profile.json` | `profile-refresh.yml` |
| GitHub Stats | Overview, streak, and language cards | `profile-refresh.yml` |
| Activity Graph | Public contributions over the last 31 days | `profile-refresh.yml` |
| Contribution Snake | Light and dark SVG animations | `snake.yml` |
| 3D Contributions | Light and dark animated calendars | `profile-3d.yml` |

## Files to edit

- [README.md](../README.md): biography, technology badges, tool badges, contact links, and learning cards. Badge URLs use Shields.io's flat style and pastel colors. VS Code and ibisPaint use text badges.
- [profile.json](profile.json): account, display name, timezone, and featured repository names. The current project is `NYP`; the renderer excludes forks.
- [profile-3d-settings.json](profile-3d-settings.json): calendar colors and animation settings.
- [generate-profile.mjs](scripts/generate-profile.mjs): statistics, activity, repository-card layout, and the shared dark palette.
- [snake.yml](workflows/snake.yml): snake colors and generation settings.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): image sources and upstream credits.

## Daily schedule

| Workflow | Singapore time (UTC+8) | Generated files |
| --- | --- | --- |
| [Refresh profile cards](workflows/profile-refresh.yml) | 00:17 | Counts, statistics, activity, and repository cards |
| [Generate contribution snake](workflows/snake.yml) | 00:27 | Two snake SVGs |
| [Generate 3D contributions](workflows/profile-3d.yml) | 00:37 | Two calendar SVGs |

These are scheduled start times; GitHub may run them later. Each workflow also supports manual runs from Actions. The jobs publish changed assets with the built-in GitHub token. Separate concurrency groups and rebase retries handle overlapping runs.

## Layout and assets

The introduction uses a 28% / 72% table, with a portrait up to 210 pixels wide. Learning badges use two columns. Repository cards display at 405 pixels and shrink to fit phones. Statistics and contribution graphics fill the README width.

The portrait's SVG mask makes the space outside the gold ring transparent. The generated charts retain the project's dark palette in both image variants. The technology and tool badges load directly from Shields.io; official credential artwork remains in `assets/profile/badges/`.

Keep generated images in `assets/profile/`. Development caches and archived artwork belong in the ignored `.cache/` and `.local/` directories. The optional npm preview and validation tools are local to the development workspace.
