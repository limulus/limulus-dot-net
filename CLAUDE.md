# Limulus Dot Net Development Guide

## Build & Development Commands

- Build site: `npm run build`
- Development server: `npm run dev`
- Lint code: `npm run lint`
- Type check: `npm run tscc`
- Verify all: `npm run verify`
- Clean build artifacts: `npm run clean`

## Infrastructure Commands

- Synthesize CDK template: `npm run cdkc`
- Diff infrastructure: `npx cdk diff`
- Test CloudFront function in CloudFront: `npm run test:integration`

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
- `/infra`: AWS CDK infrastructure code
- `/infra/lib`: CDK stack definitions
- `/infra/functions`: CloudFront Functions (JS)
- `/infra/test`: Infrastructure tests
