import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

def get_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

