# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Vue 3 Composition API, script setup macros, reactivity system | vue | C:\Projects\CryptoProject\.agents\skills\vue\SKILL.md |
| Pinia state management, stores, state/getters/actions | pinia | C:\Projects\CryptoProject\.agents\skills\pinia\SKILL.md |
| TypeScript/JavaScript files | typescript-best-practices | C:\Projects\CryptoProject\.agents\skills\typescript-best-practices\SKILL.md |
| Complex type logic, generics, conditional types | typescript-advanced-types | C:\Projects\CryptoProject\.agents\skills\typescript-advanced-types\SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### vue
- Use Composition API with `<script setup lang="ts">`
- Prefer TypeScript over JavaScript
- Prefer `<script setup lang="ts">` over `<script>`
- For performance, prefer `shallowRef` over `ref` if deep reactivity not needed
- Always use Composition API over Options API
- Discourage using Reactive Props Destructure

### pinia
- Define stores with `defineStore` using Composition API style
- Use `storeToRefs` for reactive destructuring of state/getters
- Avoid using `this` in stores — use composition
- Plugins extend stores with custom properties, state, and behavior
- Composables can use stores directly via `useStore()`

### typescript-best-practices
- Use discriminated unions for mutually exclusive states
- Use branded types for domain primitives (e.g., `type UserId = string & { __brand: 'UserId' }`)
- Use `unknown` over `any` — enforce type checking
- Prefer `interface` for object shapes, `type` for unions
- Use const assertions for literal unions
- Exhaustive switch with never check for discriminated unions
- Use Zod for runtime validation with `z.infer<>`

### typescript-advanced-types
- Generics: `function identity<T>(value: T): T`
- Constraints: `<T extends HasLength>`
- Conditional types: `T extends string ? true : false`
- Mapped types: `{ [K in keyof T]: T[K] }`
- Template literal types: `` `on${Capitalize<EventName>}` ``
- Utility types: `Partial<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, T>`
- Use `infer` for type extraction
- Discriminated unions for async state machines

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md | C:\Users\Developer\.config\opencode\AGENTS.md | User-level conventions (not in project) |

## Stack Context

- **Frontend**: Vue 3 + Pinia + Vite + TailwindCSS + Lightweight Charts + Socket.io-client
- **Backend**: Express + MongoDB/Mongoose + CCXT + Socket.io + JWT auth
- **Architecture**: Full-stack monorepo (frontend/backend separation)
- **Note**: No TypeScript in frontend, no test runner at root level

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.