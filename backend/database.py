import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root
env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_path)

def get_connection():
    try:
        conn = psycopg2.connect(
            os.getenv("DATABASE_URL"),
            sslmode="require"
        )
        return conn
    except Exception as e:
        print("Database Connection Error:", e)
        raise e
