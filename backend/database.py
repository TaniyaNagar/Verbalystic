import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root
env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_path)

def get_connection():
    DATABASE_URL = os.getenv("DATABASE_URL")

    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL not found. Check your .env file.")

    try:
        # psycopg2 requires dsn string only, no additional params
        conn = psycopg2.connect(DATABASE_URL)
        return conn

    except Exception as e:
        print("Database Connection Error:", e)
        raise RuntimeError(f"Database connection failed: {e}")
