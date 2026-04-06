import os
import uuid
import asyncio
from datetime import datetime
from dotenv import load_dotenv
import gspread
import resend
import json
import httpx
from google.oauth2.service_account import Credentials
from langchain_core.tools import tool

load_dotenv()

# ─── CONFIG ───────────────────────────────────────────────────────────────────
SENDER_EMAIL     = os.getenv("SENDER_EMAIL")
SHEET_URL        = "https://docs.google.com/spreadsheets/d/1sJYvoP4BOVeMWaFGBOPTtpuJKrY847n3GQzElQyPRKY/edit?usp=sharing"
CREDENTIALS_FILE = "credentials.json"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


# ═══════════════════════════════════════════════════════════════════════════════
# SAVE TO GOOGLE SHEET
# ═══════════════════════════════════════════════════════════════════════════════
async def _save_to_sheet(lead: dict) -> dict:
    print("[Tool 1] Saving to Google Sheet...")
    try:
        loop = asyncio.get_event_loop()

        def _save():
            creds_json = os.getenv("GOOGLE_CREDENTIALS")
            if creds_json:
                creds = Credentials.from_service_account_info(json.loads(creds_json), scopes=SCOPES)
            else:
                creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
            client = gspread.authorize(creds)
            sheet  = client.open_by_url(SHEET_URL).sheet1
            sheet.append_row([
                lead.get("lead_id", ""),
                lead.get("name", ""),
                lead.get("email", ""),
                lead.get("phone", ""),
                lead.get("care_need", ""),
                lead.get("location", ""),
                lead.get("status", "New"),
                lead.get("notes", ""),
                lead.get("saved_at", ""),
                lead.get("age", ""),
                lead.get("gender", ""),
                lead.get("living_arrangement", ""),
                lead.get("physician", ""),
                lead.get("conditions", ""),
                lead.get("hospitalizations", ""),
                lead.get("medications", ""),
                lead.get("allergies", ""),
                lead.get("care_type", ""),
                lead.get("care_hours", ""),
                lead.get("insurance", ""),
                lead.get("budget", ""),
                lead.get("home_hazards", ""),
                lead.get("medical_equipment", ""),
                lead.get("other_factors", ""),
                lead.get("transportation", ""),
            ])

        await loop.run_in_executor(None, _save)
        print("[Tool 1] ✓ Lead saved to Google Sheet")
        return {"success": True, "message": "Lead saved to Google Sheet"}

    except Exception as e:
        print(f"[Tool 1] ✗ Sheet error → {e}")
        return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# INTERNAL — SEND EMAIL
# ═══════════════════════════════════════════════════════════════════════════════
def _build_html_email(lead: dict) -> str:
    def row(label, key):
        value = lead.get(key, "")
        if not value or str(value).strip() == "":
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
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:40px 48px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">InfoSenior<span style="color:#90caf9;">.care</span></h1>
          <p style="margin:8px 0 0;color:#bbdefb;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">New Lead Notification</p>
        </td>
      </tr>
      <tr>
        <td style="background:#e8f0fe;padding:18px 48px;border-bottom:1px solid #c5d4f5;">
          <p style="margin:0;color:#1a47a1;font-size:14px;font-weight:600;">A new lead has been captured via Infomary — please follow up promptly.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:44px 48px;">
          <p style="margin:0 0 28px;color:#1a1a2e;font-size:18px;font-weight:700;">Basic Information</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
            {row("Full Name", "name")}
            {row("Email Address", "email")}
            {row("Phone Number", "phone")}
            {row("Age", "age")}
            {row("Gender", "gender")}
            {row("Location", "location")}
            {row("Living Arrangement", "living_arrangement")}
            {row("Physician", "physician")}
            {row("Lead ID", "lead_id")}
            {row("Captured At", "saved_at")}
          </table>
          <p style="margin:0 0 28px;color:#1a1a2e;font-size:18px;font-weight:700;">Medical History</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
            {row("Conditions", "conditions")}
            {row("Hospitalizations", "hospitalizations")}
            {row("Medications", "medications")}
            {row("Allergies", "allergies")}
          </table>
          <p style="margin:0 0 28px;color:#1a1a2e;font-size:18px;font-weight:700;">Care Needs</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
            {row("Care Need", "care_need")}
            {row("Care Type", "care_type")}
            {row("Care Hours", "care_hours")}
            {row("Insurance", "insurance")}
            {row("Budget", "budget")}
          </table>
          <p style="margin:0 0 28px;color:#1a1a2e;font-size:18px;font-weight:700;">Home Environment</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:32px;">
            {row("Home Hazards", "home_hazards")}
            {row("Medical Equipment", "medical_equipment")}
            {row("Other Factors", "other_factors")}
            {row("Transportation", "transportation")}
            {row("Notes", "notes")}
          </table>
          <p style="margin:0;color:#555;font-size:14px;line-height:1.8;">
            This lead was captured automatically via the Infomary AI assistant.
            Please review and follow up at your earliest convenience.
          </p>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #ebebeb;padding:28px 48px;text-align:center;">
          <p style="margin:0 0 4px;color:#1a73e8;font-size:14px;font-weight:700;">InfoSenior.care</p>
          <p style="margin:0;color:#999;font-size:12px;">This is an automated internal notification. Please do not reply.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""


