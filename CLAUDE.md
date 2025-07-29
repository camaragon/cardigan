# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm run dev` (uses turbopack for faster builds)
- **Build for production**: `npm run build`
- **Lint code**: `npm run lint`
- **Database operations**:
  - Generate Prisma client: `npm run schema:generate`
  - Push schema changes: `npm run schema:push`
  - Reset database: `npm run schema:reset`
  - Open Prisma Studio: `npm run schema:studio`

## Project Architecture

This is a **Trello-like Kanban board application** built with Next.js 15, featuring organization-based workspaces with full CRUD operations for boards, lists, and cards.

### Core Stack
- **Framework**: Next.js 15 with App Router and Turbopack
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk (with organization support)
- **UI**: Tailwind CSS + Radix UI components
- **State Management**: Zustand for client state, TanStack Query for server state
- **Drag & Drop**: @hello-pangea/dnd for card/list reordering

### Data Model
The application follows a hierarchical structure:
- **Organizations** → **Boards** → **Lists** → **Cards**
- Each entity has audit logging through the `AuditLog` model
- Cards support descriptions and ordering within lists
- Lists support ordering within boards

### Key Architecture Patterns

#### Server Actions Pattern
All mutations use a consistent server action pattern:
- Located in `/actions/[entity-name]/` directories
- Each action has `index.ts` (handler), `schema.ts` (Zod validation), `types.ts` (TypeScript types)
- Wrapped with `createSafeAction` utility for validation and error handling
- Example: `actions/create-board/index.ts`

#### Route Structure
- **Marketing pages**: `app/(marketing)/` - public landing pages
- **Platform pages**: `app/(platform)/` - authenticated application
  - **Authentication**: `(clerk)/` - sign-in/up flows
  - **Dashboard**: `(dashboard)/` - main application interface
    - Organization pages: `organization/[organizationId]/`
    - Board pages: `board/[boardId]/`

#### Component Organization
- **UI components**: `components/ui/` - Radix UI based design system
- **Form components**: `components/form/` - reusable form inputs with validation
- **Modal components**: `components/modal/` - complex modal dialogs
- **Feature components**: Co-located with pages in `_components/` directories

#### State Management
- **Server state**: TanStack Query for API data fetching and caching
- **Client state**: Zustand stores (e.g., `use-card-modal.ts`)
- **Forms**: Custom `useAction` hook for server action integration

#### Authentication & Authorization
- Clerk handles authentication with organization switching
- Middleware enforces auth on protected routes
- Organization-scoped data access throughout the application

### Database Schema Notes
- UUIDs for all primary keys
- Cascade deletes for hierarchical relationships
- Optimistic updates supported through proper indexing
- Audit logging captures all CRUD operations with user context

### File Upload Integration
- Unsplash API integration for board background images
- Image metadata stored as pipe-separated values in board records

When working with this codebase:
1. Follow the established server action pattern for new mutations
2. Use the existing component patterns and design system
3. Ensure proper organization-scoped data access
4. Add audit logging for new entity operations
5. Maintain the hierarchical data relationships