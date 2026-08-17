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
        raise RuntimeError("DATABASE_URL is not configured.")

    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
        return conn

    except Exception as e:
        print(f"Database connection error: {e.__class__.__name__}")
        raise RuntimeError("Database connection failed.")
