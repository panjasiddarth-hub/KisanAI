# KisanAI backend

The Express API, agents, middleware, and database persistence layer live here.
For setup, environment variables, API endpoints, and the full repository layout,
see the [project README](../README.md).

## Source organization

- `src/agents/` — agricultural decision agents and AI integrations.
- `src/data/` — crop and disease knowledge bases.
- `src/config/` — MongoDB connection setup and in-memory fallback mode.
- `src/models/` — Mongoose schemas.
- `src/repositories/` — persistence operations shared by API routes.
- `src/middleware/` — request authentication.
- `src/routes/` — HTTP API endpoints.
