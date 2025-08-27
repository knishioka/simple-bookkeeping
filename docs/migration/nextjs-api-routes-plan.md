# Next.js API Routes Migration Plan (Phase 3.1)

## Issue #244: 基本APIのNext.js API Routes移行

### Current Status: ⚠️ Blocked

This migration is blocked due to dependencies on:

- **Phase 1** (#242): Supabase environment setup - Not implemented
- **Phase 2** (#243): Authentication migration - Not implemented

### Implementation Attempt Summary

A proof-of-concept implementation was attempted but encountered critical blockers:

1. **Schema Mismatches**: The current database schema differs significantly from what would be needed for a straightforward migration:
   - Users don't have direct `organizationId` (use UserOrganization many-to-many)
   - AccountingPeriod uses `isActive` instead of `isClosed`
   - Enum values are uppercase in Prisma (ADMIN vs admin)
   - Account relations differ from expected structure

2. **Authentication System**: The existing Express.js API uses Passport.js with JWT, but the migration plan assumes Supabase Auth which hasn't been set up.

### Proof of Concept Structure

The following structure was designed for the v2 API:

```
apps/web/src/app/api/v2/
├── lib/
│   ├── auth.ts          # Authentication utilities
│   ├── errors.ts        # Error handling
│   └── pagination.ts    # Pagination utilities
├── accounts/
│   ├── route.ts         # GET, POST /api/v2/accounts
│   ├── [id]/
│   │   └── route.ts     # GET, PUT, DELETE
│   └── import/
│       └── route.ts     # POST CSV import
├── journal-entries/
│   ├── route.ts         # GET, POST
│   └── [id]/
│       └── route.ts     # GET, PUT, DELETE
├── organizations/
│   ├── route.ts         # GET, PUT
│   └── members/
│       ├── route.ts     # GET, POST
│       └── [id]/
│           └── route.ts # GET, PUT, DELETE
└── accounting-periods/
    ├── route.ts         # GET, POST
    └── [id]/
        └── route.ts     # GET, PUT, DELETE
```

### Key Implementation Patterns

#### Authentication Pattern

```typescript
export async function GET(request: NextRequest) {
  return requireAuth(request, async (req, user) => {
    // Handler logic with authenticated user
  });
}

export async function POST(request: NextRequest) {
  return requireRole(request, 'ACCOUNTANT', async (req, user) => {
    // Handler logic requiring specific role
  });
}
```

#### Error Handling Pattern

```typescript
try {
  // API logic
} catch (error) {
  return handleApiError(error);
}
```

#### Pagination Pattern

```typescript
const params = getPaginationParams(request);
const [data, total] = await Promise.all([
  prisma.model.findMany({ skip: params.offset, take: params.limit }),
  prisma.model.count({ where }),
]);
return NextResponse.json(createPaginatedResponse(data, total, params));
```

### Required Schema Adaptations

To make this migration work, the following adaptations would be needed:

1. **User-Organization Relationship**:

```typescript
// Need to adapt from many-to-many to simplified model
const userOrg = await prisma.userOrganization.findFirst({
  where: { userId: user.id, isDefault: true },
  include: { organization: true },
});
const organizationId = userOrg?.organizationId;
const role = userOrg?.role;
```

2. **Enum Mappings**:

```typescript
// Map between API format and database format
const roleMap = {
  admin: 'ADMIN',
  accountant: 'ACCOUNTANT',
  viewer: 'VIEWER',
};

const accountTypeMap = {
  asset: 'ASSET',
  liability: 'LIABILITY',
  // etc.
};
```

3. **Field Name Mappings**:

```typescript
// AccountingPeriod
const isClosed = !period.isActive; // Inverse logic
```

### Recommended Next Steps

1. **Complete Phase 1 (#242)**: Set up Supabase environment
2. **Complete Phase 2 (#243)**: Migrate authentication system
3. **Create adapter layer**: Build utilities to handle schema differences
4. **Incremental migration**: Migrate one endpoint at a time
5. **Dual-run period**: Run both v1 and v2 APIs in parallel
6. **Gradual cutover**: Switch frontend to v2 endpoints gradually

### Alternative Approach

If Supabase migration is delayed, consider:

1. **Keep Express.js API**: Continue using existing API
2. **Create BFF Layer**: Build a Backend-for-Frontend in Next.js that calls Express API
3. **Gradual refactoring**: Slowly move logic from Express to Next.js
4. **Schema alignment**: Update database schema gradually to support both systems

### Dependencies to Install

When ready to implement:

```bash
pnpm --filter @simple-bookkeeping/web add \
  jsonwebtoken \
  @types/jsonwebtoken \
  csv-parser \
  @types/csv-parse
```

### Testing Approach

Once implemented:

1. **Unit tests**: Test individual route handlers
2. **Integration tests**: Test with real database
3. **E2E tests**: Test full flow from frontend
4. **Performance tests**: Compare with existing API
5. **Migration tests**: Ensure data consistency

### Risks and Mitigations

| Risk                    | Impact | Mitigation                    |
| ----------------------- | ------ | ----------------------------- |
| Schema incompatibility  | High   | Create adapter layer          |
| Authentication mismatch | High   | Implement dual auth support   |
| Performance regression  | Medium | Benchmark and optimize        |
| Data inconsistency      | High   | Implement transaction support |
| Missing features        | Medium | Feature parity checklist      |

### Conclusion

The migration to Next.js API Routes is technically feasible but requires:

1. Completion of prerequisite phases (1 & 2)
2. Significant schema adaptation work
3. Careful planning to avoid breaking changes
4. Comprehensive testing strategy

The proof-of-concept provides a solid foundation for the file structure and patterns, but actual implementation should wait until dependencies are resolved.
