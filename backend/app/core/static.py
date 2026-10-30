"""Serve the built React app from the API process so one service hosts everything (used on Render)."""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def mount_frontend(app: FastAPI, dist: str | Path | None) -> bool:
    if not dist or not (Path(dist) / "index.html").exists():
        return False
    root = Path(dist).resolve()
    if (root / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=root / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        f = (root / path).resolve()
        if path and f.is_file() and root in f.parents:  # real static file (favicon, etc.), never outside dist
            return FileResponse(f)
        return FileResponse(root / "index.html")  # client-side routes

    return True
