import os
from pathlib import Path

from dotenv import load_dotenv

try:
    from google import genai as google_genai
except ImportError:
    google_genai = None

env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_path)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")
MIN_TRANSCRIPT_WORDS = 15


def generate_ai_improved_transcript(transcript: str) -> str:
    """
    Improve grammar, clarity, and fluency without changing the speaker's meaning.
    Returns an empty string when Gemini is unavailable or fails.
    """
    transcript = (transcript or "").strip()
    if len(transcript.split()) < MIN_TRANSCRIPT_WORDS:
        return ""

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Gemini AI skipped: GEMINI_API_KEY is not configured")
        return ""

    prompt = f"""
You are a speech improvement assistant.

Improve the following spoken transcript by:
- Fixing grammar mistakes
- Making sentences clearer and more fluent
- Keeping the original meaning
- Not adding extra information
- Not summarizing

Transcript:
\"\"\"{transcript}\"\"\"

Return only the improved transcript.
"""

    try:
        if google_genai is not None:
            client = google_genai.Client(api_key=api_key)
            interaction = client.interactions.create(
                model=GEMINI_MODEL,
                input=prompt,
            )
            return (getattr(interaction, "output_text", "") or "").strip()

        try:
            import google.generativeai as legacy_genai
        except ImportError:
            print("Gemini AI skipped: no Gemini SDK is installed")
            return ""

        legacy_genai.configure(api_key=api_key)
        model = legacy_genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        return (getattr(response, "text", "") or "").strip()
    except Exception as exc:
        print(f"Gemini AI error: {exc.__class__.__name__}")
        return ""
