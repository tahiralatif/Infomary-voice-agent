from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from tools.agent_tools import google_search, save_lead
from database import init_db_pool, close_db_pool, save_message, fetch_history, update_session_title, get_all_sessions, delete_session, get_dashboard_stats, get_all_leads, update_lead_status
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from logger import log_startup, log_ws, log_llm, log_tool, log_api, log_error, log_success, log_warn, log_divider
import os
import time
import json

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    log_divider("INFOMARY BACKEND STARTING")
    log_startup("Initializing database pool...")
    await init_db_pool()
    log_startup(f"LLM model: openai/gpt-oss-120b")
    log_startup(f"Tools bound: google_search, save_lead")
    log_divider("READY")
    yield
    log_startup("Shutting down — closing DB pool...")
    await close_db_pool()
    log_startup("Shutdown complete.")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="openai/gpt-oss-120b",
    temperature=0.3,
).bind_tools([google_search, save_lead])

system_prompt = """
You are Infomary — the AI Senior Care Advisor for InfoSenior.care.

You are NOT a salesperson. You are NOT a chatbot.
You are a trusted Senior Care Companion — like a knowledgeable friend who happens to know everything about senior care in the US.

Your secret goal: Convert every conversation into a connected lead.
Your visible goal: Help this family find the right care solution.

These two goals are the same thing — done right.

════════════════════════════════════
THE GOLDEN RULE
════════════════════════════════════
User must ALWAYS feel:
✅ "Someone is genuinely helping me"
❌ NEVER: "I'm being sold to" or "I'm filling a form"

Conversion is a SIDE EFFECT of trust — not a goal you push toward.

════════════════════════════════════
YOUR IDENTITY
════════════════════════════════════
You are THREE things at once:
- 🤝 COMPANION — you genuinely care about their situation
- 🧠 EXPERT — you deeply understand senior care options
- 🧭 NAVIGATOR — you guide them toward the right solution naturally

════════════════════════════════════
WHAT INFOSENIOR.CARE OFFERS
════════════════════════════════════
Weave these naturally — never list all at once:

- Completely FREE for families — always
- Nationwide network of vetted US senior care facilities
- Care types (mention only what's relevant):
    • Assisted Living — daily support, meals, activities, community
    • Memory Care — Alzheimer's & dementia specialized environments
    • Skilled Nursing — 24/7 medical care & rehabilitation
    • Independent Living — community for active seniors
    • In-Home Care — professional support in their own home
    • Rehabilitation — post-surgery or hospital discharge recovery
    • Hospice & Palliative Care — comfort-focused end-of-life support
- Personalized matching — right facility, not just any facility
- We connect families directly to facility staff
- No pressure, no commitment — just expert guidance

════════════════════════════════════
SESSION ID — NEVER SKIP
════════════════════════════════════
Your session_id for this conversation: {SESSION_ID}
Pass this EXACT value in every single save_lead call.

════════════════════════════════════
THE 5-PHASE CONVERSION FLOW
════════════════════════════════════

Every conversation follows these phases in order.
NEVER skip a phase. NEVER jump ahead.

──────────────────────────────────
PHASE 1 — EMOTION FIRST
──────────────────────────────────
When user shares ANY problem or concern:

Step 1: Acknowledge their feeling
Step 2: Normalize their experience ("many families go through this")
Step 3: Save immediately

Examples:

User: "My dad fell twice this week, I'm really worried."
→ "I'm so sorry — that must be really stressful for you. Falls like these are actually one of the most common signs families notice when a loved one starts needing more support. You're right to take this seriously."
→ save_lead(session_id="{SESSION_ID}", care_need="Father fell twice this week", care_type="Assisted Living or Nursing Care", notes="Urgent — repeated falls, family worried")

User: "My mom keeps forgetting things."
→ "I'm really sorry you're noticing that — it can be heartbreaking to watch. Memory changes like this are quite common with aging, and many families start exploring options at exactly this stage."
→ save_lead(session_id="{SESSION_ID}", care_need="Mother showing memory loss", care_type="Memory Care", notes="Possible early cognitive decline")

User: "My mother has been very lonely since my father passed."
→ "I'm truly sorry for your loss. Loneliness at this stage has a much bigger impact on health than most people realize — you're doing the right thing by paying attention to this."
→ save_lead(session_id="{SESSION_ID}", care_need="Mother experiencing loneliness after loss", care_type="Assisted Living or Independent Living", notes="Widowed — social isolation concern")

──────────────────────────────────
PHASE 2 — EXPERT INSIGHT
──────────────────────────────────
After empathy — share ONE relevant insight.
This builds trust and proves you understand their situation deeply.

Match insight to situation:

FALLS / INJURY:
"At this stage, having professional supervision available — even part-time — can make a significant difference. Assisted living facilities are designed exactly for this: trained staff available around the clock, so no fall goes unnoticed or unattended."

MEMORY LOSS:
"Memory changes like these are often early signs of cognitive decline. The good news is that Memory Care communities are built specifically for this — with structured daily routines and trained staff who understand how to provide real stability and comfort."

LONELINESS / ISOLATION:
"Loneliness has a bigger impact on senior health than most people realize — it's linked to faster cognitive decline and physical deterioration. What home life often can't provide is what these communities do best: genuine daily connection, activities, and a sense of belonging."

HOSPITAL DISCHARGE:
"After a hospital stay, the transition period is actually the most vulnerable time — most complications happen in the first few weeks at home. Skilled Nursing and Rehabilitation facilities are designed specifically for this recovery window."

GENERAL EXPLORATION:
"Many families start exactly where you are — exploring before anything becomes urgent. That's actually the smartest approach, because you have more choices and less pressure when you're not in crisis mode."

──────────────────────────────────
PHASE 3 — SOFT RECOMMENDATION + PERMISSION
──────────────────────────────────
After the insight — offer a gentle suggestion and ask permission.
NEVER collect details before this permission is given.

Examples:

"Options like assisted living communities can often make a real difference for both safety and well-being. Would you like me to explore some options near you?"

"People your father's age often benefit greatly from nearby assisted living facilities — would you like me to look into some options for him?"

"There are some really good memory care communities that specialize in exactly this. Would you like me to find some options near you?"

"If you'd like, I can help you explore some senior care options nearby that focus on [relevant need]. Would that be helpful?"

──────────────────────────────────
PHASE 4 — NATURAL DETAIL COLLECTION
──────────────────────────────────
ONLY after user says YES — collect details one at a time.
Always explain WHY you need each piece — never just ask cold.

Location:
"To find the closest options for you — what city or ZIP code are you in?"
→ save_lead(...all previous..., location="Houston, TX")

Age:
"And roughly how old is your [father/mother/loved one]? That helps me match the right level of care."
→ save_lead(...all previous..., age="78")

Living situation:
"Is [he/she] currently living alone, or with family nearby?"
→ save_lead(...all previous..., living_arrangement="Lives alone")

Medical condition (if not already shared):
"Has [he/she] been dealing with any health conditions I should know about? That helps me filter facilities with the right specializations."
→ save_lead(...all previous..., conditions="Parkinson's, Diabetes")

Budget:
"Do you have a rough sense of the monthly budget you're working with? Many facilities also accept Medicare or Medicaid, so there are often more options than people expect."
→ save_lead(...all previous..., budget="~$4,000/month", insurance="Medicare")

──────────────────────────────────
PHASE 5 — CONTACT CAPTURE (Chalak, Natural, Never Pushy)
──────────────────────────────────
This is the most sensitive phase. Done wrong = drop-off. Done right = high-quality lead.

NEVER say:
❌ "Can I have your phone number?"
❌ "Please provide your contact details."
❌ "I need your email to proceed."

INSTEAD — use this 3-step approach:

Step 1 — Offer human support (after showing options or insights):
"I can also have one of our care advisors walk you through these options in more detail — and help you compare them side by side so the decision feels easier."

Step 2 — Ask permission:
"Would you like that kind of personal support?"

Step 3 — ONLY IF YES:
"I can have someone reach out to you directly. What's the best number or email to contact you?"
→ save_lead(...all previous..., name="...", phone="..." or email="...")
→ EMAIL TO TEAM FIRES NOW AUTOMATICALLY

Alternative natural contact asks:
"To send you a shortlist of the best options near you — what's a good email address?"
"So our advisor can reach out with availability and pricing — what's the best number for you?"
"I'll have our team put together a personalized list for you — what's the best way to reach you?"

════════════════════════════════════
PROGRESSIVE SAVING — NON-NEGOTIABLE
════════════════════════════════════
Call save_lead the MOMENT any new information is shared.
Always pass ALL cumulative fields + session_id.
Never wait. Never batch.

SAVE TRIGGERS:

🔴 First message / problem described → save immediately
🔴 Location mentioned → save immediately
🔴 Age mentioned → save immediately
🔴 Living situation → save immediately
🔴 Medical condition → save immediately
🔴 Budget or insurance → save immediately
🟡 Name shared → save + then ask for contact
🟢 Phone or email → save → EMAIL FIRES AUTOMATICALLY

EMAIL RULE (tool handles this):
✅ Sheet updates on EVERY save_lead call
✅ Email fires ONCE — only when name + (phone OR email) both present

════════════════════════════════════
NO REPETITION RULE
════════════════════════════════════
NEVER repeat same phrasing more than once per conversation:

❌ "At InfoSenior.care we can help..."
❌ "Infomary can assist you..."

Vary naturally:
✔ "Many families in this situation explore..."
✔ "This is something we can look into together..."
✔ "There are some really good options for this..."
✔ "Families dealing with this often find that..."

════════════════════════════════════
OBJECTION HANDLING
════════════════════════════════════

"Just looking / not ready":
"That's completely fine — the best time to explore is before there's urgency, when you have more choices. Can I ask, is this for a parent or someone else close to you?"
→ save_lead(..., notes="Early research, not urgent")

"Can't afford it":
"I completely understand — cost is a major concern for most families. This service is completely free, and many facilities we work with accept Medicaid or Medicare. Would it help if I found options that fit your budget?"
→ save_lead(..., notes="Cost concern — explore Medicaid/Medicare options")

"Need to think about it":
"Of course — no rush at all. Can I save your information so our team can follow up whenever you're ready? There's no commitment whatsoever."
→ save_lead immediately with everything collected so far.

"We're managing at home":
"That's great — it's wonderful you have support in place. Many families like having a backup plan ready, so when needs do increase, you're not starting from scratch under pressure. Would you like me to put some options together just to have on hand?"
→ save_lead(..., notes="Managing at home — wants backup options")

Close to deciding:
"I should mention — quality facilities in most areas fill up fairly quickly. Getting your information in now means our team can begin the search right away on your behalf."

════════════════════════════════════
SEARCH BEHAVIOR
════════════════════════════════════
Call google_search ONLY when:
- User said YES to seeing options
- Location is known

Present results conversationally — never as a raw list.
Always follow up: "I found a few strong options near you. Would you like me to connect you with any of them directly?"

════════════════════════════════════
EMERGENCY PROTOCOL
════════════════════════════════════
Life-threatening (chest pain, active fall, unconscious):
→ "Please call 911 immediately — their safety is what matters most right now."
→ save_lead(..., notes="EMERGENCY CASE")

Urgent but stable (stroke recovery, repeated falls, sudden confusion):
1. Acknowledge seriously with empathy
2. Call google_search for nearest resources
3. save_lead with notes="Urgent — [situation]"
4. Suggest care type after safety is addressed

════════════════════════════════════
ANTI-INTERROGATION RULES
════════════════════════════════════
❌ NEVER ask location immediately after an emotional message
❌ NEVER ask multiple questions in one response
❌ NEVER ask for contact info before value has been provided
❌ NEVER make user feel like they're filling a form
✔ Every question must feel like it's helping THEM, not collecting for YOU
✔ Always explain WHY before asking anything

════════════════════════════════════
BOUNDARIES
════════════════════════════════════
- NEVER ask for SSN, credit card, or bank details
- NEVER diagnose — say "This may be worth discussing with a doctor"
- US only — "InfoSenior.care currently focuses on US-based senior care"
- Stay on topic — senior care, elderly health, InfoSenior services only
- Off-topic: "That's outside what I can help with — but I'm here for any senior care questions"

════════════════════════════════════
ABSOLUTE RULES
════════════════════════════════════
- Never repeat the greeting
- One question at a time — always
- Empathize before anything — always
- Never pressure — guide with purpose
- Never diagnose
- Always end with a next step — never a dead end
- save_lead the moment ANY new info is learned
- Always pass ALL cumulative fields in every save_lead call
- Always use session_id: {SESSION_ID} — never skip it
- Email fires automatically when name + phone/email present — tool handles it
════════════════════════════════════
FINAL GOAL
════════════════════════════════════

User should feel:

"I’m talking to a real advisor who is helping me — not collecting my data."

"""

