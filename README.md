# Network Traffic Analyzer (web version)

Enter the traffic between your devices and get:

1. **Node importance** - which device is the most important (dominant eigenvector).
2. **2D view** - every device reduced to two numbers (top-2 eigenvectors).
3. **Traffic prediction** - traffic shares over repeated steps (power method).

```
Browser (static/index.html, style.css, script.js)
   |  POST /api/analyze  {devices, matrix}
   v
FastAPI (main.py)  ->  analysis.py (numpy)  ->  JSON result  ->  Chart.js charts
```

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://127.0.0.1:8000. The same server serves the page and the API, so
there are no CORS problems and no API key to manage.

Interactive API docs: http://127.0.0.1:8000/docs

## API

`POST /api/analyze`

```json
{
  "devices": ["PC1", "PC2", "Server1"],
  "matrix": [[0, 50, 200], [50, 0, 30], [200, 30, 0]]
}
```

Returns `importance`, `top_device`, `reduced`, `kept_by_2d`, `eigenvalues`,
`history` (prediction steps) and `traffic_total`. Bad input returns HTTP 400
with a readable `detail` message.

## Deploy (Render, easiest)

1. Push this folder to a GitHub repository.
2. On https://render.com create a **New Web Service** from that repo.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Deploy. Your site is live at the URL Render gives you.

Railway and Fly.io work the same way (same build and start commands).

### Frontend and backend on different hosts (optional)

1. Host the `static/` folder on Netlify or GitHub Pages.
2. In `static/script.js`, set `API_BASE` to your backend URL.
3. On the backend, set the environment variable
   `CORS_ORIGINS=https://your-frontend-site.netlify.app`.

## About API keys

Your own frontend calling your own backend does not need one. Anything placed
in browser JavaScript can be read by every visitor, so a key there protects
nothing. Use a key only for secrets the *server* uses (for example a third-party
service), read it from an environment variable, and never put it in the HTML/JS.

## Files

| File | Purpose |
| --- | --- |
| `analysis.py` | The math (numpy only) |
| `main.py` | FastAPI app: `/api/analyze` and static file hosting |
| `static/index.html` | Page structure |
| `static/style.css` | Styling (light and dark mode) |
| `static/script.js` | Matrix editor, CSV import/export, API call, charts |
| `requirements.txt` | Python dependencies |
