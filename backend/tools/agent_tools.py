import os
import uuid
import asyncio
from datetime import datetime
from dotenv import load_dotenv
import gspread
import resend
import json
import httpx
import logging
from google.oauth2.service_account import Credentials
from langchain_core.tools import StructuredTool
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv()

SHEET_URL = "https://docs.google.com/spreadsheets/d/1sJYvoP4BOVeMWaFGBOPTtpuJKrY847n3GQzElQyPRKY/edit?usp=sharing"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "credentials.json")
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# ─── Schemas ──────────────────────────────────────────────────────────────────
class GoogleSearchInput(BaseModel):
    query: str

class SaveLeadInput(BaseModel):
    session_id: str = ""   # REQUIRED — same session_id every call
    name: str = ""
    email: str = ""
    phone: str = ""
    care_need: str = ""
    location: str = ""
    notes: str = ""
    age: str = ""
    gender: str = ""
    living_arrangement: str = ""
    physician: str = ""
    conditions: str = ""
    hospitalizations: str = ""
    medications: str = ""
    allergies: str = ""
    care_type: str = ""
    care_hours: str = ""
    insurance: str = ""
    budget: str = ""
    home_hazards: str = ""
    medical_equipment: str = ""
    other_factors: str = ""
    transportation: str = ""

# ─── Email HTML Builder ───────────────────────────────────────────────────────
def _build_html_email(lead: dict) -> str:
    def row(label, key):
        value = lead.get(key, "")
        if not value or str(value).strip() in ("", "None", "none"):
            return ""
        return f"""
        <tr style="background:#f8f9ff;">
          <td style="padding:12px 20px;border-bottom:1px solid #e0e0e0;width:40%;">
            <p style="margin:0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">{label}</p>
          </td>
          <td style="padding:12px 20px;border-bottom:1px solid #e0e0e0;">
            <p style="margin:0;color:#1a1a2e;font-size:14px;">{value}</p>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:40px 48px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">
            InfoSenior<span style="color:#90caf9;">.care</span>
          </h1>
          <p style="margin:8px 0 0;color:#bbdefb;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">
            New Lead Notification
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#e8f0fe;padding:18px 48px;border-bottom:1px solid #c5d4f5;">
          <p style="margin:0;color:#1a47a1;font-size:14px;font-weight:600;">
            A new lead has been captured via Infomary — please follow up promptly.
          </p>
        </td>
      </tr>
      <tr><td style="padding:44px 48px;">

        <p style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:700;">Contact Information</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
          {row("Full Name","name")}{row("Email Address","email")}{row("Phone Number","phone")}
          {row("Location","location")}{row("Lead ID","lead_id")}{row("Captured At","saved_at")}
        </table>

        <p style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:700;">Care Needs</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
          {row("Care Need","care_need")}{row("Care Type","care_type")}
          {row("Care Hours","care_hours")}{row("Insurance","insurance")}{row("Budget","budget")}
        </table>

        <p style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:700;">Personal Details</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
          {row("Age","age")}{row("Gender","gender")}
          {row("Living Arrangement","living_arrangement")}{row("Physician","physician")}
        </table>

        <p style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:700;">Medical History</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
          {row("Conditions","conditions")}{row("Hospitalizations","hospitalizations")}
          {row("Medications","medications")}{row("Allergies","allergies")}
        </table>

        <p style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:700;">Additional Info</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
          {row("Home Hazards","home_hazards")}{row("Medical Equipment","medical_equipment")}
          {row("Transportation","transportation")}{row("Other Factors","other_factors")}
          {row("Notes","notes")}
        </table>

        <p style="margin:0;color:#555;font-size:14px;line-height:1.8;">
          This lead was captured automatically via the Infomary AI assistant.
          Please review and follow up at your earliest convenience.
        </p>
      </td></tr>
      <tr>
        <td style="border-top:1px solid #ebebeb;padding:28px 48px;text-align:center;">
          <p style="margin:0 0 4px;color:#1a73e8;font-size:14px;font-weight:700;">InfoSenior.care</p>
          <p style="margin:0;color:#999;font-size:12px;">Automated notification — do not reply.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>"""

# ─── Send Email ───────────────────────────────────────────────────────────────
async def _send_email(lead: dict) -> dict:
    logger.info("[Email] Sending notification...")
    try:
        resend.api_key = os.getenv("RESEND_API_KEY")
        resend.Emails.send({
            "from": "InfoSenior.care <onboarding@resend.dev>",
            "to": "uzairlatif293@gmail.com",
            "subject": f"🔔 New Lead: {lead.get('name','Unknown')} | {lead.get('care_need','N/A')} | {lead.get('location','N/A')}",
            "html": _build_html_email(lead)
        })
        logger.info("[Email] ✓ Sent")
        return {"success": True}
    except Exception as e:
        logger.error(f"[Email] ✗ Failed: {e}")
        return {"success": False, "error": str(e)}

