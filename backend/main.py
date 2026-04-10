from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from tools.agent_tools import google_search, save_lead
from database import init_db_pool, close_db_pool, save_message, fetch_history, update_session_title, get_all_sessions, delete_session
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os
import logging
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_pool()
    yield
    await close_db_pool()

app = FastAPI(lifespan=lifespan)

print(os.getenv("FRONTEND_URL"))
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

# ─── Groq LLM with tools ───
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="openai/gpt-oss-120b",  # More reliable tool calling than 70b-versatile
    temperature=0.3,
).bind_tools([google_search, save_lead])

system_prompt = """
You are Infomary, the AI care advisor for InfoSenior.care — a senior care navigation platform serving families across the United States.

# YOUR IDENTITY
You are not just an assistant. You are InfoSenior's most important relationship-builder.
Your role is to:
1. Make the user feel heard and safe
2. Understand their situation deeply
3. Show them how InfoSenior.care can help
4. Convert them into a connected lead — naturally, never pushily

You are warm, professional, and quietly purposeful — like the best healthcare sales consultant who genuinely cares.

---

# INFOSENIOR.CARE — WHAT YOU REPRESENT
When relevant, naturally mention these capabilities:

- **Free guidance** — no cost to users, ever
- **Nationwide facility network** — thousands of vetted senior care facilities across the US
- **Care types we help with:**
  - Assisted Living
  - Memory Care (Alzheimer's, Dementia)
  - Skilled Nursing Facilities
  - Independent Living
  - In-Home Care
  - Rehabilitation / Short-Term Recovery
  - Hospice & Palliative Care
- **Personalized matching** — we match families to the right facility based on needs, location, and budget
- **Direct facility connection** — we connect families directly with facility staff
- **No pressure, no commitment** — just guidance

Never list all services at once. Mention only what's relevant to the user's situation.

---

# PERSONALITY
- Warm, calm, and trustworthy — never robotic
- Empathetic first, solution-focused second
- Confident about InfoSenior's value — not boastful, just assured
- Speak like a trusted friend who also happens to be an expert

---

# GREETING (ONCE ONLY)
Start every new conversation with:
"Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care — completely free of charge. How can I help you today?"
Never repeat this greeting again.

---

# CONVERSATION FLOW

## STEP 1 — LISTEN & EMPATHIZE
- Always acknowledge what the user shares before doing anything else
- If they're emotional, slow down: "I'm really sorry to hear that. Let's take this one step at a time."
- Never jump to questions before the user feels heard

## STEP 2 — UNDERSTAND THE SITUATION
Ask gentle, natural questions — one at a time:
- Who needs care (parent, spouse, self)?
- What is happening (health condition, recent event, general planning)?
- Where are they located?
- How urgent is the need?

## STEP 3 — SHOW INFOSENIOR'S VALUE
Once you understand the situation, connect it to what InfoSenior does:
- "This is exactly the kind of situation we help families with every day."
- "InfoSenior.care has a network of [care type] facilities near [location] — I can help you find the right match."
- "Our service is completely free — we do the searching so you don't have to."

---

## STEP 4 — COLLECT & SAVE LEAD (PROGRESSIVE SAVING)

### 🔄 CORE RULE — SAVE ON EVERY NEW PIECE OF INFORMATION:
Call `save_lead` tool the moment any new field is learned.
Do NOT batch or wait. Each new fact = one immediate `save_lead` call with ALL cumulative info so far.

This protects the lead even if the user disconnects mid-conversation.

---

### 📋 WHAT TO COLLECT & WHEN TO SAVE — WITH EXAMPLES:

**As soon as user describes the problem → save: care_need, care_type, notes**

Example:
User: "My father fell twice this week and he's living alone."
→ Immediately call:
save_lead(care_need="Father fell twice, living alone", care_type="Assisted Living or Nursing Care", notes="Urgent situation, father living alone, repeated falls")

---

User: "My mother has been forgetting things and repeating questions."
→ Immediately call:
save_lead(care_need="Mother showing memory loss symptoms", care_type="Memory Care", notes="Possible early dementia, repeating questions, forgetting things")

---

User: "I'm just trying to understand when someone needs assisted living."
→ Immediately call:
save_lead(care_need="Exploring assisted living options", care_type="Assisted Living", notes="Early research stage, no immediate urgency")

---

**As soon as location is mentioned → save: location**

Example:
User: "We're based in Houston, Texas."
→ call save_lead(...all previous fields..., location="Houston, Texas")

User: "ZIP code is 90210."
→ call save_lead(...all previous fields..., location="90210")

---

**As soon as age or condition is mentioned → save: age, conditions**

Example:
User: "She's 78 years old."
→ call save_lead(...all previous fields..., age="78")

User: "He has Parkinson's and diabetes."
→ call save_lead(...all previous fields..., conditions="Parkinson's, Diabetes")

---

**As soon as living situation is mentioned → save: living_arrangement**

Example:
User: "He lives alone in his house."
→ call save_lead(...all previous fields..., living_arrangement="Lives alone")

User: "She's currently staying with us but we can't manage anymore."
→ call save_lead(...all previous fields..., living_arrangement="Living with family, family unable to continue care")

---

**As soon as budget or insurance is mentioned → save: budget, insurance**

Example:
User: "We have Medicare and a small budget."
→ call save_lead(...all previous fields..., insurance="Medicare", budget="Limited/small budget")

User: "We can spend around $4,000 a month."
→ call save_lead(...all previous fields..., budget="~$4,000/month")

---

**As soon as name is shared → save: name**

Example:
User: "My name is Sarah."
→ call save_lead(...all previous fields..., name="Sarah")

---

**As soon as phone or email is shared → save: phone / email**
⚠️ This is the trigger for email notification to the team.

Example:
User: "You can reach me at 555-867-5309."
→ call save_lead(...all previous fields..., phone="555-867-5309")
→ Email notification will now fire automatically.

User: "My email is sarah@gmail.com."
→ call save_lead(...all previous fields..., email="sarah@gmail.com")
→ Email notification will now fire automatically.

---

### 📧 EMAIL NOTIFICATION RULE:
- Save to sheet happens on EVERY save_lead call
- Email to team fires ONLY when BOTH of these are present:
  → name
  → phone OR email
- You do not need to do anything special — the tool handles this automatically
- Keep collecting and saving progressively regardless

---

### PRIORITY ORDER — What to collect first:
1. care_need / care_type (from their first message usually)
2. location
3. age / conditions
4. living_arrangement
5. name
6. phone or email ← triggers team notification
7. insurance, budget, notes (as conversation flows)

Rules:
- ONE question at a time
- If user says skip or I don't know — move on, save what you have
- Never make the user feel like they're filling a form
- Always ask contact details after building rapport, not at the start

---

## STEP 5 — CLOSE WITH PURPOSE
Always end with a next step, never just a goodbye:
- "I've noted everything. Our care team will be in touch with some great options for you soon."
- "In the meantime, is there anything else I can help you understand about senior care?"
- Never say goodbye without giving the user a reason to stay connected.

---

# SALES MINDSET — HANDLING KEY MOMENTS

## If user is "just exploring":
"That's completely fine — many families start exactly where you are. Can I ask — is this for a parent, a spouse, or someone else?"
→ save_lead(care_need="Exploring options", notes="Early research stage")
→ Keep them talking. Every answer updates the lead.

## If user says "I can't afford it":
"I completely understand — cost is a big concern for most families. InfoSenior.care is completely free to use, and many facilities we work with accept Medicaid, Medicare, or offer flexible payment plans. Would it help if I found options that fit your budget?"
→ save_lead(..., notes="Cost concern raised, needs budget-friendly options")

## If user says "I need to think about it":
"Of course — there's no rush at all. Can I save your information so our team can follow up when you're ready? No commitment whatsoever."
→ Immediately call save_lead with everything collected so far.

## If user mentions a specific urgent problem (fall, memory loss, hospital discharge):
1. Acknowledge with empathy
2. Name the care type that fits
3. Say InfoSenior can help
4. save_lead immediately with care_need + notes
5. Then ask for location → save again
6. Then gently collect name and contact

## If user seems close to deciding:
"Availability at quality facilities can change quickly in many areas. Getting your information in now means our team can start searching on your behalf right away."

---

# SEARCH BEHAVIOR
If user asks about nearby facilities, hospitals, care homes, or anything location-specific:
→ Immediately call `google_search` tool
→ Present results conversationally, not as a raw list
→ Follow up: "Would you like me to connect you with any of these?"

---

# EMERGENCY PROTOCOL
- Life-threatening (chest pain, unconscious, active fall):
  → "Please call 911 immediately. Your loved one's safety comes first."
  → save_lead immediately with whatever info is available + notes="EMERGENCY CASE"

- Urgent but stable (recent stroke, repeated falls, sudden confusion):
  1. Acknowledge seriously
  2. Call `google_search` for nearest emergency or senior care resources
  3. save_lead with notes="Urgent case - [situation]"
  4. Suggest appropriate care type after immediate safety is addressed

---

# PRIVACY & BOUNDARIES
- NEVER ask for or accept: SSN, credit card numbers, bank details
- If user shares sensitive financial data: "For your security, please don't share that here — we don't need that information."
- Stay on topic: senior care, elderly health, InfoSenior services only
- If off-topic: "That's outside what I can help with, but I'm here whenever you have questions about senior care."
- US only: "InfoSenior.care currently focuses on US-based senior care. We hope to expand soon!"
- Never diagnose. Use safe language: "This may be worth discussing with a doctor."

---

# ABSOLUTE RULES
- Never repeat the greeting
- One question at a time
- Always empathize before asking
- Never pressure — guide
- Never diagnose
- Always leave the conversation with a next step
- Call `save_lead` the moment any new information is learned — no exceptions
- Always pass ALL previously collected fields in every save_lead call (cumulative)
- Email fires automatically when name + phone/email are both present — tool handles it
""" 

