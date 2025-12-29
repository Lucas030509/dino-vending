from db_client import get_supabase_client
from typing import Dict, Any, Optional

supabase = get_supabase_client()

def create_tenant(name: str, logo_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Creates a new tenant (organization).
    """
    data = {"name": name}
    if logo_url:
        data["logo_url"] = logo_url
        
    response = supabase.table("tenants").insert(data).execute()
    return response.data[0] if response.data else {}

def link_user_to_tenant(user_id: str, tenant_id: str, role: str = "staff") -> Dict[str, Any]:
    """
    Links a Supabase Auth user to a tenant in the profiles table.
    Note: The trigger on_auth_user_created handles initial staff profile creation,
    but this function can be used to update the tenant_id and role.
    """
    response = supabase.table("profiles").update({
        "tenant_id": tenant_id,
        "role": role
    }).eq("id", user_id).execute()
    
    return response.data[0] if response.data else {}

def get_tenant_details(tenant_id: str) -> Dict[str, Any]:
    """
    Retrieves tenant details.
    """
    response = supabase.table("tenants").select("*").eq("id", tenant_id).single().execute()
    return response.data if response.data else {}
