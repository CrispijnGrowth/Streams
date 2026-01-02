# Streams App Design Guidelines

## Design Approach

**System-Based Approach**: Drawing from Linear's modern project management aesthetics combined with Fluent Design's productivity focus. This is a utility-first application where clarity, efficiency, and data density take precedence over visual flourish.

**Key Principles**:
- Information hierarchy through typography and spacing, not color
- Consistent spatial rhythm for scannable interfaces
- Immediate visual feedback for all interactions
- Data-first layouts that maximize content visibility

---

## Typography System

**Font Stack**: Inter (primary UI), JetBrains Mono (data/dates/codes)

**Hierarchy**:
- Page Headers: text-2xl font-semibold tracking-tight
- Section Headers: text-lg font-semibold
- Card/Entity Titles: text-base font-medium
- Body Text: text-sm font-normal
- Metadata/Labels: text-xs font-medium uppercase tracking-wide
- Data Values: text-sm font-mono (dates, progress percentages)

---

## Layout & Spacing System

**Spacing Primitives**: Tailwind units of 1, 2, 4, 6, 8, 12, 16, 20

**Grid Structure**:
- Page container: max-w-screen-2xl mx-auto px-6
- Card grids: grid gap-4 (dense data) or gap-6 (breathing room)
- Section spacing: py-12 between major sections, py-6 within sections
- Component padding: p-4 (cards), p-6 (panels), p-2 (compact items)

**Responsive Behavior**:
- Desktop: Full multi-column layouts, side-by-side panels
- Tablet: 2-column max, stack complex views
- Mobile: Single column, collapsible sections

---

## Core Components

### 1. **App Shell**
- Fixed top navigation bar (h-14) with breadcrumb trail, global actions, user menu
- Optional collapsible sidebar (w-64 expanded, w-14 collapsed) for quick navigation
- Main content area with consistent px-6 py-8 padding

### 2. **Timeline Visualization**
- Horizontal scrolling canvas with pan/zoom controls (top-right toolbar)
- Time axis with clear month/quarter markers (text-xs uppercase)
- Ball indicators: 
  - Base size: w-8 h-8 rounded-full
  - Hover: scale-110 transform transition
  - No-date shelf: dashed border-2, absolute right-0
- Today marker: vertical line (border-l-2) spanning full height
- Rich tooltips: min-w-64 max-w-sm rounded-lg shadow-xl p-4 (appears above ball on hover)

### 3. **Kanban Board (Deliverable Level)**
- 7 equal-width columns in horizontal scroll container
- Column headers: sticky top-0 with count badges (text-xs rounded-full px-2 py-1)
- Cards: rounded-lg border p-3 space-y-2, hover:shadow-md transition
- Drag handle: 6 horizontal dots (••• on left edge)
- Card content hierarchy: title → metadata row (owner, date) → progress bar → counts
- In-column spacing: space-y-3 for cards

### 4. **Entity Cards (Overview Grids)**
- Stream cards: larger (min-h-32) with embedded mini-timeline
- Deliverable cards: medium (min-h-24) with Kanban count chips (3 inline chips: Doing/Blocked/Delegated)
- Action cards: compact (min-h-20) with progress bar and metadata
- All cards: rounded-lg border hover:shadow-lg transition-shadow cursor-pointer

### 5. **Forms & Inline Editing**
- Quick-add: single-line input with placeholder, appears inline with + button
- Inline edit mode: underline on hover, click to activate contenteditable or input overlay
- Form fields: rounded-md border px-3 py-2, consistent h-10 for text inputs
- Labels: text-sm font-medium mb-1 block
- Multi-select dropdowns: tags display as rounded-full px-2 py-1 text-xs chips with × dismiss

### 6. **Progress Indicators**
- Progress bars: h-2 rounded-full overflow-hidden, fill animates width transition-all
- Percentage display: text-xs font-mono tabular-nums alongside bar
- Momentum chips: rounded-full px-3 py-1 text-xs font-medium (Active/Slowing/Stalled)

### 7. **Modals & Panels**
- Modal backdrop: fixed inset-0 backdrop-blur-sm
- Modal content: max-w-2xl rounded-xl shadow-2xl p-6 space-y-6
- Slide-out panels (details/comments): fixed right-0 w-96 h-full shadow-xl p-6
- Panel headers: pb-4 border-b flex justify-between items-center

### 8. **Navigation & Controls**
- Breadcrumb: text-sm flex items-center gap-2, separators (/) text-xs
- Toolbar buttons: h-9 px-3 rounded-md hover:shadow-sm (icon + optional label)
- Icon buttons: w-9 h-9 rounded-md flex items-center justify-center
- Button groups: inline-flex rounded-lg border divide-x

### 9. **Data Tables & Lists**
- Table headers: sticky top-0 bg-inherit text-xs font-medium uppercase tracking-wide py-3
- Table rows: border-b py-3 hover:shadow-sm transition
- List items: py-3 flex items-center justify-between hover:shadow-sm rounded-lg px-3

### 10. **Empty States & Placeholders**
- Centered container: max-w-md mx-auto text-center py-16
- Icon placeholder: w-16 h-16 mx-auto mb-4
- Message hierarchy: text-lg font-medium mb-2, text-sm below
- CTA button: mt-6 centered

---

## Interaction Patterns

**Drag & Drop**:
- Visual feedback: shadow-xl scale-105 during drag
- Drop zones: border-2 dashed rounded-lg p-4 when valid target
- Ghost preview: opacity-50 of original item

**Hover States**:
- Cards/rows: shadow-md lift effect
- Balls: scale-110 + tooltip reveal
- Buttons: shadow-sm subtle elevation

**Loading States**:
- Skeleton screens: animate-pulse rounded matching content shape
- Spinners: w-5 h-5 border-2 border-t-transparent rounded-full animate-spin

**Keyboard Navigation**:
- Focus rings: ring-2 ring-offset-2 rounded on all interactive elements
- Focus visible only (focus-visible:ring-2)

---

## Animations

Use sparingly, only for:
- Ball transitions on timeline (transform duration-300 ease-out)
- Card hover lifts (shadow transitions duration-200)
- Panel slide-ins (translate-x-full → translate-x-0 duration-300)
- Progress bar fills (width transitions duration-500)

Respect `prefers-reduced-motion` - disable all animations when set.

---

## Accessibility Standards

- All interactive elements: min-h-10 touch targets
- Focus indicators on all controls
- ARIA labels for icon-only buttons
- Screen reader announcements for drag operations and updates
- Semantic HTML throughout (nav, main, article, section)
- Keyboard shortcuts with visible indicators (shown in tooltips/command palette)

---

## Responsive Breakpoints

- Mobile: < 640px (single column, stack everything)
- Tablet: 640px - 1024px (2 columns max, simplified Kanban)
- Desktop: > 1024px (full multi-column, side-by-side panels)

---

## Images

No images required for this application. This is a data-centric productivity tool focused on timelines, Kanban boards, and hierarchical information display.