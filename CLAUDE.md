# Limulus Dot Net Development Guide

## Build & Development Commands

- Build site: `npm run build`
- Development server: `npm run dev`
- Lint code: `npm run lint`
- Type check: `npm run tscc`
- Verify all: `npm run verify`
- Clean build artifacts: `npm run clean`

## Code Style Guidelines

- TypeScript with strict typing
- Line width: 92 characters
- No semicolons
- Single quotes for strings
- ES5 trailing commas
- Pre-commit: Checks for "TK" markers (placeholder text)
- Pre-push: Runs verify command

## Project Structure

- `/www`: Site content and templates (11ty)
- `/www/_includes`: WebC components and layouts
- `/www/lib`: TypeScript source for client-side features
- `/11ty`: Custom Eleventy plugins

## Tasks

### Upgrading/Updating Dependencies

When asked to upgrade dependencies, follow this process:

1. Run `npm outdated --json` to determine which dependencies can be updated.
2. Use `npm install package1@latest package2@latest` to update every dependency that is not
   a major version bump.
3. Run tests to ensure nothing has broken.
4. Inform the user which packages are major version bumps and therefore were not applied.
