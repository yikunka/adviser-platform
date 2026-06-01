<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# System Knowledge Maintenance

`src/lib/feedback/system-knowledge.md` is the knowledge base for the AI-powered "提交需求" (Submit Requirement) widget embedded in every page of this app. The LLM reads it on every user interaction. If it is stale, the AI gives wrong answers about what the system already supports.

**Rule: whenever a task adds, removes, or meaningfully changes a user-facing feature, update `system-knowledge.md` as part of the same task — not afterwards.**

What counts as a meaningful change:
- New admin page or new route → add a section or bullet
- New workflow or status state → update the relevant module section
- New platform added → add a row to the Multi-Platform Architecture table
- Feature removed or renamed → delete / correct the relevant text
- Change to a module's behavior that affects what users can do

What does NOT need an update:
- Bug fixes that don't alter functionality
- Styling / layout changes
- Refactors with no user-visible effect
- Infrastructure or migration-only changes

How to update:
1. Read the current file: `src/lib/feedback/system-knowledge.md`
2. Edit only the affected section(s) — do not rewrite unrelated content
3. Keep language concise and factual (it is a system prompt, not documentation)