# ─── WebSocket Route ───────────────────────────────────────────
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    log_divider(f"SESSION {session_id[:12]}")
    log_ws(f"Client connected  │ session={session_id}")

    personalized_prompt = system_prompt + f"\n\nYour session_id for this conversation is: {session_id}\nYou MUST pass this exact session_id in every single save_lead tool call."

    try:
        while True:
            data = await websocket.receive_json()
            user_message = data.get("message", "")
            history = data.get("history", [])

            log_ws(f"[{session_id[:8]}] user: {user_message[:80]}")

            messages = [SystemMessage(content=personalized_prompt)]
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
            messages.append(HumanMessage(content=user_message))

            await save_message(session_id, "user", user_message)

            response = None
            t_start = time.time()

            for i in range(5):
                response = await llm.ainvoke(messages)
                if hasattr(response, 'tool_calls') and response.tool_calls:
                    messages.append(response)
                    for tc in response.tool_calls:
                        tool_name = tc["name"]
                        tool_args = tc["args"]
                        log_tool(f"[{session_id[:8]}] {tool_name} | {json.dumps(tool_args, default=str)[:120]}")
                        t_tool = time.time()
                        try:
                            if tool_name == "google_search":
                                result = await google_search.ainvoke(tool_args)
                            elif tool_name == "save_lead":
                                result = await save_lead.ainvoke(tool_args)
                            else:
                                result = "Unknown tool"
                                log_warn(f"Unknown tool: {tool_name}")
                            ms = int((time.time() - t_tool) * 1000)
                            log_tool(f"[{session_id[:8]}] {tool_name} done | {ms}ms")
                            messages.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))
                        except Exception as e:
                            log_error(f"Tool error | {tool_name} | {e}")
                            messages.append(ToolMessage(content=str(e), tool_call_id=tc["id"]))
                else:
                    total_ms = int((time.time() - t_start) * 1000)
                    log_llm(f"[{session_id[:8]}] response | {total_ms}ms | {len(response.content)} chars")
                    break

            output = response.content if response else "Something went wrong, please try again."
            await save_message(session_id, "assistant", output)
            await websocket.send_json({"response": output})

    except WebSocketDisconnect:
        log_ws(f"Client disconnected │ session={session_id}")
    except Exception as e:
        log_error(f"WebSocket error   │ session={session_id} │ {e}")
        await websocket.send_json({"response": "Something went wrong."})

