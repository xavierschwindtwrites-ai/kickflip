# How to release a new version of KickFlip

1. Update the version number in package.json (e.g. 1.0.0 -> 1.1.0)
2. Commit: `git commit -am "Bump version to 1.1.0"`
3. Tag the commit: `git tag v1.1.0`
4. Push with tags: `git push && git push --tags`

GitHub Actions will automatically:
- Build the Mac .dmg on a Mac runner
- Build the Windows .exe on a Windows runner
- Create a GitHub Release with both files attached
- Generate release notes from your commit messages

Authors download directly from the GitHub Releases page.
No server, no cost, no maintenance required.
