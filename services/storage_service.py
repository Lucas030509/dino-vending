from db_client import get_supabase_client
from typing import Dict, Any, Optional

supabase = get_supabase_client()

def upload_file(bucket_id: str, file_path: str, destination_path: str) -> str:
    """
    Uploads a file to a Supabase Storage bucket and returns the public URL or path.
    destination_path should include the folder structure (e.g., 'tenant_uuid/machine_uuid/file.jpg').
    """
    with open(file_path, 'rb') as f:
        response = supabase.storage.from_(bucket_id).upload(
            path=destination_path,
            file=f,
            file_options={"content-type": "image/jpeg"}
        )
    
    # Return the path or public URL depending on bucket settings
    if bucket_id == "machine-photos":
        return supabase.storage.from_(bucket_id).get_public_url(destination_path)
    
    return destination_path # For private buckets, we return the internal path

def delete_file(bucket_id: str, destination_path: str) -> Any:
    """
    Deletes a file from storage.
    """
    return supabase.storage.from_(bucket_id).remove([destination_path])
