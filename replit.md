# Streams App - Project Orchestration

## Overview
Streams App is a personal project orchestration tool designed for managing "Sovereign Cloud Streams" with visual timelines and Kanban boards. It enables users to track progress at multiple levels of granularity through a hierarchical data model: Streams → Solutions → Deliverables → Actions → Steps. The application is a full-stack TypeScript application with a React frontend and Express backend, utilizing PostgreSQL for data persistence. It emphasizes a utility-first design approach with Linear-inspired aesthetics, focusing on clarity, efficiency, and comprehensive data visibility.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite

### Backend
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints
- **Server**: Node.js
- **Static Serving**: Built client assets

### Data Model
The application uses a five-level hierarchy with per-user data isolation:
1. **Streams**: Top-level project containers.
2. **Solutions**: Major milestones within streams.
3. **Deliverables**: Work packages within solutions, grouping related actions.
4. **Actions**: Trackable tasks with Kanban status.
5. **Steps**: Granular checklist items within actions.

Progress is automatically computed by rolling up completion percentages from steps to streams. The Kanban board displays actions grouped by deliverables, supporting drag-and-drop for status and deliverable changes. All CRUD operations are scoped to the authenticated user, ensuring data isolation.

### Key Design Patterns
- **Shared Schema**: Types and validation using Zod, shared between frontend and backend.
- **Storage Abstraction**: `IStorage` interface for flexible data persistence.
- **Path Aliases**: `@/` for client source, `@shared/` for shared code.

### Theming System
Supports light and dark modes via CSS variables, with preference persisted in localStorage. Includes status colors for action states and momentum indicators for stream health.

### Authentication System
- **Method**: Password-based authentication with bcrypt hashing.
- **Approval Flow**: New user registrations require admin approval.
- **Password Reset**: Magic links sent via email.
- **Session Management**: In-memory session storage with a 7-day TTL.
- **User Roles**: `admin`, `member`, `pending`.

### Admin User Management
Provides an admin-only section for managing users, including role assignment, deactivation/reactivation, and a list of active users.

### Example Data Seeding
New users automatically receive example data upon approval or first login, including three pre-populated streams with full hierarchies.

### Team Members System
Manages team members with names, roles, and photos (stored as base64 data URIs in PostgreSQL). Team member avatars are displayed on Stream, Solution, and Action cards.

**User-Team Member Linking:**
- Team members can be linked to registered users via the `linkedUserId` field
- During admin approval, if a pending user's name matches an existing team member, the admin is prompted to link them
- Linked users gain ownership-based access to streams/solutions where their team member name appears in the `owners` array
- `getLinkedTeamMemberForUser(userId)` retrieves the linked team member for a user

### User Avatar System
Users can upload and manage their profile avatars:
- `POST /api/auth/avatar` - Upload avatar (2MB max, images only: jpeg, png, gif, webp)
- `DELETE /api/auth/avatar` - Remove avatar
- Avatars stored as base64 data URIs in the `avatarData` column
- Settings page displays current avatar with upload/change/remove options

### Edit/Operate Mode System
A toggle allows switching between "Operate" (default, navigates to detail view) and "Edit" (opens edit dialogs) modes. The system automatically switches to Edit mode for empty pages.

### Excel Import/Export System
Allows exporting all project data to an Excel file and importing data from an Excel template. The import function supports updating existing records by matching names within the hierarchy.

### Stakeholder Tagging System
Enables tagging stakeholders on streams, solutions, actions, and steps. Uses an `@mention-style` UI for searching, creating, and tagging stakeholders within edit dialogs.

### Meetings System
Facilitates meeting management with a three-column layout: stakeholder search, tagged items management, and past meetings list. Supports creating meetings from tagged items, adding discussion notes, and marking items as resolved.

### @Mention System
Implements a universal `@mention` system within description fields. Mentions are stored in a canonical format and rendered visually with a `MentionHighlighter` component.

### Viewer Sharing System
Allows owners to grant read-only access to streams or solutions for other registered users. Viewers can see shared data but cannot modify it. Access control ensures ownership validation for all viewer operations.

**Cascading Permissions:**
- **Stream Viewers**: Can see the stream AND all solutions within it
- **Solution Viewers**: Can see the parent stream AND only their authorized solution(s) within it. Progress/counts on stream cards reflect only visible solutions.

**Implementation Details:**
- `getViewableStreamIds()`: Returns direct stream viewer IDs plus parent stream IDs from solution viewer permissions
- `getDirectStreamViewerIds()`: Returns only direct stream viewer IDs (used for full stream access checks)
- `isDirectStreamViewer()`: Checks if user has direct stream-level viewer access
- Solution queries filter based on viewer type to prevent data leakage

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle ORM**: Type-safe database operations.
- **Drizzle Kit**: Database migration tooling.

### UI Libraries
- **Radix UI**: Accessible, unstyled primitives.
- **Lucide React**: Icon library.
- **date-fns**: Date formatting and manipulation.
- **Embla Carousel**: Carousel functionality.
- **cmdk**: Command palette component.
- **Vaul**: Drawer component.

### Build & Development
- **Vite**: Frontend bundler.
- **esbuild**: Server bundling.
- **tsx**: TypeScript execution for development server.
- **Tailwind CSS**: Utility-first CSS framework.

### Authentication
- **Postmark**: Email service for transactional emails (password resets, admin notifications).