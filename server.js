from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import requests

app = FastAPI()

# CORS: allow your front-end to call this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["https://your-frontend.onrender.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3 Gemini keys from environment (Render → Environment)
GEMINI_KEYS = [
    os.getenv("GEMINI_KEY_1"),
    os.getenv("GEMINI_KEY_2"),
    os.getenv("GEMINI_KEY_3"),
]

GEMINI_MODEL_NAME = "gemini-pro"  # or your chosen model


class ChatPayload(BaseModel):
    # This will match exactly what your front-end sends:
    # { contents: [...], tools: [...], systemInstruction: {...} }
    contents: dict | list
    tools: list | None = None
    systemInstruction: dict | None = None


def call_gemini_with_fallback(raw_payload: dict):
    """
    Try GEMINI_KEY_1 → if fail → GEMINI_KEY_2 → if fail → GEMINI_KEY_3
    """
    last_error = None

    for key in GEMINI_KEYS:
        if not key:
            continue  # skip empty ones

        try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{GEMINI_MODEL_NAME}:generateContent?key={key}"
            )

            # raw_payload already has: contents, tools, systemInstruction
            response = requests.post(
                url,
                json=raw_payload,
                timeout=20,
            )

            # If OK → return result immediately
            if response.status_code == 200:
                return response.json()

            # If not OK → remember error and try next key
            last_error = f"status={response.status_code}, body={response.text}"
            print(f"[Gemini] Key failed, trying next one... ({last_error})")

        except Exception as e:
            last_error = str(e)
            print(f"[Gemini] Exception with key, trying next one... ({last_error})")

    # If all keys failed:
    raise HTTPException(
        status_code=500,
        detail=f"All Gemini API keys failed. Last error: {last_error}",
    )


@app.post("/api/chat")
def chat_with_suzi(payload: dict):
    """
    This endpoint is called by your front-end: fetch('/api/chat', { body: JSON.stringify(payload) })
    We don't change payload structure, we just forward to Gemini with fallback keys.
    """
    try:
        result = call_gemini_with_fallback(payload)
        return result
    except HTTPException as e:
        # Let FastAPI send this as JSON { "detail": "..."}
        raise e
    except Exception as e:
        print("[/api/chat] Unexpected error:", str(e))
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")
