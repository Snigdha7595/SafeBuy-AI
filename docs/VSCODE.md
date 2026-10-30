# Run and check SafeBuy AI in VS Code

## 1. Open it
1. Unzip, then **File → Open Folder…** and choose the `safebuy-ai` folder (the one containing `frontend/` and `backend/`).
2. Accept the "install recommended extensions" prompt (Python, Tailwind CSS IntelliSense).
3. Install **Node 18+** and **Python 3.10+** if you don't have them (`node -v`, `python --version`).

## 2. One-time setup (Terminal → Run Task…)
- **Backend: create venv + install**, then **Frontend: npm install**.
- Pick the interpreter: **Ctrl+Shift+P → Python: Select Interpreter → `backend/.venv`**.

(Or by hand: `cd backend && python -m venv .venv`, activate it, `pip install -r requirements.txt`; `cd frontend && npm install`.)

## 3. Run
**Terminal → Run Task… → Run everything** starts the API (http://localhost:8000) and the app (http://localhost:5173). Open http://localhost:5173.

## 4. Check it works (about 5 minutes, no keys needed)
1. http://localhost:8000/api/health shows `"status":"ok"` and `"aiMode":"demo"`.
2. http://localhost:8000/docs lists every API route.
3. In the app: **Analyze a product → BassMax Pro Headphones**, enter budget `200`, **Analyze listing**. You should see 5 findings, a "rule-based" badge, and an affordability block.
4. **Save analysis**, then open **Saved analyses** and reopen it.
5. **Budget planner**: set 600 / 215, add a planned item, try the what-if calculator.
6. **Compare products** and **Settings** both load. Checkout shows the "PayPal isn't set up" screen until you add keys. That is correct.

## 5. Run the tests
- **Test: backend** task (98 tests) and **Test: frontend** task (42 tests), or the Testing sidebar for Python.

## 6. Turn on live AI and PayPal
1. Copy `.env.example` to `.env` in the project root.
2. Fill in `LLM_API_KEY` and, from the PayPal Developer Dashboard (Sandbox app), `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
3. Stop and re-run the backend task. `/api/health` should now show `"aiMode":"live"` and `"paypalConfigured":true`.
4. Analyze **Aurora ANC Headphones** → **Continue to checkout** → tick the approval box → pay with a **sandbox buyer** account.
5. **Purchase history** should show the payment as **Completed**.

## Troubleshooting
- **"Can't reach the SafeBuy server"**: the backend task isn't running, or it isn't on port 8000.
- **`ModuleNotFoundError`**: the wrong interpreter is selected, so re-select `backend/.venv`.
- **Port in use**: stop the old terminal, or change the port in the task and in `frontend/vite.config.ts`.
- **PayPal button never appears**: check the browser console, and confirm the keys are from a **Sandbox** app.
