## Summary
Brief description of what this PR does.

## Type of Change
Please check the options that are relevant:
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Performance improvement
- [ ] Security fix
- [ ] Refactor
- [ ] Tests
- [ ] Documentation
- [ ] CI/CD

## Testing
Please verify that you have tested your changes locally:
- [ ] `npm run test` passes locally
- [ ] `npm run test:coverage` passes with 70%+ threshold
- [ ] `npm run build` passes locally
- [ ] `npx tsc --noEmit` passes locally
- [ ] Tested on mobile viewport (375px)
- [ ] Tested on desktop viewport

## Security Checklist (for auth/attendance/data changes)
- [ ] No hardcoded secrets or credentials
- [ ] Server actions verify session and role
- [ ] IDOR protection verified (ownership checks)
- [ ] Input validated with Zod before DB writes

## Database Changes
- [ ] New migration file created in `supabase/migrations/`
- [ ] Migration is idempotent (safe to run twice)
- [ ] Indexes added for new query patterns

## Screenshots (if UI changes)
Add before/after screenshots here (or drop media items directly).

## Related Issues
Closes #
