# NutriTrack Calorie Counter

This project has two parts:

- `backend`: Express API, Prisma, authentication, food/exercise routes, Gemini food analysis
- `frontend`: React + Vite app

Run the backend and frontend in two separate terminals.

## 1. Start the Backend

Open a terminal in the project root, then run:

```powershell
cd backend
npm.cmd install
node server.js
```

The backend should start on:

```text
http://127.0.0.1:5000
```

You can check it by opening:

```text
http://127.0.0.1:5000
```

Expected message:

```text
NutriTrack API is running
```

## 2. Start the Frontend

Open a second terminal in the project root, then run:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

The frontend should start on:

```text
http://127.0.0.1:5173
```

Open that URL in your browser to use the app.

## Notes for Windows PowerShell

Use `npm.cmd` instead of `npm` if PowerShell shows this error:

```text
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

So use:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```

## Required Backend Environment

Create or update `backend/.env` before running the backend.

Required values:

```env
DATABASE_URL="your_database_url"
DIRECT_URL="your_direct_database_url"
JWT_SECRET="your_jwt_secret"
GEMINI_API_KEY="your_gemini_api_key"
```

After changing `.env`, restart the backend.

## Useful Commands

Backend:

```powershell
cd backend
node server.js
```

Frontend development server:

```powershell
cd frontend
npm.cmd run dev
```

Frontend lint:

```powershell
cd frontend
npm.cmd run lint
```

Frontend production build:

```powershell
cd frontend
npm.cmd run build
```

## Sharing Online With ngrok

For testing from your phone, first run both servers.

Terminal 1:

```powershell
cd backend
node server.js
```

Terminal 2:

```powershell
cd frontend
npm.cmd run dev -- --host 0.0.0.0
```

Then expose the frontend:

```powershell
ngrok http (PORT NUMBER)

example - ngrok http 5173
```

Open the ngrok `https://...ngrok-free...` URL on your phone.

Important:

- For local phone testing, you do not need to edit code.
- You usually do not need `frontend/.env` for local ngrok testing because Vite proxies `/api` to `http://localhost:5000`.
- If you create or edit `frontend/.env`, restart the frontend server.

## Frontend API URL For Production

For real deployment, create `frontend/.env` or set the platform environment variable:

```env
VITE_API_URL=https://your-backend-domain.com
```

Do not add `/api` at the end.

Correct:

```env
VITE_API_URL=https://your-backend-domain.com
```

Wrong:

```env
VITE_API_URL=https://your-backend-domain.com/api
```

If frontend and backend are hosted on the same domain with `/api` routes or rewrites, `VITE_API_URL` can be left empty.
