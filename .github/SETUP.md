# MelonPika profile setup

The README is ready to publish from the public `MelonPika/melonpika` repository. The existing lowercase repository name works for the GitHub profile.

1. Review, commit, and push these files to `main`. No remote changes or workflow executions were performed during local implementation.
2. Under **Settings → Actions → General**, allow the actions used by these workflows. Each asset job requests `contents: write` for the built-in `GITHUB_TOKEN`; no personal access token, custom secret, GitHub Pages site, or output branch is needed.
3. If repository or organization policy prevents the built-in token from pushing, allow the necessary write permission. If `main` requires pull requests or blocks bot commits, the asset jobs need an approved bot exception or a PR-based publishing process. Workflows never bypass branch protection or force-push.
4. The initial push triggers the card, snake, and 3D jobs. Alternatively, open **Actions** and manually run **Refresh profile cards**, **Generate contribution snake**, and **Generate 3D contributions** on `main`.
5. Check the actual run results. The local snake and 3D calendars already show real public data. The first successful 3D workflow replaces the marked contribution-breakdown placeholder with the upstream radar and commit-language pie.

## Daily updates

| Workflow | Singapore time (UTC+8) | Updates |
| --- | --- | --- |
| `profile-refresh.yml` | 00:17 | Overview, streak, languages, followers, stars, activity, repository cards |
| `snake.yml` | 00:27 | Animated light/dark contribution snakes |
| `profile-3d.yml` | 00:37 | Animated light/dark 3D contribution calendars |

Schedules use UTC cron and are approximate. Each generator serializes its own runs in a distinct concurrency group, checks out the latest default branch, stages only its own files, and retries publishing after a rebase. Distinct groups prevent simultaneous initial workflows from canceling one another's pending run; separate output files and rebase retries handle simultaneous pushes. Unchanged assets create no commit. There are no artificial activity commits or delays. `validate.yml` runs read-only checks on pushes, pull requests, and manual requests.

## Personalization

- Edit the visible bio, optional location, creative tools, social links, and learning placeholders directly in `README.md`. Missing details are marked in brackets. No Google or Microsoft achievement has been inferred from an account name.
- Replace a badge placeholder only after verifying your public achievement link. The two-column Google grid and three-column Microsoft grid match the reference.
- Two IBM SkillsBuild badges are displayed above those placeholders, using the official images and public Credly verification URLs you supplied. Their titles, issuer, issue dates, and image sources are recorded in `assets/profile/badges/credentials.json`.
- Edit `featured` in [profile.json](profile.json) to choose public repository names from your account. Seven real projects are included initially; six are clearly labeled as public forks. Missing/private projects fail the refresh while preserving committed cards.
- The technology badges reflect observed public repository languages, including forks. The statistics language card uses the provider's original-repository calculation. These scopes can differ.
- Only the repository region between `BEGIN/END featured-repositories` is generated in README. Refreshing preserves edits outside that region.
- Edit [profile-3d-settings.json](profile-3d-settings.json) for the 3D palette and [snake.yml](workflows/snake.yml) for the snake palette.
- This repository is configured specifically for MelonPika. A username change also requires updating the explicit accounts in the workflows, README links, badges, and artwork.

## Preview the README locally

Run `npm run preview`, then open **http://127.0.0.1:4173** in your browser. Keep the command running and refresh the browser after saving the README. This renders Markdown, HTML, local SVGs, and images without the GitHub API or an internet connection. Press Ctrl+C to stop. To change ports, run `npm run preview -- --port 4174`.

In VS Code, open `README.md` and press **Ctrl+Shift+V**, or **Ctrl+K**, then **V** for a preview beside the editor. The file opens as source text until you invoke Markdown preview.

## Local maintenance

Use Node.js 24 or later and run from the repository root:

```sh
npm ci --ignore-scripts
npm run refresh
npm test
npm run validate
```

`refresh` fetches public data and validates all service responses before rendering cards. A failed or malformed response fails the job and preserves committed assets. The last successful snapshot is `assets/profile/public-data.json`, with source URLs and retrieval time. No credentials are saved. Re-render offline with `npm run render`.

