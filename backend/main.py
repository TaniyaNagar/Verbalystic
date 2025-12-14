# main.py
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional

from realtime import sio_app
from database import get_connection
from routes.report_route import router as report_router

from textblob import TextBlob
import bcrypt
import os
import time

# -------------------------
# Password Utils
# -------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


# -------------------------
# FastAPI App
# -------------------------
app = FastAPI()

# Mount Socket.io app
app.mount("/ws", sio_app)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten later for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(report_router)


# -------------------------
# Pydantic Models
# -------------------------
class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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

class ChangePassword(BaseModel):
    user_id: str
    old_password: str
    new_password: str

# -------------------------
# Helpers
# -------------------------
def fetchone_dict(cur):
    row = cur.fetchone()
    if not row:
        return None
    cols = [c[0] for c in cur.description]
    return dict(zip(cols, row))


# -------------------------
# USER ENDPOINTS
# -------------------------
@app.post("/register")
def register(user: UserSignup):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT id FROM users WHERE email = %s", (user.email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")

        cur.execute("""
            INSERT INTO users (name, email, password)
            VALUES (%s, %s, %s)
            RETURNING id;
        """, (user.name, user.email, hash_password(user.password)))

        user_id = cur.fetchone()[0]
        conn.commit()
        return {"message": "User registered", "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        print("LOGIN ERROR:", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    finally:
        cur.close()
        conn.close()


@app.post("/login")
def login(data: UserLogin):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, name, email, password, profile_image
            FROM users WHERE email = %s
        """, (data.email,))
        user = cur.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="Email not found")

        if not verify_password(data.password, user[3]):
            raise HTTPException(status_code=400, detail="Incorrect password")

        return {
            "message": "Login successful",
            "user_id": user[0],
            "name": user[1],
            "email": user[2],
            "profile_image": user[4],
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.get("/get-user/{user_id}")
def get_user(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, name, email, profile_image, total_points, streak_count, level, created_at
            FROM users WHERE id = %s
        """, (user_id,))
        data = cur.fetchone()

        if not data:
            raise HTTPException(status_code=404, detail="User not found")

        user = {
            "id": data[0],
            "name": data[1],
            "email": data[2],
            "profile_image": data[3],
            "total_points": data[4],
            "streak_count": data[5],
            "level": data[6],
            "created_at": data[7],
        }

        cur.execute("""
            SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
            FROM sessions WHERE user_id = %s
        """, (user_id,))
        stats = cur.fetchone()
        user["total_sessions"] = stats[0]
        user["speaking_minutes"] = stats[1]

        cur.execute("""
            SELECT COUNT(DISTINCT date_trunc('day', session_at))
            FROM sessions
            WHERE user_id = %s AND session_at >= now() - interval '7 days'
        """, (user_id,))
        days = cur.fetchone()[0]
        user["weekly_consistency_percent"] = int((days / 7) * 100)

        return user

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.post("/update-profile")
def update_profile(payload: UpdateProfile):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT id FROM users WHERE id = %s", (payload.user_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        if payload.email:
            cur.execute("SELECT id FROM users WHERE email = %s AND id != %s",
                        (payload.email, payload.user_id))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Email already in use")

        updates = []
        params = []
        if payload.name:
            updates.append("name=%s"); params.append(payload.name)
        if payload.email:
            updates.append("email=%s"); params.append(payload.email)
        if payload.profile_image:
            updates.append("profile_image=%s"); params.append(payload.profile_image)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        params.append(payload.user_id)

        cur.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id=%s RETURNING id,name,email,profile_image",
            tuple(params)
        )
        updated = cur.fetchone()
        conn.commit()

        return {
            "message": "Profile updated",
            "user": {
                "id": updated[0],
                "name": updated[1],
                "email": updated[2],
                "profile_image": updated[3],
            },
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.delete("/delete-account/{user_id}")
def delete_account(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM users WHERE id=%s RETURNING id", (user_id,))
        deleted = cur.fetchone()

        if not deleted:
            raise HTTPException(status_code=404, detail="User not found")

        conn.commit()
        return {"message": "Account deleted", "user_id": deleted[0]}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


# -------------------------
# ROADMAP & ACHIEVEMENTS
# -------------------------
@app.get("/get-roadmap/{user_id}")
def get_roadmap(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, skill_focus, ai_recommendations, progress_status, updated_at
            FROM learning_roadmap
            WHERE user_id = %s
            ORDER BY updated_at DESC
        """, (user_id,))
        rows = cur.fetchall()

        return {"roadmap": [
            {
                "id": r[0],
                "skill_focus": r[1],
                "ai_recommendations": r[2],
                "progress_status": r[3],
                "updated_at": r[4],
            }
            for r in rows
        ]}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


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
            ORDER BY ub.earned_date DESC
        """, (user_id,))
        rows = cur.fetchall()

        return {"achievements": [
            {"id": r[0], "name": r[1], "description": r[2], "earned_date": r[3]}
            for r in rows
        ]}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


# -------------------------
# SESSION & ANALYSIS
# -------------------------
@app.post("/create-session")
def create_session(data: SessionCreate):
    try:
        text = data.transcript or ""
        analysis = analyze_transcript(text)

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO sessions
            (user_id, audio_url, transcript, duration_seconds, session_at,
             avg_wpm, filler_word_count, pronunciation_score, tone_score, grammar_score)
            VALUES (%s,%s,%s,%s,now(),%s,%s,%s,%s,%s)
            RETURNING id;
        """, (
            data.user_id, data.audio_url, data.transcript, data.duration_seconds,
            data.avg_wpm, analysis["filler_word_count"],
            analysis["pronunciation_score"], analysis["tone_score"],
            analysis["grammar_score"]
        ))

        session_id = cur.fetchone()[0]
        conn.commit()

        return {"message": "Session saved", "session_id": session_id}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.post("/create-analysis")
def create_analysis(data: AnalysisCreate):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO analysis_report
            (session_id, vocabulary_score, fluency_score, clarity_score,
             filler_words_detected, grammatical_errors, grammar_report,
             vocabulary_suggestions, tone_analysis, summary_report,
             recommendations, created_at)
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

        return {"message": "Analysis saved", "report_id": report_id}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


# -------------------------
# LATEST REPORT
# -------------------------
@app.get("/get-latest-report/{user_id}")
def get_latest_report(user_id: str):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, session_at, avg_wpm, filler_word_count, pronunciation_score,
                   tone_score, grammar_score
            FROM sessions
            WHERE user_id = %s
            ORDER BY session_at DESC
            LIMIT 1;
        """, (user_id,))
        session = cur.fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="No sessions found")

        session_id = session[0]

        cur.execute("""
            SELECT vocabulary_score, fluency_score, clarity_score,
                   filler_words_detected, grammatical_errors, grammar_report,
                   vocabulary_suggestions, tone_analysis, summary_report,
                   recommendations
            FROM analysis_report WHERE session_id = %s
        """, (session_id,))
        analysis = cur.fetchone()

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
                "recommendations": analysis[9] if analysis else None,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


