# OS Deadlock Analysis Dashboard

A user-input-driven React + Vite + TypeScript frontend with a Python FastAPI algorithm backend. It demonstrates Banker’s safety algorithm, resource request decisions, deadlock detection for single- and multiple-instance models, process-termination recovery, global resource ordering, and boundary tests.

## Requirements
- Python 3.10+ (3.12 recommended)
- Node.js 20+ and npm

## Run locally on Windows PowerShell
Open two terminals from the project root.

### 1. Backend
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Health check: http://127.0.0.1:8000/health
Interactive API docs: http://127.0.0.1:8000/docs

Run backend tests in another terminal:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest -v
```

### 2. Frontend
```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```
Open the Vite URL shown in the terminal (normally http://localhost:5173). Set `VITE_API_BASE_URL` in `frontend/.env.local` to the backend origin if it differs. Restart Vite after changing env values.

## Sample result verification
Default sample uses five processes and three resources, Allocation/Maximum from the assignment, and Available `[3,3,2]`. Expected safety sequence is `P1 → P3 → P4 → P0 → P2`. P0 request `[0,4,0]` must be `WAITING/DEFERRED`; P0 request `[0,3,0]` must be `DENIED` with state unchanged. These expectations are covered by pytest tests.

## Cloud deployment

### Backend on Render
1. Push this folder to a Git repository.
2. In Render, create a Web Service from the repository and choose Docker.
3. Set Dockerfile path to `backend/Dockerfile` and health-check path `/health`.
4. Set `CORS_ORIGINS` to the exact deployed frontend origin (for example `https://your-app.vercel.app`). No API secrets are required.
5. Deploy and verify `https://YOUR-API.onrender.com/health` returns `{"status":"ok",...}`.

A `backend/render.yaml` example is included; review paths/settings in Render if using a monorepo. The service listens on Render's `PORT`.

### Frontend on Vercel
1. Import the repository into Vercel and set the project root to `frontend`.
2. Framework preset: Vite. Build command `npm run build`, output directory `dist`.
3. Set environment variable `VITE_API_BASE_URL=https://YOUR-API.onrender.com` (no trailing slash).
4. Deploy, then update backend `CORS_ORIGINS` to the exact Vercel URL and redeploy/restart the backend.
5. Verify the UI and browser network requests. `frontend/vercel.json` includes SPA rewrites.

Never use a real credential in committed environment files. Frontend variables prefixed with `VITE_` are public by design; do not put secrets there.

## API endpoints
- `GET /health`
- `POST /api/safety`
- `POST /api/request`
- `POST /api/detection/multiple`
- `POST /api/detection/single`
- `POST /api/recovery`
- `POST /api/prevention/order`

## Notes and limitations
- No database is needed: all computation is stateless and runs on request. There is no persistent history store.
- Recovery models terminating one process by releasing its current allocation; a terminated process's maximum claim is set to zero for the post-recovery safety calculation. Real systems need application-specific restart/cleanup policy.
- Multiple-instance detection uses the standard Work/Finish detection model and interprets unfinished processes as deadlocked under the supplied outstanding-request model.
- Resource ordering is a demonstration validator; it checks acquisition sequence against a configured global order, not a live operating-system lock manager.
- Boundary test page calls the running backend and only reports actual responses. Pytest results should be recorded from the local run, not inferred from UI screenshots.

## Troubleshooting
- **CORS error:** make sure `CORS_ORIGINS` contains the frontend origin exactly, including scheme and no path.
- **Network error:** check backend is running and `VITE_API_BASE_URL` is correct; restart Vite after env changes.
- **PowerShell activation blocked:** use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal, then activate the venv.
- **pytest import error:** run pytest from the `backend` directory after installing requirements.
- **npm build fails:** use Node.js 20+ and run `npm install` again inside `frontend`.
- **Render cold start:** the free service may sleep; the first request can take longer.

## Assignment documentation
See `docs/ASSIGNMENT_REPORT.md` and `docs/AI_USAGE_RECORD.md`. Capture your own screenshots using the checklist in the dashboard/report; no fabricated screenshots are included.