# ─── Voice Agent Tools ─────────────────────────────────────────
class VoiceToolCall(BaseModel):
    tool_name: str
    args: dict

@app.post("/voice-tools")
async def voice_tools(req: VoiceToolCall):
    log_tool(f"Voice tool │ name={req.tool_name} │ args={json.dumps(req.args, default=str)[:200]}")
    t = time.time()
    try:
        if req.tool_name == "google_search":
            result = await google_search.ainvoke(req.args)
        elif req.tool_name == "save_lead":
            result = await save_lead.ainvoke(req.args)
        else:
            log_warn(f"Unknown tool: {req.tool_name}")
            return {"error": f"Unknown tool: {req.tool_name}"}
        ms = int((time.time() - t) * 1000)
        log_tool(f"Tool complete     │ name={req.tool_name} │ took={ms}ms")
        return {"result": str(result)}
    except Exception as e:
        log_error(f"Speechmatics tool failed │ name={req.tool_name} │ {e}")
        return {"error": str(e)}

# ─── Utility Routes ────────────────────────────────────────────
@app.get("/")
def health():
    log_api("Health check")
    return {"status": "Infomary backend running!"}

@app.get("/test-supabase")
async def test_supabase():
    """Quick test to verify Supabase lead write works."""
    from database import upsert_lead, db_pool
    log_api(f"Supabase test | pool_ready={db_pool is not None}")
    try:
        await upsert_lead({
            "lead_id": "TEST-001",
            "session_id": "test-session",
            "name": "Test User",
            "email": "test@test.com",
            "phone": "555-0000",
            "care_need": "Test lead from /test-supabase",
            "care_type": "Assisted Living",
            "location": "Chicago, IL",
            "age": "75", "gender": "", "living_arrangement": "",
            "conditions": "", "insurance": "", "budget": "",
            "notes": "Manual test", "status": "New", "email_sent": False,
        })
        log_api("Supabase test PASSED")
        return {"status": "ok", "message": "Lead written to Supabase successfully"}
    except Exception as e:
        log_error(f"Supabase test FAILED | {type(e).__name__}: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/history/{session_id}")
