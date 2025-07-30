# Cardigan

A modern, full-featured Trello-like Kanban board application built with Next.js 15. Organize your projects with boards, lists, and cards in a collaborative workspace environment.

## Features

- **Organization Workspaces** - Multi-tenant organization support with Clerk authentication
- **Kanban Boards** - Create and manage unlimited boards with custom backgrounds
- **Lists & Cards** - Full CRUD operations with drag-and-drop functionality
- **Custom Backgrounds** - Integration with Unsplash API for beautiful board backgrounds
- **Activity Tracking** - Comprehensive audit logging for all board activities
- **Responsive Design** - Works seamlessly across desktop and mobile devices
- **Secure Authentication** - Powered by Clerk with organization switching
- **Performance Optimized** - Built with Turbopack for lightning-fast development

## Tech Stack

### Core Framework
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Turbopack** - Ultra-fast bundler for development

### Database & ORM
- **PostgreSQL** - Reliable relational database
- **Prisma** - Type-safe database ORM and migrations

### Authentication & Authorization
- **Clerk** - Complete authentication solution with organization support

### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful SVG icons
- **next-themes** - Dark/light theme support

### State Management
- **Zustand** - Lightweight state management
- **TanStack Query** - Powerful data fetching and caching
- **@hello-pangea/dnd** - Drag and drop functionality

### Validation & Forms
- **Zod** - TypeScript-first schema validation
- **Custom Form Hooks** - Type-safe form handling

### External APIs
- **Unsplash API** - High-quality background images

## Project Structure

```
cardigan/
├── app/                    # Next.js App Router
│   ├── (marketing)/       # Public marketing pages
│   └── (platform)/        # Authenticated application
│       ├── (clerk)/       # Authentication flows
│       └── (dashboard)/   # Main application
├── actions/               # Server actions with validation
├── components/           # Reusable UI components
│   ├── ui/              # Radix UI components
│   ├── form/            # Form components
│   └── modal/           # Modal dialogs
├── lib/                 # Utility functions and configurations
├── hooks/               # Custom React hooks
├── constants/           # Application constants
└── prisma/             # Database schema and migrations
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- Clerk account for authentication
- Unsplash API key (optional, for custom backgrounds)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cardigan
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/cardigan"
   
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
   
   # Unsplash (optional)
   NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=your_unsplash_access_key
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run schema:generate
   
   # Push database schema
   npm run schema:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint for code quality |
| `npm run schema:generate` | Generate Prisma client |
| `npm run schema:push` | Push schema changes to database |
| `npm run schema:reset` | Reset database and run migrations |
| `npm run schema:studio` | Open Prisma Studio |

## Architecture Patterns

### Server Actions
All mutations follow a consistent pattern:
- **Schema validation** with Zod
- **Type safety** with TypeScript
- **Error handling** with `createSafeAction` utility
- **Audit logging** for all operations

### Component Organization
- **UI Components** - Reusable design system components
- **Form Components** - Validated form inputs
- **Feature Components** - Co-located with their respective pages
- **Modal Components** - Complex dialog interactions

### Data Flow
- **Server State** - TanStack Query for API data
- **Client State** - Zustand for UI state
- **Authentication** - Clerk with organization context
- **Database** - Prisma with PostgreSQL

## Authentication & Authorization

The application uses Clerk for authentication with support for:
- User sign-up and sign-in
- Organization creation and switching
- Protected routes with middleware
- Organization-scoped data access

## Database Schema

The application follows a hierarchical data structure:
- **Organizations** contain **Boards**
- **Boards** contain **Lists**
- **Lists** contain **Cards**
- **AuditLog** tracks all changes with user context

## Customization

### Adding New Actions
1. Create action directory in `/actions/`
2. Define schema with Zod validation
3. Implement server action with error handling
4. Add TypeScript types

### Extending UI Components
1. Add new components to `/components/ui/`
2. Follow Radix UI patterns for accessibility
3. Use Tailwind CSS for styling
4. Export from component index

## Deployment

The application is optimized for deployment on Vercel:

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - Vercel will automatically build and deploy

### Environment Variables for Production
Ensure all environment variables from `.env.local` are configured in your deployment platform.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is private and proprietary.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `CLAUDE.md`
- Review the Next.js documentation

---

Built with Next.js 15, TypeScript, and modern web technologies.