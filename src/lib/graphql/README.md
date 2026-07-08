# CareerOS AI · GraphQL API

A production-grade GraphQL layer that coexists with the existing TanStack server functions and REST paths. Backed by the same Supabase database, so every REST endpoint continues to work unchanged.

## Endpoint

```
POST /api/graphql          # queries & mutations
GET  /api/graphql          # GraphiQL Playground (schema explorer + docs)
OPTIONS /api/graphql       # CORS preflight
```

Open `GET /api/graphql` in a browser to explore the schema with the built-in Playground.

## Authentication

Send the user's Supabase access token as a bearer token:

```
Authorization: Bearer <access_token>
```

The server validates the token against Supabase Auth and creates a per-request Supabase client scoped to that user. All resolvers rely on **Row-Level Security** — the same policies that protect the REST API. Unauthenticated requests can only reach `apiInfo`; every other resolver throws `UNAUTHENTICATED` (HTTP 401).

Client tip: read the token in the browser with

```ts
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;
```

## Modules

| Module | Query | Mutations |
| --- | --- | --- |
| User | `me`, `profile(id)` | `updateProfile` |
| Applications | `applications(...)`, `application(id)` | `createApplication`, `updateApplication`, `deleteApplication` |
| Resumes | `resumes(...)`, `resume(id)` | — (uploads go through the existing REST/storage flow) |
| Resume Analysis | `resumeAnalyses(...)` | `deleteAiAnalysis` |
| Job Match | `jobMatches(...)` | `deleteAiAnalysis` |
| Interview Coach | `interviewCoachSessions(...)`, `interviewSessions(...)` | `deleteAiAnalysis` |
| Career Coach | `careerCoachPlans(...)` | `deleteAiAnalysis` |
| Referrals | `referrals(...)` | `createReferral`, `deleteReferral` |
| Interview Notes | `interviewNotes(...)` | `createInterviewNote`, `deleteInterviewNote` |
| Analytics | `analytics` | — |
| Notifications | `notifications(...)` | — |

## Pagination, filtering, sorting

- **Cursor-based pagination**: every list returns a Relay-style connection with `edges { cursor node }`, `nodes`, `pageInfo`, and `totalCount`.
- **Sorting**: whitelisted fields per type via `sort: { field, direction }`.
- **Filtering**: typed input objects — e.g. `ApplicationFilter { status, company, search, createdAfter, createdBefore }`.
- **Batch loading**: DataLoaders coalesce lookups for profiles, applications, resumes, and per-application activity feeds.

## Example

```graphql
query Dashboard {
  me {
    email
    profile { fullName targetRole }
    stats { applications interviews }
  }
  applications(first: 10, filter: { status: "interview" }, sort: { field: DEADLINE, direction: ASC }) {
    totalCount
    edges {
      cursor
      node { id company role status deadline activities(first: 3) { type message createdAt } }
    }
    pageInfo { hasNextPage endCursor }
  }
  analytics {
    totalApplications
    byStatus { status count }
    applicationsPerWeek { date count }
    averageInterviewScore
  }
}
```

## Errors

Errors surface with a machine-readable `extensions.code`:

- `UNAUTHENTICATED` — missing or invalid bearer token
- `BAD_USER_INPUT` — validation failure
- `NOT_FOUND` — resource missing or not visible to the user

## Coexistence with REST

The GraphQL layer is additive. Existing server functions in `src/lib/*.functions.ts` and the shared resume route at `/r/:slug` continue to work exactly as before — GraphQL simply exposes another read/write surface on top of the same data.
