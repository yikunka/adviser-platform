@AGENTS.md

---

# System Knowledge Maintenance

`src/lib/feedback/system-knowledge.md` is the knowledge base for the AI-powered "提交需求" (Submit Requirement) widget. The LLM reads it every time a user opens that dialog. If it is stale, the AI gives inaccurate advice about what the system already supports.

**Rule: whenever a task adds, removes, or meaningfully changes a user-facing feature, update `system-knowledge.md` as part of the same task — not afterwards.**

What counts as a meaningful change:
- New admin page or new route (add a section or a bullet)
- New workflow or status state (update the relevant module section)
- New platform added (add a row to the Multi-Platform Architecture table)
- Feature removed or renamed (delete / correct the relevant text)
- Change to a module's behavior that affects what users can do

What does NOT need an update:
- Bug fixes that don't alter functionality
- Styling / layout changes
- Refactors with no user-visible effect
- Infrastructure or migration-only changes

How to update:
1. Read the current file: `src/lib/feedback/system-knowledge.md`
2. Edit only the section(s) affected — do not rewrite unrelated content
3. Keep language concise and factual (it is a prompt, not documentation)

---

# Multi-Platform Strategy

This project hosts **multiple independent platforms** under one Next.js app + one database. Each platform gets its own URL (managed by nginx), its own folder, and its own DB table prefix — but shares the same codebase, infrastructure, and deployment.

---

## Adding a New Platform — Standard Approach

### 1. Folder structure
Create the platform under `src/app/<platform-name>/` (at the **app root**, NOT under `[locale]`):
```
src/app/<platform-name>/
  layout.tsx              # Platform-level layout (own header/footer, own metadata)
  page.tsx                # Home page
  components/
    <Platform>Header.tsx
    <Platform>Footer.tsx
  <page-name>/
    page.tsx
```

### 2. Exclude from next-intl middleware
In `src/proxy.ts`, add the platform name to the matcher exclusion list so the locale middleware doesn't redirect it:
```ts
// Before:
matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', '/']
// After (add each new platform name):
matcher: ['/((?!api|_next|_vercel|sfsdiamond|<new-platform>|.*\\..*).*)', '/']
```

### 3. Images
Download all site images to `public/<platform-name>/` and reference them via Next.js `<Image>` with `src="/sfsdiamond/filename.ext"`.

### 4. Database
Use platform-specific table name prefixes in Prisma (e.g., `sfs_` for sfsdiamonds). Add new models to the shared `schema.prisma` using the prefix convention `<prefix>_<tablename>`.

### 5. Nginx routing
Each platform's domain is pointed at the same Next.js server via nginx. The nginx config maps domains to paths:
```nginx
# sfsdiamond.com → /sfsdiamond/*
location / {
  proxy_pass http://localhost:3000/sfsdiamond;
}
```

### 6. Content replication rules
When copying an existing website into this project:
- **Visit every page** of the source site (skip Blog and Shop sections unless told otherwise)
- **Replicate all content**: headings, body text, contact info, team, products/services, FAQs
- **Download all images** used on the site into `public/<platform-name>/`
- **Optimise the layout**: clean typography, consistent card styles, mobile-responsive grid, smooth hover states
- Use `Georgia, serif` for display headings; system sans-serif for body
- Use the site's brand colour palette faithfully; enhance spacing and hierarchy where the original is cluttered
- Keep the **same navigation structure** as the original (minus excluded sections)

### 7. Access URL during development
Platform is served at `http://localhost:3000/<platform-name>` — no locale prefix.

---

## Existing Platforms

| Platform | Folder | Domain | DB prefix | Status |
|---|---|---|---|---|
| SFS Diamond | `src/app/sfsdiamond/` | sfsdiamond.com | `sfs_` | ✅ Built |
