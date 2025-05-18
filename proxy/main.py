import os
import time
from pathlib import Path
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates

from models.file import CheckRequest

app = FastAPI()
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Jinja2 templates for rendering the upload form
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Serve uploaded files if needed
app.mount("/files/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/files", response_class=HTMLResponse)
async def form():
    return templates.TemplateResponse("upload.html", {"request": {}})

@app.post("/files/check")
async def check_existing(req: CheckRequest):
    skipped = []
    for rel in req.paths:
        dest = UPLOAD_DIR / rel
        if dest.exists():
            skipped.append(rel)
    need = [p for p in req.paths if p not in skipped]
    return {"need_upload": need, "already_exists": skipped}

@app.post("/files")
async def upload(files: list[UploadFile] = File(...)):
    """
    Receives a list of UploadFile objects, each whose .filename carries the relative path
    (due to webkitRelativePath used as the "filename" in FormData).
    """
    if not files:
        return JSONResponse({"error": "No files uploaded"}, status_code=400)

    saved = []
    skipped = []
    for upload in files:
        rel_path = upload.filename  # e.g. "my-folder/sub/file.txt"
        # Recreate subdirectories under uploads/
        folder = UPLOAD_DIR / Path(rel_path).parent
        folder.mkdir(parents=True, exist_ok=True)

        # Use original filename (leaf) without timestamp
        leaf = Path(rel_path).name
        dest = folder / leaf

        # Skip if file already exists
        if dest.exists():
            skipped.append(str(dest.relative_to(BASE_DIR)))
            continue

        # Save new file
        with open(dest, "wb") as f:
            f.write(await upload.read())
        saved.append(str(dest.relative_to(BASE_DIR)))


    return {
        "message": f"Saved {len(saved)} files, skipped {len(skipped)} existing",
        "saved": saved,
        "skipped": skipped
    }


if __name__ == "__main__":
    import uvicorn
    # Run the server with hot reload
    uvicorn.run('main:app', host="0.0.0.0", port=8000, reload=True)