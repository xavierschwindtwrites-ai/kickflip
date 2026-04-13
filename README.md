# KickFlip

A free desktop app for indie authors planning Kickstarter campaigns.

No account. No subscription. Your data stays on your computer.

## What it does

- **Per-backer margin calculator** — see exactly what you net after Kickstarter fees, printing, and shipping
- **Three-scenario modeler** — plan for conservative, expected, and breakout funding
- **Shipping planner** — know your total shipping exposure across every region
- **Stretch goal ladder** — build stretch goals that are actually funded by the backers who unlock them
- **Launch readiness check** — a checklist that pulls from your real data
- **Post-campaign retrospective** — compare actuals to projections and carry lessons forward

## Download

Get the latest release for Mac (.dmg) or Windows (.exe):

**[Download KickFlip](https://github.com/xavierschwindtwrites-ai/kickflip/releases/latest)**

### Mac installation (first time only)

1. Download and open the `.dmg`, drag KickFlip to Applications
2. Try to open KickFlip — macOS will show a warning
3. Open Terminal and run:
   ```
   xattr -cr /Applications/KickFlip.app
   ```
4. Double-click KickFlip — it opens normally from now on

This is required because KickFlip is not yet code-signed with an Apple Developer certificate.

### Windows installation note

If Windows SmartScreen appears, click "More info" then "Run anyway."

## Development

KickFlip is built with Electron, React, TypeScript, and sql.js.

```bash
# Install dependencies
npm ci

# Run in development
npm start

# Package the app
npm run package

# Build installers
npm run make
```

## Releasing

See [RELEASING.md](RELEASING.md) for how to trigger a release build via GitHub Actions.

## License

MIT — free and open source.

Built by Xavier Schwindt / Crownling Entertainment.