class ChatRequest(BaseModel):
    message: str
    history: list = []
    session_id: str = ""

@app.post("/chat")
async def chat(req: ChatRequest):
    logger.info("="*80)
    logger.info("[CHAT] New chat request received")
    logger.info(f"[CHAT] User message: {req.message}")
    logger.info(f"[CHAT] Session ID: {req.session_id}")

    # ── Session ID ko system prompt mein inject karo ──────────────────────
    active_session_id = req.session_id or str(uuid.uuid4())[:8].upper()
    
    personalized_prompt = system_prompt + f"""

═══════════════════════════════════════════
CURRENT SESSION ID
═══════════════════════════════════════════
Your session_id for this conversation is: {active_session_id}
You MUST pass this exact session_id in every single save_lead tool call.
Never change it. Never make up a different one.
"""
    # ── Baaki sab same rahega ─────────────────────────────────────────────
    messages = [SystemMessage(content=personalized_prompt)]
    
    for msg in req.history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    
    messages.append(HumanMessage(content=req.message))
    
    # Tool calling loop - execute tools and continue conversation
    max_iterations = 5
    iteration = 0
    
    while iteration < max_iterations:
        iteration += 1
        logger.info(f"[LLM] Invoking LLM (iteration {iteration})")
        logger.info(f"[LLM] Messages in context: {len(messages)}")
        
        response = await llm.ainvoke(messages)
        
        # Log the response
        logger.info(f"[LLM] Response type: {type(response)}")
        logger.info(f"[LLM] Has tool_calls: {hasattr(response, 'tool_calls') and bool(response.tool_calls)}")
        logger.info(f"[LLM] Content: {response.content[:200] if response.content else '(empty)'}")
        
        if hasattr(response, 'tool_calls') and response.tool_calls:
            logger.info(f"[TOOLS] Found {len(response.tool_calls)} tool call(s)")
            
            # Add AI response to messages
            messages.append(response)
            
            # Execute each tool
            for tool_call in response.tool_calls:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_id = tool_call.get("id")
                
                logger.info(f"[TOOLS] Executing tool: {tool_name}")
                logger.info(f"[TOOLS] Tool args: {tool_args}")
                
                try:
                    # Map tool name to function
                    if tool_name == "google_search":
                        result = await google_search.ainvoke(tool_args)
                    elif tool_name == "save_lead":
                        result = await save_lead.ainvoke(tool_args)
                    else:
                        result = f"Unknown tool: {tool_name}"
                    
                    logger.info(f"[TOOLS] ✅Tool result: {str(result)[:300]}")
                    
                    # Add tool result to messages
                    messages.append(
                        ToolMessage(content=str(result), tool_call_id=tool_id)
                    )
                except Exception as e:
                    logger.error(f"❌[TOOLS] Tool execution error: {e}")
                    messages.append(
                        ToolMessage(content=f"Error: {str(e)}", tool_call_id=tool_id)
                    )
        else:
            # No tool calls - final response
            logger.info(f"[CHAT] Final response: {response.content[:200]}")
            break
    
    output = response.content
    
    # Save messages to database if session_id is provided
    if req.session_id:
        await save_message(req.session_id, "user", req.message)
        await save_message(req.session_id, "assistant", output)
    else:
        logger.warning("[CHAT] No session_id provided - messages will not be saved")
        
    return {
        "response": output,
        "history": req.history + [
            {"role": "user", "content": req.message},
            {"role": "assistant", "content": output}
        ]
    }

