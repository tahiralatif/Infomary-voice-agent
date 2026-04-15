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

# Session tracking for progressive saving
_sessions: dict = {}

class GoogleSearchInput(BaseModel):
    query: str

class SaveLeadInput(BaseModel):
    session_id: str = ""
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

def _build_html_email(lead: dict) -> str:
    # Build HTML table rows for existing lead data
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

async def _send_email(lead: dict) -> dict:
    logger.info("Sending lead notification email")
    try:
        resend.api_key = os.getenv("RESEND_API_KEY")
        resend.Emails.send({
            "from": "InfoSenior.care <onboarding@resend.dev>",
            "to": "uzairlatif293@gmail.com",
            "subject": f"New Lead: {lead.get('name','Unknown')} | {lead.get('care_need','N/A')}",
            "html": _build_html_email(lead)
        })
        return {"success": True}
    except Exception as e:
        logger.error(f"Email failed: {e}")
        return {"success": False, "error": str(e)}

async def _upsert_sheet(lead: dict, session_id: str) -> dict:
    logger.info(f"Upserting sheet row for session {session_id}")
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

            row_data = [
                lead.get("lead_id",""),      lead.get("name",""),
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
            ]

            existing_row = _sessions[session_id].get("row_index")

            if existing_row:
                sheet.update(f"A{existing_row}:Y{existing_row}", [row_data])
            else:
                sheet.append_row(row_data)
                col_a = sheet.col_values(1)
                _sessions[session_id]["row_index"] = len(col_a)

        await loop.run_in_executor(None, _run)
        logger.info("Successfully upserted data in sheet.")
        return {"success": True}
    except Exception as e:
        logger.error(f"Sheet error: {e}")
        return {"success": False, "error": str(e)}

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

    if session_id not in _sessions:
        _sessions[session_id] = {
            "lead_id": str(uuid.uuid4())[:8].upper(),
            "row_index": None,
            "email_sent": False
        }

    session    = _sessions[session_id]
    lead_id    = session["lead_id"]
    email_sent = session["email_sent"]

    lead = {
        "lead_id": lead_id,
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

    await _upsert_sheet(lead, session_id)

    # Trigger email once when enough contact info is present
    has_name    = bool(name.strip())
    has_contact = bool(phone.strip() or email.strip())

    if has_name and has_contact and not email_sent:
        result = await _send_email(lead)
        if result["success"]:
            _sessions[session_id]["email_sent"] = True
    logger.info("Successfully saved user lead.")
    return f"Lead saved. ID: {lead_id}"

async def _google_search(query: str) -> str:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={
                    "X-API-KEY": os.getenv("SERPER_API_KEY"),
                    "Content-Type": "application/json"
                },
                json={"q": query, "num": 5},
                timeout=10.0
            )
            organic = response.json().get("organic", [])
            if not organic:
                return "No results found."
            logger.info("Successfully performed google Search.")
            return "\n".join(
                f"• {r.get('title')}: {r.get('snippet')} ({r.get('link')})"
                for r in organic[:5]
            )
    except Exception as e:
        return f"Search failed: {e}"

google_search = StructuredTool.from_function(
    coroutine=_google_search,
    name="google_search",
    description="Search for nearby senior care facilities, hospitals, or services.",
    args_schema=GoogleSearchInput,
)

save_lead = StructuredTool.from_function(
    coroutine=_save_lead,
    name="save_lead",
    description="Save or update senior care lead progressively. Pass session_id and all collected fields.",
    args_schema=SaveLeadInput,
)
