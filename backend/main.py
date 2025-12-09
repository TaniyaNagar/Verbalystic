#main py
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
from realtime import sio_app      # <-- correct import
from database import get_connection
import os
import time
from routes.report_route import router as report_router



app = FastAPI()                   # <-- this is your ONLY app

# mount socket.io ASGI app
app.mount("/ws", sio_app)         # <-- NOW the WebSocket server works!

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],  # frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(report_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Pydantic models
# -------------------------
class UserSignup(BaseModel):
    name: str
    email: EmailStr

class UserLogin(BaseModel):
    email: EmailStr

class UpdateProfile(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    profile_image: Optional[str] = None

class SessionCreate(BaseModel):
    user_id: str
    audio_url: Optional[str] = None
    transcript: Optional[str] = None
    duration_seconds: Optional[int] = None
    avg_wpm: Optional[int] = None
    filler_word_count: Optional[int] = None
    pronunciation_score: Optional[float] = None
    tone_score: Optional[float] = None
    grammar_score: Optional[float] = None

class AnalysisCreate(BaseModel):
    session_id: str
    vocabulary_score: Optional[float] = None
    fluency_score: Optional[float] = None
    clarity_score: Optional[float] = None
    filler_words_detected: Optional[int] = None
    grammatical_errors: Optional[int] = None
    grammar_report: Optional[str] = None
    vocabulary_suggestions: Optional[str] = None
    tone_analysis: Optional[str] = None
    summary_report: Optional[str] = None
    recommendations: Optional[str] = None

# -------------------------
# Utility
# -------------------------
def fetchone_dict(cur):
    """Helper to return dict from cursor.fetchone using cursor.description"""
    row = cur.fetchone()
    if row is None:
        return None
    cols = [c[0] for c in cur.description]
    return dict(zip(cols, row))

# -------------------------
# User endpoints
# -------------------------
@app.post("/register")
def register(user: UserSignup):
    print("Loaded DB URL:", os.getenv("DATABASE_URL"))

    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s;", (user.email,))
        if cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail="Email already registered")

        cur.execute("""
            INSERT INTO users (name, email)
            VALUES (%s, %s)
            RETURNING id;
        """, (user.name, user.email))
        print("Loaded DB URL:", os.getenv("DATABASE_URL"))
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close(); conn.close()
        print("Loaded DB URL:", os.getenv("DATABASE_URL"))

        return {"message": "User registered", "user_id": new_id}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/login")
def login(data: UserLogin):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, name, email, profile_image FROM users WHERE email = %s;", (data.email,))
        user = cur.fetchone()
        cur.close(); conn.close()
        if not user:
            raise HTTPException(status_code=404, detail="Email not found")
        return {"message":"Login successful", "user_id": user[0], "name": user[1], "email": user[2], "profile_image": user[3]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/get-user/{user_id}")
def get_user(user_id: str):
    """
    Returns profile info + quick stats needed for the Profile page:
    - name, email, profile_image
    - streak_count, total_points
    - total_sessions, speaking_minutes (sum duration_seconds)
    """
    try:
        conn = get_connection()
        cur = conn.cursor()

        # profile
        cur.execute("SELECT id, name, email, profile_image, total_points, streak_count, level, created_at FROM users WHERE id = %s;", (user_id,))
        user_row = cur.fetchone()
        if not user_row:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="User not found")

        user = {
            "id": user_row[0],
            "name": user_row[1],
            "email": user_row[2],
            "profile_image": user_row[3],
            "total_points": user_row[4],
            "streak_count": user_row[5],
            "level": user_row[6],
            "created_at": user_row[7]
        }

        # total sessions and speaking minutes
        cur.execute("SELECT COUNT(*) AS total_sessions, COALESCE(SUM(duration_seconds),0) AS speaking_minutes FROM sessions WHERE user_id = %s;", (user_id,))
        sess_stats = cur.fetchone()
        user["total_sessions"] = sess_stats[0]
        user["speaking_minutes"] = sess_stats[1]

        # weekly consistency (simple placeholder: percent of days with sessions in last 7 days)
        cur.execute("""
            SELECT COUNT(DISTINCT date_trunc('day', session_at)) AS active_days
            FROM sessions
            WHERE user_id = %s AND session_at >= now() - interval '7 days';
        """, (user_id,))
        active_days = cur.fetchone()[0]
        weekly_consistency = int((active_days / 7.0) * 100)
        user["weekly_consistency_percent"] = weekly_consistency

        cur.close(); conn.close()
        return {"user": user}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/update-profile")
