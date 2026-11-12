"""FastAPI backend + static file server for the Network Traffic Analyzer.

Run locally:   uvicorn main:app --reload      then open http://127.0.0.1:8000
"""

import os
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from analysis import DEFAULT_STEPS, MAX_DEVICES, analyze

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Network Traffic Analyzer")

# Only needed if the frontend is hosted on a different domain than this
# backend. Set CORS_ORIGINS="https://my-site.netlify.app" in production.
# When the backend serves the page itself (the default), CORS is not used.
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    devices: list[str] = Field(min_length=2, max_length=MAX_DEVICES)
    matrix: list[Annotated[list[float], Field(max_length=MAX_DEVICES)]] = Field(
        max_length=MAX_DEVICES
    )
    steps: int = Field(default=DEFAULT_STEPS, ge=1, le=50)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
def analyze_traffic(req: AnalyzeRequest):
    try:
        return analyze(req.devices, req.matrix, req.steps)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))


# Must be registered last so it does not shadow the /api routes.
app.mount("/", StaticFiles(directory=BASE_DIR / "static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
