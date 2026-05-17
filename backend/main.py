from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from openai import OpenAI
from typing import Optional
from geopy.geocoders import Nominatim
import base64
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

geolocator = Nominatim(user_agent="PinnicalGeoLocator")

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)

MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


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
    imageBase64 = base64.b64encode(imageBytes).decode("utf-8")

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
  "culture": "cultural region or influence visible",
  "historical_context": "brief historical or cultural significance",
  "description": "2-3 sentence description of the scene",
  "weather": "current weather conditions visible",
  "flora_fauna": ["list", "of", "visible", "plants", "or", "animals"],
  "confidence": 85
}}
{f'The image was taken at coordinates: {latitude}, {longitude} ({locationAddress}).' if locationAddress else ''}
Respond with only the JSON, nothing else."""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{imageBase64}"}}
                ],
            }]
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        print(f"Analysis result: {raw}")

        analysis = json.loads(raw)
        analysis["location"] = locationAddress or "Unknown"
        return analysis

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return {
            "error": "Failed to parse model response",
            "scene_type": "unknown", "culture": "unknown",
            "historical_context": "unavailable", "description": "Analysis failed",
            "weather": "unknown", "flora_fauna": [], "confidence": 0,
            "location": locationAddress or "Unknown"
        }
    except Exception as e:
        print(f"Vision model error: {e}")
        return {"error": str(e), "location": locationAddress or "Unknown"}


class ChatRequest(BaseModel):
    message: str
    image_base64: str | None = None


@app.post("/ai-chat")
def aiChat(req: ChatRequest):
    messages = [{
        "role": "system",
        "content": "You are a knowledgeable guide helping people understand places around the world. Be concise — 2-3 sentences max. No bullet points, no headers, just a short direct answer."
    }]

    if req.image_base64:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": req.message},
                {"type": "image_url", "image_url": {"url": req.image_base64}},
            ]
        })
    else:
        messages.append({"role": "user", "content": req.message})

    completion = client.chat.completions.create(
        model=MODEL,
        max_tokens=512,
        messages=messages
    )

    print(completion)

    text = completion.choices[0].message.content or ""
    if not text.strip():
        return {"response": "Sorry, I couldn't generate a response. Please try again."}

    return {"response": text.strip()}