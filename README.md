# Cardigan

A full-featured Trello-like Kanban board application built with Next.js 16. Organize projects with boards, lists, and cards in organization-based workspaces.

## Features

- **Organization Workspaces** - Multi-tenant support with Clerk authentication and organization switching
- **Kanban Boards** - Create and manage boards with custom Unsplash backgrounds
- **Lists and Cards** - Full CRUD with drag-and-drop reordering
- **Pro Subscriptions** - Stripe-powered billing with free tier limits (5 boards) and unlimited pro tier
- **Activity Tracking** - Audit logging for all board, list, and card operations
- **Responsive Design** - Works across desktop and mobile

## Tech Stack

| Category | Tools |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Authentication | Clerk (with organization support) |
| Payments | Stripe (subscriptions, webhooks) |
| UI | Tailwind CSS, Radix UI, Lucide React, next-themes |
| State | Zustand (client), TanStack Query (server) |
| Drag and Drop | @hello-pangea/dnd |
| Validation | Zod |
| Images | Unsplash API |

## Project Structure

```
cardigan/
├── app/
│   ├── (marketing)/           # Public landing pages
│   ├── (platform)/            # Authenticated application
│   │   ├── (clerk)/           # Sign-in/sign-up flows
│   │   └── (dashboard)/       # Main application
│   │       ├── organization/  # Org settings, billing, activity
│   │       └── board/         # Board view with lists and cards
│   └── api/webhook/           # Stripe webhook endpoint
├── actions/                   # Server actions (schema + handler + types)
├── components/
│   ├── ui/                    # Design system (Radix-based)
│   ├── form/                  # Validated form inputs
│   └── modal/                 # Modal dialogs
├── hooks/                     # Custom React hooks
├── lib/                       # Utilities and configurations
├── constants/                 # App constants (board limits, etc.)
└── prisma/                    # Database schema
```

## Getting Started

### Prerequisites

- Node.js 20.9+
- PostgreSQL database
- Clerk account
- Stripe account (for subscriptions)
- Unsplash API key (optional, for board backgrounds)

### Setup

1. Clone and install:
   ```bash
   git clone <repository-url>
   cd cardigan
   npm install
   ```

2. Create `.env.local`:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/cardigan"

   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

   # Stripe
   STRIPE_API_KEY=sk_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Unsplash (optional)
   NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=...
   ```

3. Set up the database:
   ```bash
   npm run schema:generate
   npm run schema:push
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run schema:generate` | Generate Prisma client |
| `npm run schema:push` | Push schema to database |
| `npm run schema:reset` | Reset database |
| `npm run schema:studio` | Open Prisma Studio |

## Architecture

### Server Actions

All mutations follow a consistent pattern in `/actions/[entity]/`:
- `schema.ts` - Zod validation schema
- `index.ts` - Handler with auth checks, limit enforcement, and audit logging
- `types.ts` - TypeScript types

Client-side usage goes through the `useAction` hook which provides loading state and `onSuccess`/`onError` callbacks.

### Data Model

Organizations -> Boards -> Lists -> Cards

- `OrgLimit` tracks free tier board count per organization (max 5)
- `OrgSubscription` stores Stripe subscription state
- `AuditLog` records all CRUD operations with user context
- Cascade deletes maintain referential integrity

### Authentication

Clerk handles auth with `proxy.ts` (Next.js 16 convention, replaces `middleware.ts`) enforcing protected routes. All data access is scoped to the current organization.

## Deployment

Optimized for Vercel. Connect the repository, set all environment variables from `.env.local`, and deploy. The Stripe webhook endpoint (`/api/webhook`) is configured as a public route in `proxy.ts`.

## License

Private and proprietary.