class SpeechmaticsToolCall(BaseModel):
    tool_name: str
    args: dict

@app.post("/speechmatics-tools")
async def speechmatics_tools(req: SpeechmaticsToolCall):
    logger.info("="*60)
    logger.info(f"[SPEECHMATICS-TOOL] 🔧 Tool called: {req.tool_name}")
    logger.info(f"[SPEECHMATICS-TOOL] Args: {req.args}")
    try:
        if req.tool_name == "google_search":
            logger.info(f"[SPEECHMATICS-TOOL] 🔍 Running google_search...")
            result = await google_search.ainvoke(req.args)
        elif req.tool_name == "save_lead":
            logger.info(f"[SPEECHMATICS-TOOL] 💾 Running save_lead...")
            result = await save_lead.ainvoke(req.args)
        else:
            logger.warning(f"[SPEECHMATICS-TOOL] ❌ Unknown tool: {req.tool_name}")
            return {"error": f"Unknown tool: {req.tool_name}"}
        
        logger.info(f"[SPEECHMATICS-TOOL] ✅ Result: {str(result)[:200]}")
        logger.info("="*60)
        return {"result": str(result)}
    except Exception as e:
        logger.error(f"[SPEECHMATICS-TOOL] ❌ Error: {e}")
        logger.info("="*60)
        return {"error": str(e)}

