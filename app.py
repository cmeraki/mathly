import io
import time
import json
import uuid
import random
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import io
from PIL import Image
from typing import Optional

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


class ImageRequest(BaseModel):
    image: str  # for base64 encoded image
    text: Optional[str] = ""

@app.get("/health")
async def health() -> Response:
    return Response(status_code=200)


@app.post("/check")
async def check_answer(
    image: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    json_data: Optional[ImageRequest] = None
):
    image_data = None

    if image:
        # Handle multipart/form-data
        image_data = await image.read()
    elif json_data:
        # Handle base64 JSON data
        # Remove data URL prefix if present
        base64_str = json_data.image
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        image_data = base64.b64decode(base64_str)
    else:
        raise HTTPException(status_code=400, detail="No image provided")

    uploads_dir = Path("uploads")
    uploads_dir.mkdir(exist_ok=True)
    
    # Create unique filename using timestamp
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"image_{timestamp}.png"
    filepath = uploads_dir / filename
    
    # Method 1: Save directly from bytes
    with open(filepath, "wb") as f:
        f.write(image_data)
   
    return Response(
        content="yoo hoo",
        media_type="text"
    )

if __name__ == "__main__":
    import uvicorn
    import argparse

    parser = argparse.ArgumentParser()

    parser.add_argument('--port', type=int, default=8000, required=False, help='Port to run the server on')

    args =  parser.parse_args()

    server = uvicorn.Server(config=uvicorn.Config(app, host="0.0.0.0", port=args.port))

    server.run()