# Contributing to pix-mono

Thanks for your interest! Before opening a PR, please read this page — it
will save both of us time.

## This is an opinionated project

Pix was built for the maintainer's personal workflow and happens to be
open-source. Every visual choice — colors, layout, information density, single-line
footer — is **intentional**. The defaults are not arbitrary; they reflect a
specific terminal aesthetic and daily workflow.

### What this means for contributions

**Bug fixes are welcome.** If something is broken (crash, data loss, incorrect
behavior), open an issue or a PR. Regression tests are appreciated.

**Feature additions that extend capability are welcome.** New tools, new
integrations, new skills — things that add functionality without altering
existing behavior.

**Style and aesthetic PRs may be declined.** Changes to colors, spacing,
layout, wording, or visual presentation are at the sole discretion of the
maintainer. "I think this color should be different" or "this should be
configurable" is not a bug — it's a preference, and the maintainer's
preference wins. This includes but is not limited to:

- Color schemes and theming defaults
- Footer layout and segment ordering
- Tool output formatting and rendering
- Icon choices and typography
- Information density and truncation behavior

Some of these may become configurable in the future, but it's not a
priority right now. If it happens, it'll be on the maintainer's terms and
timeline — not driven by feature requests.

If you want a different visual style, **fork the project** — that's what
open source is for. The theme system (`pix-themes`) and config file
(`~/.pi/agent/pix.json`) already provide customization hooks for users who
want to tweak their own setup without changing upstream.

### Platform support

**Linux is the primary platform.** macOS works and is tested occasionally.
Windows support is minimal — PRs that fix Windows-specific issues are
accepted when the fix doesn't complicate the Linux/macOS code path, but
Windows-only features or workarounds are low priority.

## Before you open a PR

1. **Run the full check suite:**

   ```bash
   bun run ci          # lint + format (biome)
   bun run typecheck   # tsc across all packages
   bun test            # all tests
   ```

2. **Add tests** for new behavior or bug fixes. Untested PRs will be asked
   for coverage before merge.

3. **Keep changes focused.** One logical change per PR. Don't bundle style
   tweaks with bug fixes.

4. **Bump the version** in `package.json` if your change affects a published
   package. The CI publish pipeline checks for version bumps automatically.

## Reporting issues

Open a GitHub issue. Include:

- What you expected vs what happened
- Steps to reproduce
- Terminal emulator + OS
- Pi version (`pi --version`) and pix-core version

## License

By contributing, you agree that your contributions will be licensed under
the project's MIT license.
