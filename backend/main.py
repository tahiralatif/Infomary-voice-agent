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

# Initialize LLM with tools
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="openai/gpt-oss-120b",
    temperature=0.3,
).bind_tools([google_search, save_lead])

system_prompt = """
You are Infomary, the AI care advisor for InfoSenior.care — a senior care navigation platform serving families across the United States.

# YOUR IDENTITY
You are InfoSenior's most important relationship-builder.
Your role is to:
1. Make the user feel heard and safe
2. Understand their situation deeply
3. Show them how InfoSenior.care can help
4. Convert them into a connected lead — naturally, never pushily

You are warm, professional, and genuinely caring.

---

# INFOSENIOR.CARE — WHAT YOU REPRESENT
When relevant, naturally mention these capabilities:
- Free guidance — no cost to users
- Nationwide facility network
- Care types: Assisted Living, Memory Care, Skilled Nursing, In-Home Care, etc.
- Personalized matching based on needs, location, and budget

---

# PERSONALITY
- Warm, calm, and trustworthy
- Empathetic first, solution-focused second
- Speak like a trusted friend who is also an expert

---

# GREETING (ONCE ONLY)
Start every new conversation with:
"Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care — completely free of charge. How can I help you today?"

---

# CONVERSATION FLOW
1. LISTEN & EMPATHIZE: Acknowledge what the user shares.
2. UNDERSTAND: Ask gentle, natural questions one at a time.
3. SHOW VALUE: Connect their situation to InfoSenior's services.
4. COLLECT & SAVE LEAD: Call save_lead tool as soon as new info is learned.

---

# CORE TOOL RULES
- Call save_lead the moment any new field is learned (location, name, conditions, etc.).
- Always pass ALL cumulative info plus the session_id.
- For location requests, call google_search and present results conversationally.

---

# PRIVACY & BOUNDARIES
- NEVER ask for or accept SSN, credit card, or bank details.
- US only operations.
- Never diagnose medical conditions.
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

    # Ensure a session ID exists
    active_session_id = req.session_id or str(uuid.uuid4())[:8].upper()
    
    # Inject current session ID into prompt
    personalized_prompt = system_prompt + f"\n\nYour session_id for this conversation is: {active_session_id}\nYou MUST pass this exact session_id in every single save_lead tool call."

    messages = [SystemMessage(content=personalized_prompt)]
    
    # Reconstruct conversation history
    for msg in req.history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    
    messages.append(HumanMessage(content=req.message))
    
    max_iterations = 5
    iteration = 0
    
    while iteration < max_iterations:
        iteration += 1
        logger.info(f"[LLM] Invoking LLM (iteration {iteration})")
        
        response = await llm.ainvoke(messages)
        
        if hasattr(response, 'tool_calls') and response.tool_calls:
            logger.info(f"[TOOLS] Found {len(response.tool_calls)} tool call(s)")
            messages.append(response)
            
            for tool_call in response.tool_calls:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_id = tool_call.get("id")
                
                logger.info(f"[TOOLS] Executing: {tool_name}")
                
                try:
                    if tool_name == "google_search":
                        result = await google_search.ainvoke(tool_args)
                    elif tool_name == "save_lead":
                        result = await save_lead.ainvoke(tool_args)
                    else:
                        result = f"Unknown tool: {tool_name}"
                    
                    messages.append(ToolMessage(content=str(result), tool_call_id=tool_id))
                except Exception as e:
                    logger.error(f"[TOOLS] Error: {e}")
                    messages.append(ToolMessage(content=f"Error: {str(e)}", tool_call_id=tool_id))
        else:
            break
    
    output = response.content
    
    if req.session_id:
        await save_message(req.session_id, "user", req.message)
        await save_message(req.session_id, "assistant", output)
        
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
    try:
        if req.tool_name == "google_search":
            result = await google_search.ainvoke(req.args)
        elif req.tool_name == "save_lead":
            result = await save_lead.ainvoke(req.args)
        else:
            return {"error": f"Unknown tool: {req.tool_name}"}
        return {"result": str(result)}
    except Exception as e:
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
    
    prompt = f"Generate a SHORT title and description for this chat: {req.user_message} | {req.ai_response}. Format: Title: [X] Description: [Y]"
    response = await title_llm.ainvoke(prompt)
    content = response.content
    
    title = "New Conversation"
    description = ""
    for line in content.split("\n"):
        if line.startswith("Title:"): title = line.replace("Title:", "").strip()
        elif line.startswith("Description:"): description = line.replace("Description:", "").strip()
    
    await update_session_title(req.session_id, title, description)
    return {"title": title, "description": description}

class DeleteSessionRequest(BaseModel):
    session_id: str

@app.post("/delete-session")
async def delete_session_endpoint(req: DeleteSessionRequest):
    await delete_session(req.session_id)
    return {"status": "deleted"}
