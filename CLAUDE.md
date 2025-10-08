# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PlanForge LG MVP is a logic construction support tool (ロジック構築支援ツール) built as a monorepo using pnpm workspaces and Turborepo.

## Architecture

This is a TypeScript monorepo with four main packages:

1. **@planforge/frontend** - React + Vite frontend application
2. **@planforge/backend** - Hono API server
3. **@planforge/worker** - LLM worker for AI processing (uses OpenAI)
4. **@planforge/contracts** - Shared types and Zod schemas

The architecture follows a clean separation:
- `contracts` defines shared types/schemas using Zod and exports them for both frontend and backend
- `backend` serves as the main API using Hono framework with Zod validation
- `worker` handles AI/LLM processing separately from the main API
- `frontend` is a React application built with Vite

All packages depend on `contracts` for shared type definitions.

## Development Commands

### Root-level commands (run from project root):
- `pnpm dev` - Start all packages in development mode
- `pnpm build` - Build all packages (follows dependency graph)
- `pnpm test` - Run tests across all packages
- `pnpm lint` - Lint all packages
- `pnpm check-types` - Type check all packages
- `pnpm format` - Format code with Prettier

### Package-specific commands:

**Frontend** (packages/frontend):
- `pnpm dev` - Start Vite dev server (port 5173, opens browser)
- `pnpm build` - TypeScript compile + Vite build
- `pnpm preview` - Preview production build

**Backend** (packages/backend):
- `pnpm dev` - Start Hono server with hot reload (tsx watch)
- `pnpm build` - Compile TypeScript
- `pnpm start` - Run compiled server

**Worker** (packages/worker):
- `pnpm dev` - Start worker with hot reload (tsx watch)
- `pnpm build` - Compile TypeScript
- `pnpm start` - Run compiled worker

**Contracts** (packages/contracts):
- `pnpm build` - Build with tsup (generates ESM + .d.ts files)
- `pnpm dev` - Watch mode for development

## Infrastructure

### Docker Services
The project uses Docker Compose for local development:
- PostgreSQL 16 (port 5432)
  - Database: `planforge`
  - User: `planforge_user`
  - Container: `planforge-postgres`

Start services: `docker-compose up -d`

### Environment Variables
Copy `.env.example` to `.env` for local development. Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Backend server port (default: 3000)
- `VITE_API_URL` - API URL for frontend (default: http://localhost:3000)
- `NODE_ENV` - Environment (development/production)

Future additions will include MinIO, OpenAI API keys, and Auth.js configuration.

## Build System

Turborepo orchestrates the build pipeline:
- Tasks respect dependency graph (^build, ^lint, ^check-types)
- Dev tasks are marked persistent and not cached
- Build outputs: `.next/**`, `dist/**`, `build/**`
- Test outputs: `coverage/**`

The `contracts` package must be built first as other packages depend on it.

## Package Manager

- **Node.js**: >=20.0.0
- **pnpm**: >=9.0.0 (locked to 9.15.0)
- Always use pnpm, never npm or yarn
