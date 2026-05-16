from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from huggingface_hub import InferenceClient
from transformers import pipeline
from PIL import Image
from typing import Optional
from geopy.geocoders import Nominatim
import io
import requests
import os

load_dotenv()

app = FastAPI()

classifier = pipeline(
    task="zero-shot-image-classification",
    model="geolocal/StreetCLIP"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

hfToken = os.getenv("HF_TOKEN")
geolocator = Nominatim(user_agent="fastapi_geocoder_app")
detectionModel = "https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224"

@app.get("/")
def root():
    return {"message": "Backend is live"}

@app.post("/analyze")
async def analyzeImage(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None)
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

    image = Image.open(io.BytesIO(imageBytes))

    choices = ["San Jose", "San Diego", "Los Angeles", "Las Vegas", "San Francisco"]

    secondaryResults = classifier(image, candidate_labels=choices)

    location = geolocator.reverse(f"{latitude}, {longitude}")
    print(latitude)
    print(longitude)
    print(location.address)
    print(f"secondary results: {secondaryResults}")

    label = result.get("label", "unknown")
    confidence = round(result.get("score", 0) * 100, 1)

    print(f"Label: {label}, Confidence: {confidence}")
    
    return {"label": label, "confidence": confidence, "location": location.address}

client = InferenceClient(api_key=hfToken)

class ChatRequest(BaseModel):
    message: str

@app.post("/ai-chat")
def aiChat(req: ChatRequest):
    completion = client.chat.completions.create(
        model="deepseek-ai/DeepSeek-V4-Flash:novita",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant for anything to be honest. Keep responses concise and practical."
            },
            {
                "role": "user",
                "content": req.message
            }
        ],
    )
    
    text = completion.choices[0].message.content
    return {"response": text.strip()}