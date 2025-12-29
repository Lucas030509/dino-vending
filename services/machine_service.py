from db_client import get_supabase_client
from typing import List, Dict, Any, Optional

supabase = get_supabase_client()

def register_machine(
    tenant_id: str, 
    qr_code_uid: str, 
    location_name: str, 
    address: Optional[str] = None,
    maps_url: Optional[str] = None,
    capacity: int = 0,
    denomination: float = 0.0
) -> Dict[str, Any]:
    """
    Registers a new vending machine for a specific tenant.
    """
    data = {
        "tenant_id": tenant_id,
        "qr_code_uid": qr_code_uid,
        "location_name": location_name,
        "address": address,
        "maps_url": maps_url,
        "machine_capacity": capacity,
        "denomination": denomination
    }
    
    response = supabase.table("machines").insert(data).execute()
    return response.data[0] if response.data else {}

def get_tenant_machines(tenant_id: str) -> List[Dict[str, Any]]:
    """
    Lists all machines belonging to a tenant.
    """
    response = supabase.table("machines").select("*").eq("tenant_id", tenant_id).execute()
    return response.data if response.data else []

def get_machine_by_qr(qr_code_uid: str) -> Dict[str, Any]:
    """
    Retrieves a machine by its QR code ID.
    """
    response = supabase.table("machines").select("*").eq("qr_code_uid", qr_code_uid).single().execute()
    return response.data if response.data else {}
