#!/usr/bin/env python3
"""
Voice Agent — Pipecat 1.0.0
- STT  : Speechmatics (SpeechmaticsSTTService)
- LLM  : Groq (GroqLLMService — model: llama-3.3-70b-versatile)
- TTS  : Deepgram (DeepgramTTSService — voice: aura-2-thalia-en)
- Transport: SmallWebRTC → browser @ http://localhost:7860/client
"""

import os
import uuid

import aiohttp
from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import BaseTransport, TransportParams

from pipecat.services.llm_service import FunctionCallParams
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.speechmatics.stt import SpeechmaticsSTTService
from pipecat.services.deepgram.tts import DeepgramTTSService

from tools.agent_tools import _save_lead, _google_search

load_dotenv()

transport_params = {
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        vad_analyzer=SileroVADAnalyzer(params=VADParams(start_secs=0.3, stop_secs=0.8, min_volume=0.7)),
    ),
}

tools = ToolsSchema(standard_tools=[
    FunctionSchema(
        name="save_lead",
        description="Save or update a senior care lead progressively. Call this whenever user shares any personal info (name, phone, email, location, care needs, medical info, budget, etc). Always pass session_id to link updates.",
        properties={
            "session_id":         {"type": "string", "description": "Unique session ID to link progressive updates. Use the same ID throughout the conversation."},
            "name":               {"type": "string", "description": "Full name of the lead"},
            "email":              {"type": "string", "description": "Email address"},
            "phone":              {"type": "string", "description": "Phone number"},
            "care_need":          {"type": "string", "description": "Primary care need or reason for inquiry"},
            "location":           {"type": "string", "description": "City or area"},
            "notes":              {"type": "string", "description": "Any additional notes"},
            "age":                {"type": "string", "description": "Age of the senior"},
            "gender":             {"type": "string", "description": "Gender"},
            "living_arrangement": {"type": "string", "description": "Living situation (alone, with family, etc)"},
            "physician":          {"type": "string", "description": "Primary physician name"},
            "conditions":         {"type": "string", "description": "Medical conditions"},
            "hospitalizations":   {"type": "string", "description": "Recent hospitalizations"},
            "medications":        {"type": "string", "description": "Current medications"},
            "allergies":          {"type": "string", "description": "Known allergies"},
            "care_type":          {"type": "string", "description": "Type of care needed (in-home, facility, etc)"},
            "care_hours":         {"type": "string", "description": "Hours of care needed per day/week"},
            "insurance":          {"type": "string", "description": "Insurance provider"},
            "budget":             {"type": "string", "description": "Monthly budget for care"},
            "home_hazards":       {"type": "string", "description": "Home safety hazards"},
            "medical_equipment":  {"type": "string", "description": "Medical equipment at home"},
            "other_factors":      {"type": "string", "description": "Other relevant factors"},
            "transportation":     {"type": "string", "description": "Transportation needs"},
        },
        required=["session_id"],
    ),
    FunctionSchema(
        name="google_search",
        description="Search for nearby senior care facilities, hospitals, home care agencies, or any care-related services.",
        properties={
            "query": {"type": "string", "description": "Search query, e.g. 'home care agencies in Dallas Texas'"},
        },
        required=["query"],
    ),
])

# ─── Tool Handlers ────────────────────────────────────────────────────────────

async def handle_save_lead(params: FunctionCallParams) -> None:
    try:
        result = await _save_lead(**params.arguments)
        logger.info(f"[TOOL] save_lead success: {result}")
        await params.result_callback(result)
    except Exception as e:
        logger.error(f"[TOOL] save_lead error: {e}")
        await params.result_callback(f"Could not save lead: {str(e)}")


