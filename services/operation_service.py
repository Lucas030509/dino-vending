from db_client import get_supabase_client
from typing import Dict, Any, Optional

supabase = get_supabase_client()

def log_operation(
    machine_id: str,
    user_id: str,
    operation_type: str,
    amount_collected: float = 0.0,
    commission_paid: float = 0.0,
    photo_refill: Optional[str] = None,
    photo_cash: Optional[str] = None,
    photo_receipt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Logs a maintainance operation (refill, cash collection, etc.).
    """
    data = {
        "machine_id": machine_id,
        "user_id": user_id,
        "operation_type": operation_type,
        "amount_collected": amount_collected,
        "commission_paid": commission_paid,
        "photo_refill_path": photo_refill,
        "photo_cash_path": photo_cash,
        "photo_receipt_path": photo_receipt
    }
    
    response = supabase.table("operation_logs").insert(data).execute()
    return response.data[0] if response.data else {}

def create_incident_report(
    machine_id: str,
    report_type: str,
    description: str,
    photo_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Creates a public incident report for a machine.
    """
    data = {
        "machine_id": machine_id,
        "report_type": report_type,
        "description": description,
        "photo_path": photo_path
    }
    
    response = supabase.table("incident_reports").insert(data).execute()
    return response.data[0] if response.data else {}

def update_incident_status(report_id: str, status: str) -> Dict[str, Any]:
    """
    Updates the status of an incident report (e.g., 'resolved').
    """
    response = supabase.table("incident_reports").update({"status": status}).eq("id", report_id).execute()
    return response.data[0] if response.data else {}
