# Network Traffic Analyzer

Explore traffic relationships between devices with an interactive network matrix. The app calculates node importance, projects the network into two dimensions, and estimates traffic shares over repeated steps.

**Live app:** [https://netsecure.vercel.app/](https://netsecure.vercel.app/)  
**Source code:** [SPETER2009/Net-Secure](https://github.com/SPETER2009/Net-Secure)

## Features

- Edit device names and traffic values in an interactive matrix.
- Add, remove, randomize, or clear devices and traffic.
- Keep traffic symmetric, so the value from A to B also applies from B to A.
- Import and export traffic matrices as CSV.
- View eigenvector-based device importance, a 2D projection, and a traffic-share forecast.
- See a results table with each device's importance, total traffic, and 2D coordinates.
- Use the responsive interface in light or dark mode.

> This app analyzes traffic values that you enter or import. It does not capture or monitor live network packets.

## How it works

The browser sends the device names and traffic matrix to the FastAPI endpoint. The Python backend uses NumPy to calculate the results, which the page displays with Chart.js.

1. **Node importance:** eigenvector centrality, normalized to sum to 1.
2. **2D view:** each device is projected using the matrix's two eigenvectors with the largest absolute eigenvalues.
3. **Traffic prediction:** the traffic matrix is repeatedly applied to an initially equal share across devices.

For nonsymmetric matrices, the analysis uses the average of the matrix and its transpose for the eigenvalue calculations and per-device traffic totals. The forecast uses the matrix as submitted.

## Use the live app

Open [netsecure.vercel.app](https://netsecure.vercel.app/), enter or import a matrix, and select **Analyze network**. A sample network is loaded when the page opens.

The deployed API is available at:

- Health check: [https://netsecure.vercel.app/api/health](https://netsecure.vercel.app/api/health)
- Analysis: `POST https://netsecure.vercel.app/api/analyze`

## Run locally

Requires Python 3.10 or later.

### Windows PowerShell

```powershell
cd path\to\Net-Secure
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

If PowerShell prevents activation, you can invoke the virtual environment directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

### macOS or Linux

```bash
cd path/to/Net-Secure
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000/) in your browser. The interactive API documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## API

### `GET /api/health`

Returns a simple health status:

```json
{"status": "ok"}
```

### `POST /api/analyze`

Request body:

```json
{
  "devices": ["PC1", "PC2", "Server1"],
  "matrix": [
    [0, 50, 200],
    [50, 0, 30],
    [200, 30, 0]
  ],
  "steps": 10
}
```

`steps` is optional and defaults to `10`; accepted values are from 1 to 50. The API accepts 2 to 20 devices. Device names must be nonempty and unique, and the matrix must be square with finite, nonnegative numbers and at least one nonzero value.

Example using curl:

```bash
curl -X POST http://127.0.0.1:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"devices":["A","B"],"matrix":[[0,10],[10,0]]}'
```

The response contains:

| Field | Description |
| --- | --- |
| `devices` | Validated device names |
| `importance` | Normalized importance score for each device |
| `top_device` | Device with the highest importance |
| `reduced` | Two coordinates per device |
| `kept_by_2d` | Share of matrix strength represented by the two components |
| `eigenvalues` | Eigenvalues used in the projection |
| `history` | Traffic shares from the initial state through each prediction step |
| `traffic_total` | Total traffic associated with each device |

Invalid input returns an HTTP error with a readable `detail` message.

## Deployments

The production site is hosted at [https://netsecure.vercel.app/](https://netsecure.vercel.app/). To publish updates, push changes to the Git branch connected to the Vercel project. Check the Vercel project settings and deployment logs if the expected commit does not appear on the live site.

The application also supports running as a conventional FastAPI web service. For example, on a host that provides a `PORT` environment variable, use:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

The backend serves the page from `static/` and exposes the API on the same origin. If you host the frontend and backend on different origins, set `API_BASE` near the top of `static/script.js` to the backend URL and configure the backend's `CORS_ORIGINS` environment variable to allow the frontend's origin.

## Project structure

| Path | Purpose |
| --- | --- |
| `main.py` | FastAPI application, API routes, and local static-file hosting |
| `analysis.py` | Input validation and NumPy analysis |
| `static/index.html` | Page structure |
| `static/style.css` | Responsive styling and color themes |
| `static/script.js` | Matrix editor, CSV handling, API requests, and charts |
| `requirements.txt` | Python dependencies |

## Tech stack

- Python, FastAPI, and Pydantic
- NumPy
- HTML, CSS, and JavaScript
- Chart.js
