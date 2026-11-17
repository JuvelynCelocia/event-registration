# Start here — Event Registration App (VS Code)

This folder is ready to open in Visual Studio Code.

It contains the full React + PHP event registration app, including the optional AI event assistant and AI recommendations.

## Requirements

- Node.js 18+ (this machine has Node 24)
- PHP 8+ on PATH (this machine has PHP 8.5)
- Windows PowerShell

No Composer, Laravel, XAMPP, or MySQL is needed. The backend is plain PHP and the database is SQLite.

## First-time setup

1. Open **this folder** in VS Code:
   - `File → Open Folder…` and choose `event-registration-app-vscode`, or
   - drag the folder onto the VS Code window.
2. Accept the recommended extensions when VS Code prompts (PHP Intelephense, Tailwind CSS IntelliSense, EditorConfig, PowerShell).
3. Open the Command Palette (`Ctrl+Shift+P`) → **Tasks: Run Task** → **1. Install frontend dependencies**.
   Wait for `npm install` to finish.

## Run the app

1. Command Palette → **Tasks: Run Task** → **Run full app (API + React)**.
2. Two terminals open:
   - PHP API on `http://127.0.0.1:8000/api`
   - Vite dev server on `http://localhost:5173`
3. Open `http://localhost:5173` in your browser.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | alex.santos@email.com | Password123 |
| Admin | admin@eventapp.test | Admin123 |

## AI assistant and recommendations (optional)

The app includes an "Ask AI" event assistant and a "Recommended for you" dashboard section. Both work with **no setup**: the PHP server answers from the real SQLite data using built-in rules.

To use a real AI provider:

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `AI_API_KEY` (and optionally `AI_BASE_URL` / `AI_MODEL`) in `backend/.env`.
3. Restart the **Start PHP API** task.

```dotenv
AI_API_KEY=your-key-here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_TIMEOUT=20
```

For local Ollama, leave the key empty and use `AI_BASE_URL=http://localhost:11434/v1`.

The key stays in the PHP process — it is never sent to the browser. If the provider is unreachable, the app falls back to rules automatically. See `README.md` for quota and cache details.

## Database

- File: `backend/storage/app.sqlite`
- Created and seeded automatically on first API start.
- Delete the file and restart the API to reset to the demo data.
- It is excluded from Git and hidden in the VS Code explorer by default.

## Stop the app

Click each terminal and press `Ctrl+C`, or use the trash icon in the terminal panel.

## Troubleshooting

- **Port already in use:** stop the old PHP/Vite terminals, or run `Get-NetTCPConnection -LocalPort 8000,5173` to find the process.
- **PHP not found:** make sure `php` is on PATH, then reopen the terminal.
- **SQLite errors:** always start the API with the **Start PHP API** task. It enables `pdo_sqlite` and `sqlite3` per process.
- **Blank page:** confirm both tasks are running and the API terminal says "Event Registration API running".

## Useful tasks

| Task | What it does |
|---|---|
| 1. Install frontend dependencies | `npm install` in `frontend` |
| 2. Start PHP API | Runs `backend/run.ps1` |
| 3. Start React app | Runs `npm run dev` |
| Run full app (API + React) | Starts both in parallel |
| Build production bundle | `npm run build` into `frontend/dist` |
