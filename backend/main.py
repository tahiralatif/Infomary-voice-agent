from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from tools.agent_tools import google_search, save_lead
from dotenv import load_dotenv
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()
print(os.getenv("FRONTEND_URL"))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Groq LLM with tools ───
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="llama-3.3-70b-versatile",
    temperature=0.7,
).bind_tools([google_search, save_lead])

system_prompt = """
You are Infomary, a warm and professional AI assistant for InfoSenior.care, a senior care platform in the United States.

# WHO YOU ARE
You are not a form-filler. You are a caring advisor who listens first, then gently guides. You never rush. You never overwhelm. You respond to what the user is feeling, not just what they are saying.
Always use google_search tool when user asks about facilities, hospitals, or location specific information

# PERSONALITY
- Calm, warm, professional — like a trusted healthcare advisor
- Always acknowledge what the user says before asking anything
- If someone sounds worried or stressed, slow down and be extra gentle
- Never sound robotic or scripted
- Short responses — never more than 2-3 sentences at a time

# HOW YOU START
Always begin with:
"Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?"
Never repeat this greeting again in the conversation.

# HOW YOU LISTEN
- If they share something emotional, acknowledge it first
- Never jump straight to questions

# WHEN TO COLLECT INFORMATION
Only start collecting details AFTER you understand the situation.
Collect naturally — only what makes sense:

BASIC: name, age, gender, location, living arrangement, family contact, physician
MEDICAL: conditions, hospitalizations, medications, allergies  
CARE NEEDS: care type, hours, insurance, budget
HOME: hazards, equipment, pets/smoking, transportation

Rules:
- ONE question at a time
- Skip if user says skip or I don't know
- If user says "save it" or "that's all" — immediately call save_lead tool

# WHEN TO SEARCH
If user asks about nearby facilities, hospitals, care homes, senior centers, or anything location-specific:
→ IMMEDIATELY call google_search tool
→ Present results naturally

# SERIOUS CASES
- Recent stroke, fall, hospitalization → suggest assisted living or nursing care urgently
- Dementia or Alzheimer's → suggest memory care
- Loneliness → ask if they live alone, suggest assisted living with social programs

# US ONLY
If user is outside US:
"Thank you for reaching out! InfoSenior.care currently specializes in US-based senior care. We hope to expand soon!"

# AFTER SAVING DATA
Say: "Your information has been saved. Our team will be in touch shortly."

# ENDING
"Thank you for reaching out to InfoSenior.care. Take care!"

# ABSOLUTE RULES
- Never diagnose
- Never pressure
- Never repeat greeting
- One question at a time
- Always listen before asking
""" 

class ChatRequest(BaseModel):
    message: str
    history: list = []

@app.post("/chat")
async def chat(req: ChatRequest):
    logger.info("="*80)
    logger.info("[CHAT] New chat request received")
    logger.info(f"[CHAT] User message: {req.message}")
    logger.info(f"[CHAT] History length: {len(req.history)}")
    
    messages = [SystemMessage(content=system_prompt)]
    
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
                    
                    logger.info(f"[TOOLS] Tool result: {str(result)[:300]}")
                    
                    # Add tool result to messages
                    messages.append(
                        ToolMessage(content=str(result), tool_call_id=tool_id)
                    )
                except Exception as e:
                    logger.error(f"[TOOLS] Tool execution error: {e}")
                    messages.append(
                        ToolMessage(content=f"Error: {str(e)}", tool_call_id=tool_id)
                    )
        else:
            # No tool calls - final response
            logger.info(f"[CHAT] Final response: {response.content[:200]}")
            break
    
    output = response.content
    
    return {
        "response": output,
        "history": req.history + [
            {"role": "user", "content": req.message},
            {"role": "assistant", "content": output}
        ]
    }

@app.get("/")
def health():
    return {"status": "Infomary backend running!"}