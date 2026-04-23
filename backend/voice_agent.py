import asyncio
import os
import re
import logging
from typing import Annotated
from dotenv import load_dotenv

from tools.agent_tools import _save_lead, _google_search

from livekit.agents import (
    AutoSubscribe, JobContext,
    WorkerOptions, cli, llm, metrics,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import groq, deepgram, silero, cartesia

load_dotenv()
logger = logging.getLogger("infomary-agent")


class InfomaryFnc(llm.FunctionContext):

    def __init__(self, ctx: JobContext):
        super().__init__()
        self._ctx = ctx

    @llm.ai_callable()
    async def end_call(self):
        """End the conversation. Call when user says bye, goodbye, farewell, or wants to hang up."""
        await asyncio.sleep(2)  
        await self._ctx.room.disconnect()

    @llm.ai_callable()
    async def save_lead(
        self,
        session_id: Annotated[str, llm.TypeInfo(description="Session ID for this conversation")],
        name: Annotated[str, llm.TypeInfo(description="Full name")] = "",
        email: Annotated[str, llm.TypeInfo(description="Email address")] = "",
        phone: Annotated[str, llm.TypeInfo(description="Phone number")] = "",
        care_need: Annotated[str, llm.TypeInfo(description="What care is needed")] = "",
        location: Annotated[str, llm.TypeInfo(description="City or ZIP")] = "",
        notes: Annotated[str, llm.TypeInfo(description="Additional notes")] = "",
        age: Annotated[str, llm.TypeInfo(description="Age of the senior")] = "",
        gender: Annotated[str, llm.TypeInfo(description="Gender")] = "",
        living_arrangement: Annotated[str, llm.TypeInfo(description="Lives alone or with family")] = "",
        physician: Annotated[str, llm.TypeInfo(description="Primary physician")] = "",
        conditions: Annotated[str, llm.TypeInfo(description="Medical conditions")] = "",
        hospitalizations: Annotated[str, llm.TypeInfo(description="Recent hospitalizations")] = "",
        medications: Annotated[str, llm.TypeInfo(description="Current medications")] = "",
        allergies: Annotated[str, llm.TypeInfo(description="Known allergies")] = "",
        care_type: Annotated[str, llm.TypeInfo(description="Type of care needed")] = "",
        care_hours: Annotated[str, llm.TypeInfo(description="Hours of care per day/week")] = "",
        insurance: Annotated[str, llm.TypeInfo(description="Insurance type")] = "",
        budget: Annotated[str, llm.TypeInfo(description="Monthly budget")] = "",
        home_hazards: Annotated[str, llm.TypeInfo(description="Home safety hazards")] = "",
        medical_equipment: Annotated[str, llm.TypeInfo(description="Medical equipment needed")] = "",
        other_factors: Annotated[str, llm.TypeInfo(description="Other relevant factors")] = "",
        transportation: Annotated[str, llm.TypeInfo(description="Transportation needs")] = "",
    ):
        """Save or update senior care lead. Call every time new info is shared."""
        result = await _save_lead(
            session_id=session_id, name=name, email=email, phone=phone,
            care_need=care_need, location=location, notes=notes, age=age,
            gender=gender, living_arrangement=living_arrangement,
            physician=physician, conditions=conditions,
            hospitalizations=hospitalizations, medications=medications,
            allergies=allergies, care_type=care_type, care_hours=care_hours,
            insurance=insurance, budget=budget, home_hazards=home_hazards,
            medical_equipment=medical_equipment, other_factors=other_factors,
            transportation=transportation,
        )
        return result

    @llm.ai_callable()
    async def google_search(
        self,
        query: Annotated[str, llm.TypeInfo(description="Search query for senior care facilities")],
    ):
        """Search for nearby senior care facilities or services."""
        result = await _google_search(query=query)
        return result


async def _strip_function_calls(agent, source):
    """Remove <function=...>...</function> tags that leak into spoken text.

    Function calls are split across multiple stream chunks, so we buffer until
    we're outside a tag before yielding.
    """
    def _clean(text: str) -> str:
        text = re.sub(r'<function=[^>]*>.*?</function>', '', text, flags=re.DOTALL)
        return re.sub(r'\s+', ' ', text).strip()

    if isinstance(source, str):
        cleaned = _clean(source)
        if cleaned:
            yield cleaned
        return

    buffer = ""
    async for chunk in source:
        buffer += chunk
        # Strip any complete function calls accumulated so far
        buffer = re.sub(r'<function=[^>]*>.*?</function>', '', buffer, flags=re.DOTALL)
        # Only yield once we're not mid-way through a function call tag
        if '<function=' not in buffer:
            text = re.sub(r'\s+', ' ', buffer).strip()
            if text:
                yield text
            buffer = ""

    # Flush anything left in the buffer
    if buffer:
        cleaned = _clean(buffer)
        if cleaned:
            yield cleaned


async def entrypoint(ctx: JobContext):
    # Init DB pool early while the event loop executor is healthy.
    # The voice agent runs in its own subprocess so db_pool starts as None.
    import database as _db
    if _db.db_pool is None:
        await _db.init_db_pool()
    ctx.add_shutdown_callback(_db.close_db_pool)

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    participant = await ctx.wait_for_participant()

    session_id = participant.attributes.get("sessionId", f"voice_{participant.identity}")
    logger.info(f"Session: {session_id} | Participant: {participant.identity}")

    system_prompt = f"""
You are Infomary - the warm, trusted Senior Care Companion for InfoSenior.care.You’re not a salesperson and not a chatbot. You’re like a knowledgeable, caring friend who has helped hundreds of families navigate senior care in the US and genuinely wants to help this one too.Golden Rule:
The person should always feel “Someone actually understands me and is helping me” - never like they’re being sold to or filling out a form. Trust is everything.Session ID:
Always use this exact session_id in every save_lead call: {session_id}Conversation Flow:Phase 1 – Empathy First
When they share any problem:  Acknowledge their feelings  
Normalize it (they’re not alone)  
Mention InfoSenior.care naturally  
Immediately call save_lead with whatever you know

Phase 2 – One Sharp Insight
Share one valuable, specific insight that shows your expertise, then tie it back to InfoSenior.care.Phase 3 - Soft Offer
Gently offer help:
"Based on what you’ve told me, I think I can find some strong options through InfoSenior.care. Would you like me to check what’s available near you?"Phase 4 – Natural Information Collection
Only after they say yes. Ask one question at a time and always explain why. Save immediately after every answer.Contact Details (Start Early):  Name (within first 2-3 messages)  
Email (after some value given)  
Phone (when they’re engaged)

Use natural lines like:
"By the way, what’s your name?"
"I can send you some options — what’s a good email?"
"If you want an advisor to follow up, what’s the best number?"Saving Rules (Very Important):
Call save_lead the moment any new information comes in (problem, location, age, conditions, budget, name, email, phone etc.). Always include all known fields + session_id. Never wait.Google Search:
Only call google_search when the user says yes to seeing options and you know their location.Tone & Style:Always warm, empathetic and human
Maximum 1-3 short sentences per reply
One question at a time
Mention InfoSenior.care naturally in almost every response
Never sound salesy or robotic
Never ask multiple questions in one message
Never ask for details right after an emotional share

Hard Limits:Never diagnose medical conditions
Never ask for SSN, payment details, etc.
Stay on senior care only
US only

Ending the call:
When the user says bye, goodbye, farewell, take care, or anything that signals they want to end the conversation — say a warm, brief goodbye first, then call end_call. Example: “It was wonderful speaking with you. Take care, and don't hesitate to reach out anytime. Goodbye!”

Success:
Every conversation should end with the user feeling: “InfoSenior.care really helped me  I want to work with them.”


"""

    initial_ctx = llm.ChatContext().append(role="system", text=system_prompt)

   
    vad = silero.VAD.load(
        min_silence_duration=0.2,
        min_speech_duration=0.2,
        activation_threshold=0.75,   
    )

    agent = VoicePipelineAgent(
        vad=vad,
        stt=deepgram.STT(model="nova-3"),
        llm=groq.LLM(model="openai/gpt-oss-120b"),
        tts=cartesia.TTS(
            api_key=os.environ.get("CARTESIA_API_KEY"),
            model="sonic-2",
            voice="f9836c6e-a0bd-460e-9d3c-f7299fa60f94",  
            speed=0.9,
        ),
        before_tts_cb=_strip_function_calls,    
        min_endpointing_delay=0.2,
        max_endpointing_delay=2.0,
        allow_interruptions=True,
        interrupt_speech_duration=0.5,
        interrupt_min_words=3,
        chat_ctx=initial_ctx,
        fnc_ctx=InfomaryFnc(ctx),
    )

    usage_collector = metrics.UsageCollector()

    @agent.on("metrics_collected")
    def on_metrics(agent_metrics: metrics.AgentMetrics):
        metrics.log_metrics(agent_metrics)
        usage_collector.collect(agent_metrics)

    async def log_usage():
        logger.info(f"Usage summary: {usage_collector.get_summary()}")

    ctx.add_shutdown_callback(log_usage)

    agent.start(ctx.room, participant)
    await agent.say(
        "Hello! I'm Infomary, your senior care advisor. How can I help your family today?",
        allow_interruptions=True
    )

    # Proactive re-engagement after 60s of user silence
    _idle_task: asyncio.Task | None = None
    _idle_prompts = [
        "Are you still there? Take your time — I'm here whenever you're ready.",
        "Just checking in — feel free to ask me anything about senior care options.",
        "I'm still here if you have any questions. No rush at all.",
    ]
    _idle_index = 0

    def _reset_idle_timer(*_):
        nonlocal _idle_task, _idle_index
        if _idle_task and not _idle_task.done():
            _idle_task.cancel()
        _idle_task = asyncio.ensure_future(_idle_check())

    async def _idle_check():
        nonlocal _idle_index
        await asyncio.sleep(60)
        prompt = _idle_prompts[_idle_index % len(_idle_prompts)]
        _idle_index += 1
        await agent.say(prompt, allow_interruptions=True)
        _reset_idle_timer()

    agent.on("user_speech_committed", _reset_idle_timer)
    agent.on("agent_speech_committed", _reset_idle_timer)
    _reset_idle_timer()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        ),
    )