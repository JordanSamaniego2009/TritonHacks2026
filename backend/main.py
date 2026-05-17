from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from huggingface_hub import InferenceClient
from PIL import Image
from typing import Optional
from geopy.geocoders import Nominatim
import base64
import io
import os
import json

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

hfToken = os.getenv("HF_TOKEN")
geolocator = Nominatim(user_agent="PinnicalGeoLocator")
client = InferenceClient(api_key=hfToken)

lastImageBase64 = None

@app.get("/")
def root():
    return {"message": "Backend is live"}

@app.post("/analyze")
async def analyzeImage(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None)
):
    global lastImageBase64

    imageBytes = await file.read()
    lastImageBase64 = base64.b64encode(imageBytes).decode("utf-8")

    locationAddress = None
    if latitude and longitude:
        try:
            geo = geolocator.reverse(f"{latitude}, {longitude}")
            locationAddress = geo.address
        except Exception as e:
            print(f"Geocode error: {e}")

    prompt = f"""Analyze this image and return ONLY a valid JSON object with no extra text, no markdown, no backticks. Use this exact structure:
{{
  "scene_type": "one of: urban, suburban, rural, wilderness, coastal, industrial, historical, mixed",
  "culture": "cultural region or influence visible (e.g. East Asian, Latin American, Middle Eastern, Western European, etc.)",
  "historical_context": "brief historical or cultural significance of what is visible",
  "description": "2-3 sentence description of the scene suitable for someone who cannot see it",
  "weather": "current weather conditions visible in the image (e.g. sunny, overcast, rainy, foggy, snowy)",
  "flora_fauna": ["list", "of", "visible", "plants", "or", "animals"],
  "confidence": 85
}}
{f'The image was taken at coordinates: {latitude}, {longitude} ({locationAddress}).' if locationAddress else ''}
Respond with only the JSON, nothing else."""

    try:
        response = client.chat.completions.create(
            model="Qwen/Qwen2.5-VL-7B-Instruct:cerebras",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{lastImageBase64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=999
        )

        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        print(f"Raw model output: {raw}")

        analysis = json.loads(raw)
        analysis["location"] = locationAddress or "Unknown"
        return analysis

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}\nRaw: {raw}")
        return {
            "error": "Failed to parse model response",
            "scene_type": "unknown",
            "culture": "unknown",
            "historical_context": "unavailable",
            "description": "Analysis failed",
            "weather": "unknown",
            "flora_fauna": [],
            "confidence": 0,
            "location": locationAddress or "Unknown"
        }

    except Exception as e:
        print(f"Vision model error: {e}")
        return {"error": str(e), "location": locationAddress or "Unknown"}


class ChatRequest(BaseModel):
    message: str

@app.post("/ai-chat")
def aiChat(req: ChatRequest):
    global lastImageBase64

    messages = [
        {
            "role": "system",
            "content": "You are a knowledgeable guide helping people understand places around the world. Be concise — 2-3 sentences max. No bullet points, no headers, just a short direct answer."
        }
    ]

    if lastImageBase64:
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": req.message
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{lastImageBase64}"
                    }
                }
            ]
        })
    else:
        messages.append({
            "role": "user",
            "content": req.message
        })

    completion = client.chat.completions.create(
        model="google/gemma-4-31B-it:novita",
        max_tokens=150,
        messages=messages,
    )


    text = completion.choices[0].message.content
    return {"response": text.strip()}