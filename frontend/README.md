# Todo Management Web

React and TypeScript frontend built with Vite. It includes account registration and login, refresh-cookie session restoration, protected routes, a shared Axios client, role-aware CASL navigation, task management, profile editing, and in-app notifications.

## Requirements

- Node.js 22.12 or newer
- npm
- The NestJS backend running on `http://localhost:3000`; Vite proxies local `/api` requests to it

## Start the frontend

```powershell
cd D:\workspace\todo-assignment\frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The overview checks `GET /api/health` through the Vite development proxy.

## Authentication

- Register at `/register` and sign in at `/login`.
- The access token stays in memory and is sent as a bearer token. It is not written to browser storage.
- The API sets the refresh token as an HttpOnly cookie; the frontend sends it with credentialed same-origin API requests.
- After a reload, the frontend calls `POST /api/auth/refresh` to restore the session. Sign out calls `POST /api/auth/logout`.
- The backend must be configured with its own runtime authentication settings. The frontend does not contain or require JWT, database, email, or Firebase credentials.
- CASL controls which actions the UI presents. The backend remains responsible for enforcing authorization.
- The sidebar is built from the current user's CASL permissions. Administrators can manage users and roles; managers can assign and manage tasks; users can read and complete their assigned tasks.
- Profile pictures currently use an HTTPS URL. Add a storage provider and upload flow when credentials and hosting are selected.
- The notification bell shows in-app task assignment notifications. The API logs through console and mock email/Firebase providers without external credentials.

## Build and type-check

```powershell
npm run typecheck
npm run build
```

`VITE_API_BASE_URL` is a browser-visible URL setting, not a place for credentials. Authorization enforced by the API remains authoritative; CASL in this app only controls presentation.



