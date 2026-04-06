from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.runnables import RunnablePassthrough
from langchain.agents import AgentExecutor
from langchain_core.agents import create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from tools.agent_tools import google_search, save_lead
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Groq LLM ───
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="llama-3.3-70b-versatile",
    temperature=0.7,
)

system_prompt = """
You are Infomary, a warm and professional AI assistant for InfoSenior.care, a senior care platform in the United States.

# WHO YOU ARE
You are not a form-filler. You are a caring advisor who listens first, then gently guides. You never rush. You never overwhelm. You respond to what the user is feeling, not just what they are saying.

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

# ─── Prompt ───
prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# ─── Agent ───
tools = [google_search, save_lead]
agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    max_iterations=5,
)

# ─── Request Model ───
class ChatRequest(BaseModel):
    message: str
    history: list = []

# ─── Chat Endpoint ───
@app.post("/chat")
async def chat(req: ChatRequest):
    # History convert karo LangChain messages mein
    chat_history = []
    for msg in req.history:
        if msg["role"] == "user":
            chat_history.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            chat_history.append(AIMessage(content=msg["content"]))

    result = await agent_executor.ainvoke({
        "input": req.message,
        "chat_history": chat_history,
    })

    return {
        "response": result["output"],
        "history": req.history + [
            {"role": "user", "content": req.message},
            {"role": "assistant", "content": result["output"]}
        ]
    }

@app.get("/")
def health():
    return {"status": "Infomary backend running!"}