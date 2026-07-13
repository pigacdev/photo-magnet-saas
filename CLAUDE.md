@AGENTS.md

# Project Rules

Before writing any code:

1. Read ALL files in `/docs`:
   - masterplan.md
   - implementation-plan.md
   - design-guidelines.md
   - app-flow-pages-and-roles.md
   - image-processing-and-printing.md
   - database-schema.md
   - AI-RULES.md
   - DEV-WORKFLOW.md
   - technical-dept.md

2. These documents are the single source of truth.

3. Do NOT:
   - Change core logic
   - Simplify crop or print behavior
   - Invent alternative implementations

4. Always:
   - Follow image-processing-and-printing.md exactly
   - Respect database-schema.md structure
   - Read **technical-dept.md** before implementing new features or fixing bugs in related areas — known risks and launch blockers live there
   - When work **resolves** an item in technical-dept.md, update that file in the same change set (mark resolved, remove, or re-rank; add a changelog line)
   - Ask for clarification if anything is unclear

5. Work in small steps:
   - Explain before implementing
   - Wait for confirmation when requested