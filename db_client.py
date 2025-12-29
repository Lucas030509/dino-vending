import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env file
load_dotenv()

def get_supabase_client() -> Client:
    """
    Initializes and returns a Supabase client using environment variables.
    """
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables.")

    return create_client(url, key)

if __name__ == "__main__":
    # Quick connection test
    try:
        supabase = get_supabase_client()
        print("✅ Supabase client initialized successfully.")
    except Exception as e:
        print(f"❌ Error: {e}")
