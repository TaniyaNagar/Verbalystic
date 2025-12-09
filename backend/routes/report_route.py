# routes/report_route.py
import os
import requests
from fastapi import APIRouter, HTTPException

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}


@router.get("/get-latest-report/{user_id}")
def get_latest_report(user_id: str):

    # 1) Fetch latest session
    session_url = f"{SUPABASE_URL}/rest/v1/sessions?user_id=eq.{user_id}&order=session_at.desc&limit=1"
    session_res = requests.get(session_url, headers=HEADERS)

    if session_res.status_code != 200:
        raise HTTPException(500, "Error fetching sessions from Supabase")

    sessions = session_res.json()
    if len(sessions) == 0:
        raise HTTPException(404, "No sessions found")

    session = sessions[0]
    session_id = session["id"]

    # 2) Fetch analysis report for the session
    analysis_url = f"{SUPABASE_URL}/rest/v1/analysis_report?session_id=eq.{session_id}&limit=1"
    analysis_res = requests.get(analysis_url, headers=HEADERS)

    if analysis_res.status_code != 200:
        raise HTTPException(500, "Error fetching analysis report")

    analysis_list = analysis_res.json()
    if len(analysis_list) == 0:
        raise HTTPException(404, "Analysis report not found")

    analysis = analysis_list[0]

    # 3) Merge both tables
    merged = {
        # SESSION INFO
        "avg_wpm": session.get("avg_wpm"),
        "filler_word_count": session.get("filler_word_count"),
        "pronunciation_score": session.get("pronunciation_score"),
        "tone_score": session.get("tone_score"),
        "transcript": session.get("transcript"),

        # ANALYSIS REPORT
        "clarity_score": analysis.get("clarity_score"),
        "fluency_score": analysis.get("fluency_score"),
        "vocabulary_score": analysis.get("vocabulary_score"),
        "filler_words_detected": analysis.get("filler_words_detected"),
        "grammatical_errors": analysis.get("grammatical_errors"),
        "grammar_report": analysis.get("grammar_report"),
        "summary_report": analysis.get("summary_report"),
        "recommendations": analysis.get("recommendations"),
    }

    return merged