async def handle_google_search(params: FunctionCallParams) -> None:
    try:
        result = await _google_search(query=params.arguments["query"])
        logger.info(f"[TOOL] google_search done")
        await params.result_callback(result)
    except Exception as e:
        logger.error(f"[TOOL] google_search error: {e}")
        await params.result_callback(f"Search failed: {str(e)}")


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    session_id = str(uuid.uuid4())
    async with aiohttp.ClientSession() as session:

        # STT: Speechmatics
        stt = SpeechmaticsSTTService(
            api_key=os.getenv("SPEECHMATICS_API_KEY"),
            aiohttp_session=session,
        )

        # LLM: Groq LLaMA 3.3 70B — proper tool calling support
        llm = GroqLLMService(
            api_key=os.getenv("GROQ_API_KEY"),
            settings=GroqLLMService.Settings(
                model="llama-3.3-70b-versatile",
                temperature=0.7,
            ),
        )
        llm.register_function("save_lead", handle_save_lead)
        llm.register_function("google_search", handle_google_search)

        # TTS: Deepgram Aura
        tts = DeepgramTTSService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            settings=DeepgramTTSService.Settings(
                voice="aura-2-thalia-en",
            ),
        )

        messages = [
            {
                "role": "system",
                "content": (
                    """
You are Infomary, a warm and caring Senior Care Advisor for InfoSenior.care. You help families find the right senior care in the US — completely free. You are not a salesperson. You are a trusted friend who happens to know everything about senior care.
VOICE RULES:
- Always respond in 2-3 short sentences maximum
- Never use bullet points, lists, or symbols — speak naturally
- One question at a time, always
- Never sound robotic or salesy
CONVERSATION FLOW:
1. When user shares a problem — empathize first, then normalize it
2. Share one helpful insight about senior care options
3. Ask if they'd like you to find options near them
4. Collect info one at a time: location → age → living situation → conditions → budget
5. Naturally ask for name, then phone or email for follow-up
TOOLS — call only when user shares clear, specific information:
- save_lead: Call when user shares specific details — name, location, care need, medical condition (e.g. dementia, diabetes), age, phone, email, budget, living situation, etc. Save progressively as new info is shared. NEVER save guessed or placeholder values. NEVER call on greetings, generic questions, or unclear input.
- google_search: Call only when user says YES to seeing options AND location is known.
HARD RULES:
- Never ask for SSN or payment info
- Never diagnose medical conditions
- US senior care only
- Always end with a next step, never a dead end
- When user says goodbye, say a warm farewell
GUARDRAILS — STRICT:
- Off-topic: If user asks about anything unrelated to senior care, immediately say "I'm only able to help with senior care questions. Is there something about senior care I can help you with today?" — then stop and wait.
- Inappropriate language: If user uses offensive or inappropriate language, immediately say "I'm here to have a respectful conversation. I'd love to help you with senior care — shall we continue?" — if it happens again, end with "I'm going to end our conversation now. Please feel free to call back when you're ready. Take care."
- Never engage with off-topic or inappropriate messages beyond the redirect — hard stop every time.

"""
                ),
            }
        ]
        # tools go on LLMContext, not on LLMUserAggregatorParams
        context = LLMContext(messages, tools=tools)

        user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(
                vad_analyzer=SileroVADAnalyzer(params=VADParams(start_secs=0.3, stop_secs=0.8, min_volume=0.7)),
            ),
        )

        pipeline = Pipeline([
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ])

        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                enable_metrics=True,
                enable_usage_metrics=True,
            ),
        )

        @transport.event_handler("on_client_connected")
        async def on_connected(transport, client):
            logger.info(f"Browser connected — Agent Starting... [session: {session_id}]")
            context.add_message({"role": "user", "content": f"[session_id={session_id}] Greet the user warmly and ask how you can help them today. Do not call any tools."})
            await task.queue_frames([LLMRunFrame()])

        @transport.event_handler("on_client_disconnected")
        async def on_disconnected(transport, client):
            logger.info("disconnected")
            await task.cancel()

        runner = PipelineRunner(handle_sigint=False)
        await runner.run(task)


async def bot(runner_args: RunnerArguments):
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main
    main()