# ─── Upsert Sheet (Stateful via Search) ──────────────────────────────────────
async def _upsert_sheet(lead: dict, session_id: str) -> dict:
    logger.info(f"[Sheet] Upserting — session={session_id}")
    try:
        loop = asyncio.get_event_loop()

        def _run():
            creds_json = os.getenv("GOOGLE_CREDENTIALS")
            if creds_json:
                creds = Credentials.from_service_account_info(
                    json.loads(creds_json), scopes=SCOPES)
            else:
                creds = Credentials.from_service_account_file(
                    CREDENTIALS_FILE, scopes=SCOPES)

            client = gspread.authorize(creds)
            sheet = client.open_by_url(SHEET_URL).sheet1

            # Search for existing session in Column Z (Index 26)
            try:
                cell = sheet.find(session_id, in_column=26)
                existing_row = cell.row
                # Get existing lead_id and email status from that row
                row_vals = sheet.row_values(existing_row)
                existing_lead_id = row_vals[0] if len(row_vals) > 0 else lead["lead_id"]
                email_already_sent = row_vals[26] == "TRUE" if len(row_vals) > 26 else False
            except gspread.exceptions.CellNotFound:
                existing_row = None
                existing_lead_id = lead["lead_id"]
                email_already_sent = False

            row_data = [
                existing_lead_id,             lead.get("name",""),
                lead.get("email",""),         lead.get("phone",""),
                lead.get("care_need",""),     lead.get("location",""),
                lead.get("status","New"),     lead.get("notes",""),
                lead.get("saved_at",""),      lead.get("age",""),
                lead.get("gender",""),        lead.get("living_arrangement",""),
                lead.get("physician",""),     lead.get("conditions",""),
                lead.get("hospitalizations",""), lead.get("medications",""),
                lead.get("allergies",""),     lead.get("care_type",""),
                lead.get("care_hours",""),    lead.get("insurance",""),
                lead.get("budget",""),        lead.get("home_hazards",""),
                lead.get("medical_equipment",""), lead.get("other_factors",""),
                lead.get("transportation",""),
                session_id,                   # Column Z (26)
                "TRUE" if lead.get("trigger_email") or email_already_sent else "FALSE" # Column AA (27)
            ]

            if existing_row:
                sheet.update(f"A{existing_row}:AA{existing_row}", [row_data])
                logger.info(f"[Sheet] ✓ Updated row {existing_row}")
            else:
                sheet.append_row(row_data)
                logger.info(f"[Sheet] ✓ Appended new row")
            
            return {"existing_lead_id": existing_lead_id, "email_already_sent": email_already_sent}

        result = await loop.run_in_executor(None, _run)
        return {"success": True, **result}

    except Exception as e:
        logger.error(f"[Sheet] ✗ Error: {e}")
        return {"success": False, "error": str(e)}

# ─── Main Save Lead ───────────────────────────────────────────────────────────
async def _save_lead(
    session_id: str = "",
    name: str = "", email: str = "", phone: str = "",
    care_need: str = "", location: str = "", notes: str = "",
    age: str = "", gender: str = "", living_arrangement: str = "",
    physician: str = "", conditions: str = "", hospitalizations: str = "",
    medications: str = "", allergies: str = "", care_type: str = "",
    care_hours: str = "", insurance: str = "", budget: str = "",
    home_hazards: str = "", medical_equipment: str = "",
    other_factors: str = "", transportation: str = "",
) -> str:

    if not session_id:
        return "Error: session_id is required for save_lead."

    lead = {
        "lead_id": str(uuid.uuid4())[:8].upper(), # Default, will be overridden if exists
        "name": name, "email": email, "phone": phone,
        "care_need": care_need, "location": location,
        "status": "New", "notes": notes,
        "saved_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "age": age, "gender": gender,
        "living_arrangement": living_arrangement,
        "physician": physician, "conditions": conditions,
        "hospitalizations": hospitalizations,
        "medications": medications, "allergies": allergies,
        "care_type": care_type, "care_hours": care_hours,
        "insurance": insurance, "budget": budget,
        "home_hazards": home_hazards,
        "medical_equipment": medical_equipment,
        "other_factors": other_factors,
        "transportation": transportation,
    }

    # ── Email Trigger Logic ──────────────────────────────────────────────────
    has_name    = bool(name.strip())
    has_contact = bool(phone.strip() or email.strip())
    
    # ── Always upsert sheet first to check status ───────────────────────────
    upsert_res = await _upsert_sheet(lead, session_id)
    
    if not upsert_res["success"]:
        return f"Partial failure: {upsert_res.get('error')}"

    lead_id = upsert_res["existing_lead_id"]
    email_sent = upsert_res["email_already_sent"]

    if has_name and has_contact and not email_sent:
        # Update lead dict for email with the correct ID
        lead["lead_id"] = lead_id
        email_res = await _send_email(lead)
        if email_res["success"]:
            # Mark as sent in sheet
            lead["trigger_email"] = True
            await _upsert_sheet(lead, session_id)
            logger.info("[Email] ✓ Triggered and recorded")
    
    return f"Lead processed. ID: {lead_id}"

# ─── Google Search ────────────────────────────────────────────────────────────
async def _google_search(query: str) -> str:
    logger.info(f"[Search] {query}")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={
                    "X-API-KEY": os.getenv("SERPER_API_KEY"),
                    "Content-Type": "application/json"
                },
                json={"q": query, "num": 5},
                timeout=20.0 # Increased for production stability
            )
            organic = response.json().get("organic", [])
            if not organic:
                return "No results found."
            return "\n".join(
                f"• {r.get('title')}: {r.get('snippet')} ({r.get('link')})"
                for r in organic[:5]
            )
    except Exception as e:
        logger.error(f"[Search] ✗ Failed: {e}")
        return f"Search failed: {e}"

# ─── Tool Definitions ─────────────────────────────────────────────────────────
google_search = StructuredTool.from_function(
    coroutine=_google_search,
    name="google_search",
    description="Search for nearby senior care facilities, hospitals, or services based on location and care need.",
    args_schema=GoogleSearchInput,
)

save_lead = StructuredTool.from_function(
    coroutine=_save_lead,
    name="save_lead",
    description=(
        "Save or UPDATE the senior care lead progressively. "
        "Call this EVERY TIME any new information is learned from the user. "
        "Always pass session_id (same every call) + ALL fields collected so far. "
        "Sheet row is UPDATED in place using session_id — no duplicate rows even in deployment. "
        "Email fires ONCE automatically when name + (phone or email) are both present."
    ),
    args_schema=SaveLeadInput,
)
