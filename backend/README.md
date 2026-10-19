# Todo Management API

NestJS API foundation for the Todo Management Application. It includes Prisma 7 with SQLite, the initial user/task models, and JWT authentication with rotating refresh sessions.

## Requirements

- Node.js 22.18 or newer
- npm

## Install and migrate

From PowerShell:

```powershell
cd D:\workspace\todo-assignment\backend
npm install
$env:DATABASE_URL = 'file:./dev.db'
npm run prisma:generate
npm run prisma:migrate:dev -- --name add_rbac_profiles_notifications
npm run start:dev:local
```

`npm install` updates the lockfile with the authentication and CASL dependencies. This migration extends the existing user/task/auth schema with roles, profile fields, task creators, and notifications.

The Prisma config and runtime use `file:./dev.db` when `DATABASE_URL` is not set. `.env.example` documents the database URL and authentication variable names; it contains no secret values. The SQLite database file is ignored by Git. The migration adds custom roles and permissions, profile fields, task creator tracking, and in-app notifications.

## Authentication configuration

The app reads authentication keys from the process environment and does not load `.env` files. The API can start without JWT keys, but authentication endpoints return `503` until `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are provided by the developer at runtime. Each must contain at least 32 bytes. Access tokens last 15 minutes by default; refresh sessions last 7 days. `BCRYPT_ROUNDS` defaults to 12 and accepts values from 10 through 14.

For local development, run `npm run start:dev:local`. This generates temporary random JWT keys in memory and starts the watch server without displaying or saving the keys. The keys change on every start, so existing local sessions will expire when the server restarts. Use stable keys from a deployment secret manager for production and `npm run start:dev`.

## Authentication endpoints

- `POST /api/auth/register` — creates a `USER` account, returns an access token, and sets the refresh token in an HttpOnly cookie.
- `POST /api/auth/login` — verifies the password hash, returns an access token, and creates a refresh session.
- `POST /api/auth/refresh` — reads and rotates the HttpOnly refresh cookie.
- `POST /api/auth/logout` — revokes the refresh session and clears the cookie; access tokens from that session are rejected immediately.
- `GET /api/auth/me` — protected example route; send `Authorization: Bearer <accessToken>`.

Protected feature routes include `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`, `GET/PATCH /api/users/me`, `GET /api/users`, `PATCH /api/users/:id/role`, `DELETE /api/users/:id`, `GET/POST /api/roles`, `PATCH/DELETE /api/roles/:id`, `GET /api/notifications`, and `PATCH /api/notifications/:id/read`.

The refresh token is stored only as a SHA-256 hash in SQLite and is never included in a JSON response. Refresh rotation uses a compare-and-swap update to reject concurrent reuse. CASL rules are enforced by the API for tasks, users, and role administration; frontend permissions only control presentation.

## Authorization and modules

- `AuthorizationModule` creates CASL abilities. `PoliciesGuard` protects role and user administration endpoints.
- `ADMIN` can manage tasks, users, and roles.
- `MANAGER` can create and edit tasks for any registered user and read the user list.
- `USER` can read and complete tasks assigned to them.
- `RolesModule` manages custom roles and their CASL actions.
- `TasksModule` provides paginated, searchable task CRUD.
- `UsersModule` manages a user's own profile and administrator role assignments.
- `NotificationsModule` stores in-app task assignment notifications and exposes console, mock email, and mock Firebase providers.

The notification and avatar features use database records and an HTTPS avatar URL respectively. They do not require email, Firebase, or file-storage credentials.

## First administrator and manager accounts

Public registration always creates a normal `USER`. Register the first account, then promote it once from the backend directory:

```powershell
npm run admin:bootstrap -- --email account@example.com
```

The command refuses to run once an administrator exists. After signing in as that administrator, assign `MANAGER` or a custom role in the Users area. Do not expose a public manager registration link. For a deployed product, the right onboarding flow is an administrator-triggered, expiring, single-use invitation that lets the manager set their own password.

## Other commands

```powershell
npm run prisma:migrate:deploy
npm run prisma:generate
npm run build
npm test
```

The health endpoint is `GET http://localhost:3000/api/health`.