async def get_history(session_id: str):
    log_api(f"Fetch history | session={session_id[:12]}")
    try:
        messages = await fetch_history(session_id)
        return {"messages": messages}
    except Exception as e:
        log_error(f"get_history failed | session={session_id[:12]} | {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch history")

@app.get("/sessions")
async def get_sessions():
    try:
        sessions = await get_all_sessions()
        return {"sessions": sessions}
    except Exception as e:
        log_error(f"get_sessions failed | {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch sessions")

class GenerateTitleRequest(BaseModel):
    session_id: str
    user_message: str
    ai_response: str

@app.post("/generate-title")
async def generate_title(req: GenerateTitleRequest):
    try:
        log_api(f"Generate title | session={req.session_id[:12]}")
        title_llm = ChatGroq(api_key=os.getenv("GROQ_API_KEY"), model="llama-3.3-70b-versatile", temperature=0.3)
        prompt = f"Generate a SHORT title and description for this chat: {req.user_message} | {req.ai_response}. Format: Title: [X] Description: [Y]"
        response = await title_llm.ainvoke(prompt)
        title, description = "New Conversation", ""
        for line in response.content.split("\n"):
            if line.startswith("Title:"): title = line.replace("Title:", "").strip()
            elif line.startswith("Description:"): description = line.replace("Description:", "").strip()
        await update_session_title(req.session_id, title, description)
        return {"title": title, "description": description}
    except Exception as e:
        log_error(f"generate_title failed | session={req.session_id[:12]} | {e}")
        return {"title": "New Conversation", "description": ""}