```sh
node .github/scripts/static-assets.mjs  # Original header, typing, mascot, footer
node .github/scripts/fetch-badges.mjs   # Pastel badges and public avatar
npm run bootstrap                     # Real snake + 3D from the public snapshot
npm run preview                       # Interactive local browser preview
npm run preview:check                 # GitHub-rendered desktop/mobile screenshots
```

`bootstrap` downloads the same pinned upstream source revisions used by Actions into ignored `.cache/vendor/`. It calls the actual snake solver/SVG renderer and actual 3D calendar renderer. Without authenticated contribution-category data, it marks that portion instead of inventing a radar. Its language donut uses verified repository-language percentages; the workflow's full upstream output uses commit languages. `assets/profile/contribution-provenance.json` records the initial bootstrap, not subsequent Actions runs.

`preview` serves the current README and images locally with GitHub-style CSS. It rereads the README on each browser refresh and does not require a browser automation package or a GitHub API request to render.

`preview:check` sends this public README to GitHub's Markdown rendering API and uses an installed Chrome/Edge/Chromium browser with GitHub-style CSS. Set `PROFILE_CHROME` if necessary. Screenshots and inspection results go to ignored `.cache/`, and its temporary server closes after the checks. This checks sanitization and desktop/mobile layout without publishing the profile; the surrounding GitHub UI is approximated locally.

## Credits and visual differences

Design reference: [ShadowsLunarfox/ShadowsLunarfox](https://github.com/ShadowsLunarfox/ShadowsLunarfox), commit `e959dfada0d6f4f6ad1672e9c02cba47ae7dd72f`. Its README, all seven workflows, supporting scripts/settings, and all profile SVGs were inspected. The reference contains no license file. Reference-owned artwork, implementation, descriptions, accounts, and earned badges are not distributed here. The existing GPL-3.0 license is preserved.

The section order, palette, centered headings, 28%/72% introduction, badge grids, two-column repository cards, and full-width statistics follow the reference. Cards use a 405px display width so they wrap to full width on phones under GitHub's responsive image rules. SVG dimensions follow its 640px statistics cards, 560×200 repository cards, 1000×300 activity graph, 880×192 snake, and 1280×850 calendar.

| Element | Source / implementation |
| --- | --- |
| Waving header/footer | Original local SVG, matching the reference's capsule-render gradient and proportions |
| Typing | Original local SVG; 22px monospace, 760×60, three lines, about 1.2-second pause; no remote font |
| Fox mascot | Original vector artwork with melon headphones and laptop; the reference raster is not copied |
| Avatar | MelonPika's public GitHub avatar, cached locally |
| Technology badges | [Shields.io](https://shields.io/) and Simple Icons where available, cached locally |
| Header badges | Local followers, stars, and public-repository counts; the reference's live Komarev view counter failed intermittently during validation and was replaced with the verified repository count |
| Overview / languages | [GitHub Readme Stats](https://github.com/anuraghazra/github-readme-stats), through the reference's working `github-readme-stats.shion.dev` endpoint; exact URLs are in the public snapshot |
| Streak | [GitHub Readme Streak Stats](https://github.com/DenverCoder1/github-readme-streak-stats), `streak-stats.demolab.com`, daily mode, Asia/Singapore timezone |
| Activity graph | Original local SVG using GitHub's public calendar |
| Snake | [Platane/snk](https://github.com/Platane/snk), pinned v3 revision; SVG is already animated, so an extra GIF is unnecessary |
| 3D calendar | [github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib), pinned 0.9.3 revision; MIT notice in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |

Exact differences: personalized identity/projects; marked placeholders for unverified personal details and achievements; independently drawn fox; local header/typing approximations; reliable local repository-count badge; repository cards wrap on phones; initial 3D breakdown pending the first authenticated workflow; language card height adapted to actual languages. Light/dark pictures use GitHub-compatible HTML. The README has no inline CSS or JavaScript; image animations live inside SVGs. All displayed images are local files.

Workflows were configured and checked locally. Local generation does not establish a successful GitHub Actions run.
