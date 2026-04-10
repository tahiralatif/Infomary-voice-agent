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
import json

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
# Note: Using temperature 0.1 for more deterministic tool selection in production
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="openai/gpt-oss-120b",
    temperature=0.1, 
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

You are warm, professional, and quietly purposeful.

---

# CORE TOOL RULES (MANDATORY)

## 🔄 save_lead — CALL ON EVERY NEW PIECE OF INFORMATION
You MUST call `save_lead` the moment any new field is learned (location, name, phone, email, condition, etc.).
Do NOT wait. Call it immediately as part of your turn.
Always pass ALL fields collected so far plus the session_id.

## 🔍 google_search — CALL FOR ANY LOCATION OR SERVICE REQUEST
If the user asks for facilities, hospitals, or services in a specific city/ZIP:
1. Immediately call `google_search`.
2. Also call `save_lead` to record that location.

---

# CONVERSATION FLOW

1. **Listen & Empathize**: Acknowledge the user's situation before asking anything.
2. **Understand**: Ask gentle questions one at a time.
3. **Capture**: Every time they answer a question (e.g., "I'm in Chicago"), use `save_lead`.
4. **Research**: Use `google_search` for facilities.
5. **Convert**: Collect name and phone/email to trigger team follow-up.

Rules:
- ONE question at a time.
- Never diagnose.
- Always provide a next step.
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
    
    personalized_prompt = system_prompt + f"\n\nCRITICAL: Your session_id for this conversation is: {active_session_id}. You MUST pass this exact session_id in every single save_lead tool call."

    messages = [SystemMessage(content=personalized_prompt)]
    
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
        
        # Log if tools were generated
        has_tools = hasattr(response, 'tool_calls') and bool(response.tool_calls)
        logger.info(f"[LLM] Response received. Has tools: {has_tools}")
        
        if has_tools:
            messages.append(response)
            for tool_call in response.tool_calls:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_id = tool_call.get("id")
                
                # Ensure session_id is present for save_lead
                if tool_name == "save_lead" and not tool_args.get("session_id"):
                    tool_args["session_id"] = active_session_id
                
                logger.info(f"[TOOLS] Executing: {tool_name} with args: {json.dumps(tool_args)}")
                
                try:
                    if tool_name == "google_search":
                        result = await google_search.ainvoke(tool_args)
                    elif tool_name == "save_lead":
                        result = await save_lead.ainvoke(tool_args)
                    else:
                        result = f"Unknown tool: {tool_name}"
                    
                    messages.append(ToolMessage(content=str(result), tool_call_id=tool_id))
                    logger.info(f"[TOOLS] Result successful")
                except Exception as e:
                    logger.error(f"[TOOLS] Error: {e}")
                    messages.append(ToolMessage(content=f"Error: {str(e)}", tool_call_id=tool_id))
        else:
            break
    
    output = response.content
    
    # Save messages to database
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
    logger.info("="*60)
    logger.info(f"[SPEECHMATICS-TOOL] Tool: {req.tool_name}")
    try:
        if req.tool_name == "google_search":
            result = await google_search.ainvoke(req.args)
        elif req.tool_name == "save_lead":
            result = await save_lead.ainvoke(req.args)
        else:
            return {"error": f"Unknown tool: {req.tool_name}"}
        return {"result": str(result)}
    except Exception as e:
        logger.error(f"[SPEECHMATICS-TOOL] Error: {e}")
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
