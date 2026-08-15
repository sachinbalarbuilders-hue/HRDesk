# HRMS Design System — React Build

A design spec for a React-based HRMS. Built to feel like a serious internal system of record — not a generic AI-generated SaaS template. Core metaphor: **the register** — an attendance/employee register book. Every screen is a page in that register: ruled, tabbed, stamped.

---

## 1. Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `--navy-900` | `#0A1F44` | Primary — sidebar, headers, primary buttons |
| `--navy-700` | `#152C56` | Hover states, secondary surfaces |
| `--gold-500` | `#C9A84C` | Accent — active tab, key stat, focus ring |
| `--gold-100` | `#F4EAD1` | Gold tint — badges, subtle highlight |
| `--paper` | `#F7F6F2` | App background (aged paper, not cream-beige) |
| `--ink` | `#1C1C1C` | Primary text |
| `--ink-muted` | `#6B6B63` | Secondary text, labels |
| `--rule` | `#D8D5CB` | Hairline dividers, table rules |
| `--ok-600` | `#2F6B4F` | Approved / present / active |
| `--warn-600` | `#B07B1E` | Pending / on-leave |
| `--err-600` | `#A8402E` | Rejected / absent / overdue |
| `--surface` | `#FFFFFF` | Cards, modals, table rows |

No pure black, no neon accents. Status colors are muted/desaturated — this is a document, not a dashboard toy.

### Type
- **Display** — `Fraunces` (serif, used only for page titles and the employee name on profile pages). Weight 500–600. Gives the register its "official document" gravity.
- **UI / Body** — `IBM Plex Sans`. Neutral, legible at small sizes, holds up in dense tables.
- **Data / Mono** — `IBM Plex Mono`. Employee IDs, timestamps, punch-in/out times, payroll figures. Anything that's a *record* rather than prose gets mono — this is the load-bearing distinctive choice.

Scale: `12 / 13 / 15 / 18 / 24 / 32` px. Body defaults to 13–14px (this is a data-dense tool, not a marketing page — don't oversize).

### Layout
- Fixed left sidebar, 240px, `--navy-900` background, gold active-state underline (not a filled pill — a 2px rule, echoing the register's ruled lines).
- Top bar: breadcrumb + search + profile. White, hairline `--rule` bottom border.
- Content max-width 1280px, 24px gutter.
- Radius: 4px everywhere. Sharp enough to feel administrative, not so sharp it feels brutalist.
- Shadows: none on flat surfaces. One soft shadow reserved for modals/dropdowns only.

---

## 2. Signature element: the Register Rule

A recurring horizontal rule with small tick marks at regular intervals (like the margin of a ledger page), used:
- Under every page title
- As the row separator in tables (replaces default border, ticks align with column starts)
- Behind the sidebar logo mark

This is the one place the design takes a visual risk. Everywhere else stays quiet and disciplined so this motif reads as intentional, not decorative noise.

```
Employee Directory
────┬────────┬──────────┬────────┬──────
```

Implement as a repeating SVG background or a bottom-border with a repeating linear-gradient — not individual DOM elements per tick.

---

## 3. Core screens

### 3.1 Dashboard
- Hero is **today's register**, not a stat-card grid. Top of page: a horizontal strip showing today's date, headcount present/absent/on-leave as inline numbers (mono type), not big dashboard tiles.
- Below: two columns — "Pending approvals" (leave requests, expense claims) as a compact list with approve/reject inline actions; "Today's attendance" as a live-updating table.
- Avoid the generic 4-KPI-card-row-with-icons pattern entirely.

### 3.2 Employee Directory
- Table-first, not card-grid. Columns: Photo (small, 32px), Name (Plex Sans, bold), Employee ID (mono, muted), Department, Designation, Status (colored dot + label), Joined date.
- Row click → slide-in panel from right (not a full navigation), 480px wide, showing profile summary + tabs (Details / Documents / Attendance / Leave History).
- Filters live in a thin bar above the table, not a sidebar facet panel — keeps focus on the register itself.

### 3.3 Employee Profile
- Header uses the Display serif for the name — the one place per screen where the serif appears, giving it the weight of a printed record.
- Left rail: photo, ID, quick facts (mono figures for salary, DOB, joining date).
- Right: tabbed record — Personal / Employment / Documents / Attendance / Leave / Payroll history.
- Document uploads shown as a filed-folder list, not drag-drop tiles.

### 3.4 Attendance
- Calendar-month grid is the primary view, each day cell showing a small colored mark (present/absent/half-day/leave) rather than a full heatmap wash — keeps it legible, not decorative.
- Toggle to table view for payroll-adjacent tasks (bulk correction, regularization requests).
- Punch times always mono, right-aligned in their cell.

### 3.5 Leave
- Request list uses status as a left-edge color bar (4px) on each row — ok/warn/err tokens — rather than a colored badge chip. Faster to scan a long list this way.
- New request is a slide-in panel, not a full-page form.
- Approval flow shows a simple horizontal stepper (Applied → HOD → HR → Approved) using the register-rule tick styling.

### 3.6 Payroll
- Every numeric column right-aligned, mono, with a hairline rule above the totals row (echoes a ledger's bottom-line rule, doubled).
- Payslip generation opens a print-preview style panel — literally designed to look like a document, since it becomes one (PDF export).

### 3.7 Recruitment / Pipeline
- Kanban by stage (Applied / Screened / Interview / Offer / Hired), but columns are ruled like register pages rather than floating cards on a colored board — thin verticals, no drop shadows, tick-rule header per column.

---

## 4. Components

- **Buttons**: primary = solid navy, gold text on hover-invert only for the single most important action per screen. Everything else is a ghost/outline button — resist filling every button with color.
- **Status dot**: 6px circle + label, using ok/warn/err tokens. This is the only place saturated color appears outside the sidebar.
- **Table row**: 40px height, hover = `--paper` tint, no zebra striping (the register-rule ticks already give horizontal rhythm).
- **Empty states**: write in the register's voice — "No leave requests filed this month" not "Nothing here yet 🎉". No illustrations; use a single large mono numeral "0" with the label beneath it, consistent with the data-record aesthetic.
- **Modals**: 4px radius, one soft shadow, header uses register-rule under the title.

## 5. Motion

Minimal. Slide-in panels (240ms ease-out) for row detail and forms. No page-load choreography, no hover-scale on cards. The one deliberate motion moment: on the dashboard, today's headcount numbers count up from 0 on load — a single orchestrated beat, not scattered micro-interactions.

## 6. Accessibility floor

- All status information carries a text label, never color alone.
- Focus ring = 2px `--gold-500` offset 2px, visible on every interactive element.
- Table and form layouts collapse to stacked cards only below 640px; sidebar becomes a bottom tab bar on mobile.
- Respect `prefers-reduced-motion` — disable the count-up and slide transitions (fade instead).

---

## 7. Stack notes (React)

- Tailwind config: map every token above into `theme.extend.colors` / `fontFamily` — don't hardcode hex in components.
- Table: build one `<Register>` table primitive (handles the tick-rule border, mono-align columns, status dot column) and reuse it across Employees / Attendance / Payroll / Leave rather than one-off tables per screen.
- Fonts: self-host Fraunces, IBM Plex Sans, IBM Plex Mono (variable fonts where available) — don't pull from Google Fonts CDN in a corporate-internal app.
