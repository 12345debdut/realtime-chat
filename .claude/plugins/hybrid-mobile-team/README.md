# Hybrid Mobile Team

A 5-person AI engineering team for building and maintaining hybrid mobile apps with a Node.js backend.

## Team Members

| Agent | Role | Model | Color | Specialty |
|-------|------|-------|-------|-----------|
| **Lead** | Orchestrator | Opus | Blue | Plans work, dispatches agents in parallel, integrates results, deploys |
| **Prakhar** | Product Manager | Opus | Cyan | Product specs, user stories, edge cases, feature requirements |
| **Faiyaz** | Backend Engineer | Opus | Green | Node.js, Fastify, Prisma, Socket.IO, PostgreSQL, security |
| **Debdut** | Frontend Engineer | Opus | Yellow | React Native, WatermelonDB, Reanimated, UI/UX, hooks |
| **Kailash** | QA Engineer | Opus | Green | Vitest, test suites, edge case coverage, integration tests |
| **Kaushal** | Tech Lead | Opus | Red | Architecture review, security audit, race conditions, scalability |

## Usage

### Full Sprint (via Lead)
```
"Have the team build [feature]"
"Run the mobile team on [these bugs]"
"Plan and implement [feature] across backend and frontend"
```

### Individual Agents
```
"Have Prakhar write a spec for [feature]"
"Have Faiyaz add a new endpoint for [resource]"
"Have Debdut build a [screen/component]"
"Have Kailash write tests for [feature]"
"Have Kaushal audit [module] for security issues"
```

## Workflow

```
User Request
    │
    ▼
┌─────────┐
│  Lead   │ ── Plans work, splits tasks
└────┬────┘
     │
     ├──────────────────┬──────────────────┐
     ▼                  ▼                  ▼
┌──────────┐     ┌──────────┐      ┌──────────┐
│ Prakhar  │     │ Kaushal  │      │ Kailash  │
│ (Spec)   │     │ (Audit)  │      │ (Tests)  │
└────┬─────┘     └────┬─────┘      └────┬─────┘
     │                │                  │
     ▼                ▼                  │
┌─────────────────────────┐              │
│  User Reviews & Approves │              │
└────────────┬────────────┘              │
             │                           │
     ┌───────┴───────┐                   │
     ▼               ▼                   ▼
┌──────────┐  ┌──────────┐       ┌──────────┐
│ Faiyaz   │  │ Debdut   │       │ Kailash  │
│ (Backend)│  │(Frontend)│       │ (Tests)  │
└────┬─────┘  └────┬─────┘       └────┬─────┘
     │              │                  │
     ▼              ▼                  ▼
┌─────────────────────────────────────────┐
│  Lead: Verify builds → Deploy → Report  │
└─────────────────────────────────────────┘
```

## Tech Stack

- **Server**: Fastify + Socket.IO + Prisma + PostgreSQL + Redis
- **Mobile**: React Native 0.85 (New Architecture) + WatermelonDB + Reanimated
- **Contracts**: Shared Zod schemas (`@rtc/contracts`)
- **Deployment**: Fly.io (Docker, rolling deploys)
- **Tests**: Vitest with Fastify inject()
