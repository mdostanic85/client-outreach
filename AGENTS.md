<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Where code goes

Read `docs/architecture.md` before adding a feature. Server Actions live in `src/modules/<domain>/actions.ts` and use `runAction` from `src/lib/server-action.ts`; UI never imports `@/db`.