def update_profile(payload: UpdateProfile):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Check user exists
        cur.execute("SELECT id FROM users WHERE id = %s;", (payload.user_id,))
        if not cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="User not found")

        # Build update dynamically
        updates = []
        params = []
        if payload.name is not None:
            updates.append("name = %s"); params.append(payload.name)
        if payload.email is not None:
            updates.append("email = %s"); params.append(payload.email)
        if payload.profile_image is not None:
            updates.append("profile_image = %s"); params.append(payload.profile_image)

        if not updates:
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail="No fields to update")

        params.append(payload.user_id)
        sql = f"UPDATE users SET {', '.join(updates)} WHERE id = %s RETURNING id, name, email, profile_image;"
        cur.execute(sql, tuple(params))
        updated = cur.fetchone()
        conn.commit()
        cur.close(); conn.close()
        return {"message": "Profile updated", "user": {"id": updated[0], "name": updated[1], "email": updated[2], "profile_image": updated[3]}}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/delete-account/{user_id}")
def delete_account(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        # This will cascade-delete sessions, analysis_report, user_badge, etc. due to your FK ON DELETE CASCADE.
        cur.execute("DELETE FROM users WHERE id = %s RETURNING id;", (user_id,))
        deleted = cur.fetchone()
        if not deleted:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
        cur.close(); conn.close()
        return {"message": "Account deleted", "user_id": deleted[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------
# Roadmap & Achievements endpoints
# -------------------------
@app.get("/get-roadmap/{user_id}")
def get_roadmap(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, skill_focus, ai_recommendations, progress_status, updated_at FROM learning_roadmap WHERE user_id = %s ORDER BY updated_at DESC;", (user_id,))
        rows = cur.fetchall()
        roadmaps = []
        for r in rows:
            roadmaps.append({
                "id": r[0],
                "skill_focus": r[1],
                "ai_recommendations": r[2],
                "progress_status": r[3],
                "updated_at": r[4]
            })
        cur.close(); conn.close()
        return {"roadmap": roadmaps}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/get-achievements/{user_id}")
def get_achievements(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT b.id, b.name, b.description, ub.earned_date
            FROM user_badge ub
            JOIN badges b ON ub.badge_id = b.id
            WHERE ub.user_id = %s
            ORDER BY ub.earned_date DESC;
        """, (user_id,))
        rows = cur.fetchall()
        badges = [{"id": r[0], "name": r[1], "description": r[2], "earned_date": r[3]} for r in rows]
        cur.close(); conn.close()
        return {"achievements": badges}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------
# Session / Analysis endpoints (create)
# -------------------------
@app.post("/create-session")
def create_session(data: SessionCreate):
    try:
        # Run analysis on transcript
        analysis = analyze_transcript(data.transcript or "")

        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO sessions
            (user_id, audio_url, transcript, duration_seconds, session_at,
             avg_wpm, filler_word_count, pronunciation_score, tone_score, grammar_score)
            VALUES (%s,%s,%s,%s,now(),%s,%s,%s,%s,%s)
            RETURNING id;
        """, (
            data.user_id,
            data.audio_url,
            data.transcript,
            data.duration_seconds,
            data.avg_wpm,
            analysis["filler_word_count"],
            analysis["pronunciation_score"],
            analysis["tone_score"],
            analysis["grammar_score"]
        ))
        session_id = cur.fetchone()[0]
        conn.commit()
        cur.close(); conn.close()

        return {"message": "Session saved", "session_id": session_id}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/create-analysis")
def create_analysis(data: AnalysisCreate):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO analysis_report
            (session_id, vocabulary_score, fluency_score, clarity_score,
             filler_words_detected, grammatical_errors, grammar_report,
             vocabulary_suggestions, tone_analysis, summary_report, recommendations, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
            RETURNING id;
        """, (
            data.session_id, data.vocabulary_score, data.fluency_score,
            data.clarity_score, data.filler_words_detected,
            data.grammatical_errors, data.grammar_report,
            data.vocabulary_suggestions, data.tone_analysis,
            data.summary_report, data.recommendations
        ))
        report_id = cur.fetchone()[0]
        conn.commit()
        cur.close(); conn.close()
        return {"message":"Analysis saved", "report_id": report_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -------------------------
# Get latest report (keeps same contract as before)
# -------------------------
@app.get("/get-latest-report/{user_id}")
def get_latest_report(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, session_at, avg_wpm, filler_word_count, pronunciation_score, tone_score, grammar_score
            FROM sessions
            WHERE user_id = %s
            ORDER BY session_at DESC
            LIMIT 1;
        """, (user_id,))
        session = cur.fetchone()
        if not session:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="No sessions found")

        session_id = session[0]
        cur.execute("""
            SELECT vocabulary_score, fluency_score, clarity_score, filler_words_detected,
                   grammatical_errors, grammar_report, vocabulary_suggestions,
                   tone_analysis, summary_report, recommendations
            FROM analysis_report
            WHERE session_id = %s;
        """, (session_id,))
        analysis = cur.fetchone()
        cur.close(); conn.close()

        return {
            "session": {
                "session_id": session_id,
                "session_at": session[1],
                "avg_wpm": session[2],
                "filler_word_count": session[3],
                "pronunciation_score": session[4],
                "tone_score": session[5],
                "grammar_score": session[6],
            },
            "analysis": {
                "vocabulary_score": analysis[0] if analysis else None,
                "fluency_score": analysis[1] if analysis else None,
                "clarity_score": analysis[2] if analysis else None,
                "filler_words_detected": analysis[3] if analysis else None,
                "grammatical_errors": analysis[4] if analysis else None,
                "grammar_report": analysis[5] if analysis else None,
                "vocabulary_suggestions": analysis[6] if analysis else None,
                "tone_analysis": analysis[7] if analysis else None,
                "summary_report": analysis[8] if analysis else None,
                "recommendations": analysis[9] if analysis else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    # -------------------------
# Get all sessions for history page
# -------------------------
@app.get("/sessions/by-user/{user_id}")
def get_sessions_by_user(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, session_at, duration_seconds, avg_wpm,
                   pronunciation_score, tone_score, grammar_score
            FROM sessions
            WHERE user_id = %s
            ORDER BY session_at DESC;
        """, (user_id,))

        rows = cur.fetchall()
        cur.close(); conn.close()

        sessions = []
        for r in rows:
            sessions.append({
                "id": r[0],
                "session_at": r[1],
                "duration_seconds": r[2],
                "avg_wpm": r[3],
                "pronunciation_score": r[4],
                "tone_score": r[5],
                "grammar_score": r[6]
            })

        return {"sessions": sessions}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
UPLOAD_DIR = "uploaded_audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)
    
@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...), user_id: str = Form(...)):
    filename = f"{user_id}_{int(time.time())}.webm"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    return {"url": file_path}
def analyze_transcript(text: str):
    """
    Simple NLP-based scoring:
    - filler words count
    - pronunciation score (proxy: word clarity ratio)
    - tone score (sentiment)
    - grammar score (grammar mistakes)
    """

    if not text:
        return {
            "filler_word_count": 0,
            "pronunciation_score": 0,
            "tone_score": 0,
            "grammar_score": 0,
        }

    filler_words = ["um", "uh", "like", "you know", "actually", "basically", "so"]
    lower = text.lower()

    filler_count = 0
    for f in filler_words:
        filler_count += lower.count(f)

    # Simple pronunciation score (word clarity) = longer sentences = higher clarity
    words = text.split()
    unique_words = len(set(words))
    pronunciation_score = round((unique_words / (len(words) + 1)) * 100, 2)

    # Simple tone score (polarity)
    import textblob
    blob = textblob.TextBlob(text)
    tone_score = round((blob.sentiment.polarity + 1) * 50)  # convert -1..1 → 0..100

    # Simple grammar score = (sentences without errors)
    grammar_score = 100 - (abs(blob.sentiment.subjectivity - 0.5) * 100)

    return {
        "filler_word_count": filler_count,
        "pronunciation_score": pronunciation_score,
        "tone_score": tone_score,
        "grammar_score": grammar_score,
    }