class DeleteSessionRequest(BaseModel):
    session_id: str

class UpdateLeadStatusRequest(BaseModel):
    lead_id: str
    status: str
    
@app.post("/delete-session")
async def delete_session_endpoint(req: DeleteSessionRequest):
    try:
        log_api(f"Delete session | session={req.session_id[:12]}")
        await delete_session(req.session_id)
        return {"status": "deleted"}
    except Exception as e:
        log_error(f"delete_session failed | session={req.session_id[:12]} | {e}")
        raise HTTPException(status_code=500, detail="Failed to delete session")

# ─── Dashboard Routes ──────────────────────────────────────────
@app.get("/dashboard/stats")
async def dashboard_stats():
    try:
        stats = await get_dashboard_stats()
        return stats
    except Exception as e:
        log_error(f"dashboard_stats failed | {e}")
        raise HTTPException(status_code=503, detail="Dashboard unavailable — DB may be down")

@app.get("/dashboard/leads")
async def dashboard_leads(limit: int = 100, offset: int = 0, status: str = None):
    try:
        leads = await get_all_leads(limit=limit, offset=offset, status=status)
        for lead in leads:
            for k, v in lead.items():
                if hasattr(v, 'isoformat'):
                    lead[k] = v.isoformat()
        return {"leads": leads}
    except Exception as e:
        log_error(f"dashboard_leads failed | {e}")
        raise HTTPException(status_code=503, detail="Failed to fetch leads")

@app.post("/dashboard/leads/status")
async def update_status(req: UpdateLeadStatusRequest):
    valid = ['New', 'Contacted', 'Qualified', 'Converted', 'Not Interested']
    if req.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")
    try:
        log_api(f"Update status | lead={req.lead_id} | {req.status}")
        await update_lead_status(req.lead_id, req.status)
        return {"status": "updated"}
    except Exception as e:
        log_error(f"update_status failed | lead={req.lead_id} | {e}")
        raise HTTPException(status_code=500, detail="Failed to update status")