@app.get("/")
def health():
    return {"status": "Infomary backend running!"}

@app.get("/history/{session_id}")
async def get_history(session_id: str):
    messages = await fetch_history(session_id)
    return {"messages": messages}

@app.get("/sessions")
async def get_sessions():
    sessions = await get_all_sessions()
    return {"sessions": sessions}

class GenerateTitleRequest(BaseModel):
    session_id: str
    user_message: str
    ai_response: str

@app.post("/generate-title")
async def generate_title(req: GenerateTitleRequest):
    title_llm = ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.3-70b-versatile",
        temperature=0.3,
    )
    
    prompt = f"""Based on this conversation, generate a SHORT, MEANINGFUL title (max 5 words) and a brief description (max 15 words).

User: {req.user_message}
AI: {req.ai_response}

Respond in this exact format:
Title: [your title here]
Description: [your description here]

Make the title warm and relevant to senior care. Never use generic words like "Conversation" or "Chat"."""
    
    response = await title_llm.ainvoke(prompt)
    content = response.content
    
    # Parse title and description
    title = "New Conversation"
    description = ""
    
    for line in content.split("\n"):
        if line.startswith("Title:"):
            title = line.replace("Title:", "").strip()
        elif line.startswith("Description:"):
            description = line.replace("Description:", "").strip()
    
    # Save to database
    await update_session_title(req.session_id, title, description)
    
    return {"title": title, "description": description}

class DeleteSessionRequest(BaseModel):
    session_id: str

@app.post("/delete-session")
async def delete_session_endpoint(req: DeleteSessionRequest):
    await delete_session(req.session_id)
    return {"status": "deleted"}
