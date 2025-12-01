import os
import base64
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

print("HF_ENDPOINT_URL =", HF_ENDPOINT_URL)
print("HF_TOKEN =", HF_TOKEN)


HF_ENDPOINT_URL = os.getenv("HF_ENDPOINT_URL")
HF_TOKEN = os.getenv("HF_TOKEN")

app = FastAPI()

# Allow your front-end origin (adjust port if needed)
origins = [
    "http://127.0.0.1:5500",  # VS Code Live Server default
    "http://localhost:5500",
    "http://127.0.0.1:8000",  # if you serve index.html some other way
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SketchParams(BaseModel):
    # for now just a prompt; later you can send your 9 parameters and build it
    prompt: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-image")
def generate_image(params: SketchParams):
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "inputs": params.prompt,
        "parameters": {
            "num_inference_steps": 30,
            "guidance_scale": 7.5
        }
    }

    r = requests.post(HF_ENDPOINT_URL, headers=headers, json=payload)
    if r.status_code != 200:
        return {"error": r.text}

    img_b64 = base64.b64encode(r.content).decode("utf-8")
    return {
        "prompt": params.prompt,
        "image_base64": img_b64
    }
