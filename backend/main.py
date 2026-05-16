from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import requests
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

hfToken = os.getenv("HF_TOKEN")
detectionModel = "https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224"

@app.get("/")
def root():
    return {"message": "Backend is live"}

@app.post("/analyze")
async def analyzeImage(
    file: UploadFile = File(...)
):
    imageBytes = await file.read()

    headers = {
        "Authorization": f"Bearer {hfToken}",
        "Content-Type": "image/jpeg"
    }

    response = requests.post(detectionModel, headers=headers, data=imageBytes)

    if response.status_code != 200 or not response.text:
        return {"error": f"HF API Issue: {response.status_code} - {response.text}"}
    
    results = response.json()
    result = results[0] if isinstance(results, list) else results

    label = result.get("label", "unknown")
    confidence = round(result.get("score", 0) * 100, 1)

    print(f"Label: {label}, Confidence: {confidence}")
    
    return {"label": label, "confidence": confidence}