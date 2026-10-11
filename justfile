# Coulee task runner. `just check` is the gate every change must pass.
set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments

default:
    @just --list

# Lint + typecheck + tests + invariants + content validation (the single gate)
check: lint typecheck test invariants content

# Biome lint + format check
lint:
    pnpm exec biome check .

# Apply biome formatting and safe fixes
fmt:
    pnpm exec biome check --write .

# Typecheck every package (and repo scripts)
typecheck:
    pnpm -r --workspace-concurrency=1 run typecheck
    pnpm exec tsc -p tsconfig.scripts.json

# All vitest suites
test *ARGS:
    pnpm exec vitest run "$@"

# Determinism/purity bans in packages/core/src
invariants:
    pnpm exec tsx scripts/check-invariants.ts

# Validate content/base TOML (schemas + cross-references)
content:
    pnpm exec tsx packages/cli/src/main.ts content check

# Build the JSON content bundle the web app loads
bundle:
    pnpm -C packages/content run bundle

# The coulee CLI, e.g. `just run run --scenario iron_ford --seed 42 --days 10`
run *ARGS:
    pnpm exec tsx packages/cli/src/main.ts "$@"

# Vite dev server (phone on LAN: uses --host)
web: bundle
    pnpm -C apps/web run dev

# Production build of the PWA
web-build: bundle
    pnpm -C apps/web run build

# Blender headless asset build -> apps/web/public/assets
assets:
    blender --background --factory-startup --python tools/blender/build_all.py

# Screenshots of the built app with system chromium -> runs/screens
screens: web-build
    pnpm exec tsx scripts/screens.ts