async def _send_email(lead: dict) -> dict:
    print("[Tool 2] Sending email...")
    try:
        resend.api_key = os.getenv("RESEND_API_KEY")
        resend.Emails.send({
            "from": "InfoSenior.care <onboarding@resend.dev>",
            "to": SENDER_EMAIL,
            "subject": f"New Lead: {lead.get('name', 'Unknown')} — {lead.get('care_need', 'N/A')} — {lead.get('location', 'N/A')}",
            "html": _build_html_email(lead)
        })
        print("[Tool 2] ✓ Email sent")
        return {"success": True, "message": "Email sent successfully"}
    except Exception as e:
        print(f"[Tool 2] ✗ Email error → {e}")
        return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
#  SAVE LEAD 
# ═══════════════════════════════════════════════════════════════════════════════
@tool
async def save_lead(
    name: str = "",
    email: str = "",
    phone: str = "",
    care_need: str = "",
    location: str = "",
    notes: str = "",
    age: str = "",
    gender: str = "",
    living_arrangement: str = "",
    physician: str = "",
    conditions: str = "",
    hospitalizations: str = "",
    medications: str = "",
    allergies: str = "",
    care_type: str = "",
    care_hours: str = "",
    insurance: str = "",
    budget: str = "",
    home_hazards: str = "",
    medical_equipment: str = "",
    other_factors: str = "",
    transportation: str = "",
) -> str:
    """Save the senior care lead to Google Sheet and send email notification to the team."""
    lead = {
        "lead_id"           : str(uuid.uuid4())[:8].upper(),
        "name"              : name,
        "email"             : email,
        "phone"             : phone,
        "care_need"         : care_need,
        "location"          : location,
        "status"            : "New",
        "notes"             : notes,
        "saved_at"          : datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "age"               : age,
        "gender"            : gender,
        "living_arrangement": living_arrangement,
        "physician"         : physician,
        "conditions"        : conditions,
        "hospitalizations"  : hospitalizations,
        "medications"       : medications,
        "allergies"         : allergies,
        "care_type"         : care_type,
        "care_hours"        : care_hours,
        "insurance"         : insurance,
        "budget"            : budget,
        "home_hazards"      : home_hazards,
        "medical_equipment" : medical_equipment,
        "other_factors"     : other_factors,
        "transportation"    : transportation,
    }

    print(f"\n{'='*50}")
    print(f"  New Lead → {name} | {care_need} | {location}")
    print(f"{'='*50}\n")

    sheet_result, email_result = await asyncio.gather(
        _save_to_sheet(lead),
        _send_email(lead),
    )

    print(f"  Lead ID     : {lead['lead_id']}")
    print(f"  Sheet Saved : {'✓' if sheet_result['success'] else '✗'}")
    print(f"  Email Sent  : {'✓' if email_result['success'] else '✗'}\n")

    if sheet_result["success"] and email_result["success"]:
        return f"Lead saved successfully. Lead ID: {lead['lead_id']}"
    else:
        return "Partial save — check logs for details."


# ═══════════════════════════════════════════════════════════════════════════════
# GOOGLE SEARCH 
# ═══════════════════════════════════════════════════════════════════════════════
@tool
async def google_search(query: str) -> str:
    """Search Google for nearby senior care facilities, hospitals, or services based on user location and need."""
    print(f"[Search Tool] Searching → {query}")
    try:
        api_key = os.getenv("SERPER_API_KEY")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json"
                },
                json={"q": query, "num": 5},
                timeout=10.0
            )
            results = response.json()
            organic = results.get("organic", [])

            if not organic:
                return "No results found for this search."

            output = ""
            for r in organic[:5]:
                title   = r.get("title", "")
                snippet = r.get("snippet", "")
                link    = r.get("link", "")
                output += f"• {title}\n  {snippet}\n  {link}\n\n"

            print(f"[Search Tool] ✓ {len(organic)} results found")
            return output.strip()

    except Exception as e:
        print(f"[Search Tool] ✗ Error → {e}")
        return f"Search failed: {str(e)}"