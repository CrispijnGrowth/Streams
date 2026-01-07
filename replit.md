# Streams App - Project Orchestration

## Overview

Streams App is a personal project orchestration tool designed for managing "Sovereign Cloud Streams" with visual timelines and Kanban boards. The application follows a hierarchical data model: Streams → Solutions → Deliverables → Actions → Steps, allowing users to track progress at multiple levels of granularity.

The app is built as a full-stack TypeScript application with a React frontend and Express backend, using PostgreSQL for data persistence. It emphasizes a utility-first design approach with Linear-inspired aesthetics focused on clarity, efficiency, and data visibility.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Server**: Node.js HTTP server with Vite middleware in development
- **Static Serving**: Built client assets served from `dist/public` in production

### Data Model
The application uses a five-level hierarchy with per-user data isolation:
1. **Streams**: Top-level project containers with phases, owners, and labels
2. **Solutions**: Major milestones within streams with target dates (renamed from original "Deliverables")
3. **Deliverables**: Work packages within solutions, grouping related actions
4. **Actions**: Trackable tasks with Kanban status (Backlog, To Execute, Executing, Blocked, Delegated, Done, Archive)
5. **Steps**: Granular checklist items within actions

**Kanban Board**: Actions are displayed in a grouped Kanban layout when deliverables exist - each deliverable row has a fluorescent border and contains its actions across status columns. Drag-and-drop supports both status changes and moving actions between deliverables.

**Data Isolation**: Each entity (Stream, Solution, Deliverable, Action, Step) includes a `userId` field. All CRUD operations are scoped to the authenticated user, and parent ownership is validated when creating or updating child entities. Users can only see and modify their own data.

Progress is computed automatically by rolling up completion percentages from steps → actions → solutions → streams.

### Key Design Patterns
- **Shared Schema**: Types and validation schemas defined in `shared/schema.ts` using Zod, shared between frontend and backend
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` allows swapping data persistence implementations
- **Path Aliases**: `@/` for client source, `@shared/` for shared code, configured in both TypeScript and Vite

### Theming System
- Light and dark mode support via CSS variables
- Theme preference persisted to localStorage
- Status colors for action states (backlog, executing, blocked, etc.)
- Momentum indicators (Active, Slowing, Stalled) for stream health

## External Dependencies

### Database
- **PostgreSQL**: Primary data store configured via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database operations with schema defined in `shared/schema.ts`
- **Drizzle Kit**: Database migration tooling with `db:push` command

### UI Libraries
- **Radix UI**: Comprehensive set of accessible, unstyled primitives (dialog, dropdown, tooltip, tabs, etc.)
- **Lucide React**: Icon library
- **date-fns**: Date formatting and manipulation
- **Embla Carousel**: Carousel/slider functionality
- **cmdk**: Command palette component
- **Vaul**: Drawer component

### Build & Development
- **Vite**: Frontend bundler with React plugin
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development server
- **Tailwind CSS**: Utility-first CSS framework with PostCSS

### Authentication System
- **Password-Based Authentication**: Email and password login with bcrypt hashing (12 rounds)
- **Admin Approval Flow**: New user registrations require admin approval before access
- **Password Reset**: Magic links sent via email for password recovery (Postmark integration)
- **Session Management**: In-memory session storage with 7-day TTL, using `x-session-id` header
- **First Admin**: Hardcoded as `maarten.bal@capgemini.com` (auto-approved on registration)
- **User Roles**: `admin` (full access + user management), `member` (standard access), `pending` (awaiting approval)
- **Email Service**: Postmark integration for password reset links, admin notifications, and approval emails
- **Key Files**: 
  - `server/auth.ts` - AuthStorage class with user, session, password hashing, and token management
  - `server/email.ts` - Postmark email service for transactional emails
  - `client/src/lib/auth-context.tsx` - React context for authentication state
  - `client/src/pages/login.tsx` - Login/registration forms with password fields
  - `client/src/pages/reset-password.tsx` - Password reset page
  - `client/src/pages/settings.tsx` - User preferences and admin approval panel

### Example Data Seeding
- **Automatic Seeding**: New users receive example data when approved or on first login
- **Three Example Streams**: "[Example] Marketing Campaign Launch", "[Example] Build a Sailboat", "[Example] Company Christmas Party"
- **Full Hierarchy**: Each stream contains solutions, deliverables, actions (with varied statuses), and steps
- **Methods**: `storage.seedExampleData(userId)` and `storage.hasExampleData(userId)` for one-time seeding
- **Trigger Points**: Called in `/api/admin/approve/:userId` and `/api/auth/login` routes

### Team Members System
- **Team Members Table**: `team_members` table with id, userId, name, role, photoUrl, ordinal, isDeleted fields
- **Management UI**: Settings page includes Team Members section for adding/editing/deleting team members
- **Owner Selection**: Forms for Stream/Solution/Action use team member names as owner suggestions
- **Avatar Display**: Stream, Solution, and Action cards display owner avatars with tooltips showing name and role
- **Key Hook**: `useTeamMembers()` in `client/src/hooks/use-suggestions.ts` fetches team members for current user

### Edit/Operate Mode System
- **Mode Toggle**: Header contains Edit/Operate mode toggle button
- **Operate Mode** (default): Clicking cards navigates to detail view
- **Edit Mode**: Clicking cards opens edit dialog, cards show dashed primary border
- **Auto-Edit for Empty States**: When a page has no data (no streams, solutions, or actions), mode automatically switches to Edit so users can clearly see where to add items
- **Key File**: `client/src/lib/mode-context.tsx` - ModeProvider with setAutoEditForEmptyState API

### Recent Changes
- 2026-01-07: Added auto-edit mode for empty states - pages switch to Edit mode when no data exists
- 2026-01-07: Improved multi-owner display - all owners now shown as smaller stacked avatars in top-right corner
- 2026-01-07: Added Team Members system - manage team members with photos and roles, displayed as avatars on cards
- 2026-01-04: Added example data seeding system with three pre-populated streams for new users
- 2026-01-04: Added new Deliverable entity between Solution and Action - actions can now be grouped by deliverable in Kanban view with fluorescent row borders
- 2026-01-04: Renamed "Deliverable" to "Solution" throughout the application - Solutions are now milestones within Streams
- 2026-01-04: Implemented user-specific data isolation - each user has private streams, solutions, deliverables, actions, and steps
- 2026-01-04: Changed from magic-link to password-based authentication with password reset via email
- 2026-01-04: Added Postmark email integration for password reset and admin notifications
- 2026-01-03: Implemented custom magic-link authentication system with admin approval workflow