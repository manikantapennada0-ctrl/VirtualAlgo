import os
import re
import logging
from typing import Optional
from urllib.parse import quote

import cv2
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from detector import VisualGroundingEngine

class KeyTestRequest(BaseModel):
    api_key: str

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VisualAlgoServer")

app = FastAPI(title="VisualAlgo - OpenCV + LLM Visual Grounding")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

engine = VisualGroundingEngine()

os.makedirs("static", exist_ok=True)
os.makedirs("static/samples", exist_ok=True)
os.makedirs("samples", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")

DEFAULT_QUESTIONS = {
    "traffic_light": "Is the traffic light red?",
    "cyclist": "Find the person riding a bicycle",
    "dog": "What type of animal is this?",
    "helmet": "Find the person wearing a helmet",
    "plate": "Identify the car's license plate",
    "license": "Identify the car's license plate",
    "sign": "Read the text on the signboard",
    "umbrella": "Find the person holding an umbrella",
    "fire": "Find the fire in the image"
}


def _safe_filename(name: Optional[str], fallback: str = "upload.jpg") -> str:
    base = os.path.basename(name or fallback) or fallback
    cleaned = re.sub(r"[^\w.\- ]+", "_", base).strip(" ._")
    if not cleaned:
        cleaned = fallback
    root, ext = os.path.splitext(cleaned)
    if ext.lower() not in IMAGE_EXTS:
        cleaned = f"{root or 'upload'}.jpg"
    return cleaned


def _safe_prefix(name: str) -> str:
    prefix = re.sub(r"[^\w.\-]+", "_", name).strip("_")
    return prefix or "upload"


def _question_for(base: str) -> str:
    lower = base.lower()
    for key, val in DEFAULT_QUESTIONS.items():
        if key in lower:
            return val
    clean_name = base.replace("_", " ").replace("-", " ").title()
    return f"Detect and highlight all objects in {clean_name}"


def _icon_for(base: str) -> str:
    lower = base.lower()
    if any(w in lower for w in ["traffic", "light"]):
        return "🚦"
    if any(w in lower for w in ["dog", "cat", "animal"]):
        return "🐕"
    if any(w in lower for w in ["bike", "cyclist"]):
        return "🚴"
    if any(w in lower for w in ["car", "plate", "license", "bmw", "dodge"]):
        return "🚗"
    if any(w in lower for w in ["fire", "flame"]):
        return "🔥"
    if any(w in lower for w in ["sign", "board"]):
        return "🪧"
    if any(w in lower for w in ["helmet", "worker"]):
        return "🦺"
    if any(w in lower for w in ["umbrella", "rain"]):
        return "☂️"
    return "🖼️"


def _find_sample_image(sample_id: str) -> Optional[str]:
    if not sample_id:
        return None
    sample_id = sample_id.strip()
    folders = ["samples", "static/samples"]
    for folder in folders:
        direct = os.path.join(folder, sample_id)
        if os.path.isfile(direct):
            return direct
        for ext in IMAGE_EXTS:
            candidate = os.path.join(folder, f"{sample_id}{ext}")
            if os.path.isfile(candidate):
                return candidate

    needle = sample_id.lower()
    for folder in folders:
        if not os.path.isdir(folder):
            continue
        for fname in os.listdir(folder):
            if not fname.lower().endswith(IMAGE_EXTS):
                continue
            base = os.path.splitext(fname)[0]
            if fname.lower() == needle or base.lower() == needle:
                return os.path.join(folder, fname)
    return None


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>VisualAlgo Server running. index.html not found in static/.</h1>")


@app.get("/api/samples")
async def get_samples():
    """Dynamically scan the samples/ directory and return all images."""
    samples = []
    dirs_to_check = ["samples", "static/samples"]
    seen_files = set()

    for sdir in dirs_to_check:
        if not os.path.isdir(sdir):
            continue
        for fname in sorted(os.listdir(sdir)):
            if not fname.lower().endswith(IMAGE_EXTS) or fname.lower() in seen_files:
                continue
            seen_files.add(fname.lower())
            base = os.path.splitext(fname)[0]
            in_root = os.path.exists(os.path.join("samples", fname))
            encoded = quote(fname)
            samples.append({
                "id": base,
                "filename": fname,
                "title": base.replace("_", " ").replace("-", " ").title(),
                "question": _question_for(base),
                "image_url": f"/samples/{encoded}" if in_root else f"/static/samples/{encoded}",
                "icon": _icon_for(base),
                "description": f"Image from sample folder ({fname})"
            })

    return JSONResponse({"samples": samples, "folder": "samples/"})


@app.post("/api/upload_to_samples")
async def upload_to_samples(file: UploadFile = File(...)):
    """Allow user to upload an image directly into the sample folder."""
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    os.makedirs("samples", exist_ok=True)
    filename = _safe_filename(file.filename)
    dest_path = os.path.join("samples", filename)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    with open(dest_path, "wb") as f:
        f.write(content)

    return JSONResponse({
        "success": True,
        "filename": filename,
        "url": f"/samples/{quote(filename)}",
        "message": f"Successfully stored {filename} in samples/ folder"
    })


@app.post("/api/analyze_sample")
async def analyze_sample(
    sample_id: str = Form(...),
    question: Optional[str] = Form(None),
    mode: str = Form("task_focused"),
    api_key: Optional[str] = Form(None)
):
    sample_img_path = _find_sample_image(sample_id)
    if not sample_img_path:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_id}' not found in samples/ directory.")

    with open(sample_img_path, "rb") as f:
        img_bytes = f.read()

    sample_base = os.path.splitext(os.path.basename(sample_img_path))[0]
    active_question = question.strip() if question and question.strip() else _question_for(sample_base)
    mode = mode if mode in ("task_focused", "all_objects", "hybrid") else "task_focused"

    try:
        result = engine.analyze(
            image_bytes=img_bytes,
            question=active_question,
            mode=mode,
            api_key=api_key or None,
            save_to_disk=True,
            output_dir="outputs",
            prefix=f"sample_{_safe_prefix(sample_base)}"
        )
        return JSONResponse(result)
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze")
async def analyze_upload(
    image: UploadFile = File(...),
    question: str = Form(...),
    mode: str = Form("task_focused"),
    api_key: Optional[str] = Form(None)
):
    if not image:
        raise HTTPException(status_code=400, detail="No image file provided.")

    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    img_bytes = await image.read()
    if len(img_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename = _safe_filename(image.filename)
    safe_prefix = _safe_prefix(os.path.splitext(filename)[0])
    mode = mode if mode in ("task_focused", "all_objects", "hybrid") else "task_focused"

    try:
        result = engine.analyze(
            image_bytes=img_bytes,
            question=question.strip(),
            mode=mode,
            api_key=api_key.strip() if api_key and api_key.strip() else None,
            save_to_disk=True,
            output_dir="outputs",
            prefix=safe_prefix
        )
        return JSONResponse(result)
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/outputs")
async def list_outputs():
    """List all output files currently stored in the outputs directory."""
    files = []
    if os.path.exists("outputs"):
        for fname in sorted(os.listdir("outputs"), reverse=True):
            fpath = os.path.join("outputs", fname)
            if os.path.isfile(fpath):
                lower = fname.lower()
                if lower.endswith((".jpg", ".png", ".jpeg", ".webp")):
                    ftype = "image"
                elif lower.endswith(".json"):
                    ftype = "json"
                else:
                    ftype = "other"
                files.append({
                    "filename": fname,
                    "url": f"/outputs/{quote(fname)}",
                    "size_bytes": os.path.getsize(fpath),
                    "type": ftype
                })
    return {"output_folder": "outputs", "total_files": len(files), "files": files}


@app.post("/api/test_key")
async def test_key(payload: KeyTestRequest):
    """Validate a Gemini API key with a test ping."""
    key = (payload.api_key or "").strip()
    if not key:
        return JSONResponse({"valid": False, "message": "API key cannot be empty."})

    try:
        from google import genai
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model="gemini-flash-latest",
            contents="Say 'OK'"
        )
        if resp and resp.text:
            engine.default_api_key = key
            return JSONResponse({"valid": True, "message": "API key is valid and connected to Gemini!"})
        return JSONResponse({"valid": False, "message": "No response from Gemini API."})
    except Exception as e:
        return JSONResponse({"valid": False, "message": f"Validation failed: {str(e)}"})


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "opencv_version": cv2.__version__,
        "has_default_api_key": bool(engine.default_api_key)
    }


app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/samples", StaticFiles(directory="samples"), name="samples")
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
