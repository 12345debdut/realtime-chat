# @rtc/tsconfig

Shared TypeScript base config for the monorepo.

Every other package extends `base.json`:

```json
{
  "extends": "@rtc/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

## What's in `base.json`

- `strict: true` + all strictness flags (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, …)
- `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`
- `esModuleInterop: true`, `skipLibCheck: true`
- `isolatedModules: true` (so Metro, swc, esbuild can process each file in isolation)
- `resolveJsonModule: true`

Apps override `outDir`, `rootDir`, JSX, and Node/DOM libs as needed.

## When to edit this

Only when you want a change to propagate to **every** workspace. One-off overrides belong in the individual `tsconfig.json`.