# -------------------------
# SESSION HISTORY
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
            ORDER BY session_at DESC
        """, (user_id,))
        rows = cur.fetchall()

        return {"sessions": [
            {
                "id": r[0],
                "session_at": r[1],
                "duration_seconds": r[2],
                "avg_wpm": r[3],
                "pronunciation_score": r[4],
                "tone_score": r[5],
                "grammar_score": r[6],
            }
            for r in rows
        ]}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


# -------------------------
# AUDIO UPLOAD
# -------------------------
UPLOAD_DIR = "uploaded_audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...), user_id: str = Form(...)):
    filename = f"{user_id}_{int(time.time())}.webm"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    return {"url": file_path}


# -------------------------
# CHANGE PASSWORD
# -------------------------
@app.post("/change-password")
def change_password(data: ChangePassword):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT password FROM users WHERE id=%s", (data.user_id,))
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(data.old_password, row[0]):
            raise HTTPException(status_code=400, detail="Incorrect old password")

        new_hash = hash_password(data.new_password)

        cur.execute("UPDATE users SET password=%s WHERE id=%s",
                    (new_hash, data.user_id))
        conn.commit()

        return {"message": "Password updated successfully"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


# -------------------------
# ANALYSIS FUNCTION
# -------------------------
def analyze_transcript(text: str):
    if not text:
        return {
            "filler_word_count": 0,
            "pronunciation_score": 0,
            "tone_score": 0,
            "grammar_score": 0,
        }

    filler_words = ["um", "uh", "like", "you know", "actually", "basically", "so"]
    lower = text.lower()

    filler_count = sum(lower.count(w) for w in filler_words)

    words = text.split()
    unique_words = len(set(words))
    pronunciation_score = round((unique_words / (len(words) + 1)) * 100, 2)

    blob = TextBlob(text)
    tone_score = round((blob.sentiment.polarity + 1) * 50)
    grammar_score = 100 - (abs(blob.sentiment.subjectivity - 0.5) * 100)

    return {
        "filler_word_count": filler_count,
        "pronunciation_score": pronunciation_score,
        "tone_score": tone_score,
        "grammar_score": grammar_score,
    }
