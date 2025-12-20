import os
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-3-flash")

def generate_ai_improved_transcript(transcript: str) -> str:
    prompt = f"""
You are an English speaking coach.
Improve clarity, fluency, and grammar.
Keep meaning same.

Transcript:
{transcript}
"""
    response = model.generate_content(prompt)
    if not response or not response.text:
        return ""
    return response.text.strip()
