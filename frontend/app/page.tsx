"use client"

import { useEffect, useRef, useState } from "react";
import { getJWT } from "./utils/auth.jsx";
import useAudioQueue from "./hooks/useAudioQueue.jsx"
import VoiceAssistantModel from "./components/VoiceAssistantModel.jsx";
import { AnimatePresence, easeInOut, motion } from "motion/react";
import { speechmaticsTools } from "../tools/speechmaticsTools";

function VoiceAgent() {
  const webSocketRef = useRef<WebSocket | null>(null);
  const [promptResponse, setPromptResponse] = useState<{ "prompt": string, "response": string, id: "string" }[]>([]);
  const { playChunk } = useAudioQueue();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [sessionId] = useState(() => `voice_${Math.random().toString(36).substring(7)}`)
  const promptRef = useRef<HTMLDivElement | null>(null);
  const audioBufferRef = useRef([]);
  const BUFFER_SIZE = 10;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [promptResponse]);


  useEffect(() => {
    if (!promptRef.current) return;
    promptRef.current.scrollTo({
      top: promptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [promptResponse]);

  const connectToSpeechmatics = async () => {
    try {
      const jwt = await getJWT();
      const webSocket = new WebSocket(
        `wss://flow.api.speechmatics.com/v1/flow?jwt=${jwt}`
      );
      webSocketRef.current = webSocket;
      webSocket.binaryType = "arraybuffer";

      webSocket.onopen = () => {
        console.log("Connected to speechmatic websocket!");
        navigator.mediaDevices
          .getUserMedia({ audio: { sampleRate: 16000 } })
          .then(async function (stream) {
            const audioContext = new AudioContext({ sampleRate: 16000 });

            // Load the AudioWorklet processor
            await audioContext.audioWorklet.addModule("/pcm-processor.js");

            const source = audioContext.createMediaStreamSource(stream);
            const processor = new AudioWorkletNode(
              audioContext,
              "pcm-processor"
            );

            // Receive PCM data
            processor.port.onmessage = (event) => {
              const float32Data = new Float32Array(event.data.float32Data);

              if (webSocketRef?.current?.readyState === WebSocket.OPEN) {
                webSocketRef.current.send(float32Data.buffer);
              }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
          })
          .catch(function (err) {
            console.error("Error accessing microphone:", err);
          });
        const data = {
          message: "StartConversation",
          audio_format: {
            type: "raw",
            encoding: "pcm_f32le",
          },
          // 25347d97 - a596 - 4f8d- a97e - d0bef9d659f1: latest
          // 0976156d-9e20-46b7-be7d-3371ff6ae24f:latest
          conversation_config: {
            template_id: "0976156d-9e20-46b7-be7d-3371ff6ae24f:latest",
            template_variables: {
              SESSION_ID: sessionId
            }
          },
          tools: speechmaticsTools
        };
        webSocket.send(JSON.stringify(data));
      };
      webSocket.onmessage = async (event) => {
        const data = event.data;
        if (data instanceof ArrayBuffer) {
          playChunk(data);
          return;
        }

        const parsed_data = JSON.parse(event.data);
        const message = parsed_data["message"];

        switch (message) {
          case "AddTranscript": {
            const transcript = parsed_data.metadata.transcript;
            // console.log("Final Transcript", transcript);
            break;
          }

          case "ResponseCompleted": {
            const response = parsed_data.content;
            // console.log("Final response", response);
            break;
          }

          case "prompt": {
            const prompt = parsed_data.prompt;
            const prompt_id = prompt.id;
            const prompt_text = prompt.prompt;
            const response_text = prompt.response;

            const plain_response = response_text.replace(/<[^>]*>/g, "").trim();

            let updated_prompt = { ...prompt, response: plain_response };

            const hasResultXML =
              /<(RESULT|APPLICATION_INPUT)(\s+[^>]*)?>.*?<\/\1>/is.test(
                prompt_text
              );

            if (hasResultXML) {
              updated_prompt = { ...prompt, prompt: "" };
            }

            setPromptResponse((prev) => {
              const index = prev?.findIndex((obj) => obj.id === prompt_id);
              if (index === -1) return [...prev, updated_prompt];

              const updated = [...prev];
              updated[index] = updated_prompt;
              return updated;
            });
            break;
          }

          case 'ToolInvoke': {
            console.log("data", data)
            const toolId = parsed_data.id
            const toolName = parsed_data.function.name

            const toolArgs = typeof parsed_data.function.arguments === 'string'
              ? JSON.parse(parsed_data.function.arguments)
              : parsed_data.function.arguments

            console.log(`🔧 Tool call: ${toolName}`, toolArgs)


            if (toolName === 'end_conversation' || toolName === 'EndConversation') {
              if (webSocketRef.current) {
                webSocketRef?.current?.close();
                setPromptResponse([])
              }
              break
            }
            // Inject session_id if missing
            if (toolName === 'save_lead' && !toolArgs.session_id) {
              toolArgs.session_id = sessionId
            }

            try {
              const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
              const res = await fetch(`${backendUrl}/speechmatics-tools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tool_name: toolName,
                  args: toolArgs
                })
              })

              if (!res.ok) {
                const errText = await res.text()
                throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`)
              }

              const json = await res.json()
              console.log('✅ Tool Result:', json)
              webSocketRef?.current?.send(JSON.stringify({
                message: 'ToolResult',
                id: toolId,
                status: json.error ? 'error' : 'ok',
                content: json.result || json.error || 'Done'
              }))
            } catch (e) {
              console.error('Tool call failed:', e)
              webSocketRef?.current?.send(JSON.stringify({ message: 'ToolResult', id: toolId, status: 'error', content: 'Tool failed' }))
            }
            break
          }

          default:
            break;
        }
      };

      webSocket.onerror = (error) => console.error("Error:", error);
    } catch (e) {
      console.error("Connection failed:", e);
    }
  };

  return (
    <div
      ref={promptRef}
      className="flex flex-col gap-y-8 bg-black h-screen scrollbar overflow-y-auto"
    >
      <div className="title-box pt-4">
        <p className="text-center tracking-tighter switzer-500 text-5xl text-white">
          Info Senior Care
        </p>
      </div>
      <div className="flex gap-x-4 justify-center">
        <AnimatePresence>
          {webSocketRef?.current?.readyState !== WebSocket.OPEN ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.1, type: "spring" }}
              // disabled={schema ? false : true}
              onClick={connectToSpeechmatics}
              className="inter-300 tracking-wider absolute px-4 py-3 text-sm text-white rounded-xl animated-gradient-border animate-border-spin border border-red-400/30 transition-all ease-in-out duration-300 hover:inter-400 cursor-pointer"
            >
              Start Conversation
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.1, type: "spring" }}
              onClick={() => {
                webSocketRef?.current?.close();
                setPromptResponse([]);
              }}
              className="absolute inter-300 tracking-wider px-3 py-2 text-sm text-red-400 hover:scale-105 rounded-xl transition-all ease-in-out duration-300 border border-red-300/40 cursor-pointer"
            >
              Stop Conversation
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {webSocketRef?.current?.readyState === WebSocket.OPEN &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: easeInOut }} className="w-full flex justify-center bg-black transition-all ease-in-out duration-300">
          <VoiceAssistantModel />
        </motion.div>
      }
      {/* <div
        className={`${webSocketRef?.current?.readyState === WebSocket.OPEN
          ? "opacity-100"
          : "opacity-0"
          } w-full flex justify-center bg-black transition-all ease-in-out duration-300`}
      >
      </div> */}
      {promptResponse?.length > 0 ? (
        <div className="flex flex-col w-full items-center">
          <p className="roboto-400 text-white text-xl font-semibold">
            Conversation
          </p>
        </div>
      ) : null}
      <div className="flex flex-col items-center gap-y-6 w-full px-4">
        {promptResponse?.map((pair, index) => {
          const speaker_number = pair["prompt"] && pair["prompt"][2];

          const color = getColor(speaker_number);

          return (
            <div
              key={index}
              className="flex flex-col gap-y-2 w-full md:w-3/4 lg:w-1/2"
            >
              {pair["prompt"] && (
                <div
                  className={`w-1/2 ml-auto rounded-2xl border ${color === "white"
                    ? "border-white/20 text-white"
                    : color === "purple-200"
                      ? "border-purple-200/20 text-purple-200"
                      : color === "violet-200"
                        ? "border-violet-200/20 text-violet-200"
                        : color === "red-200"
                          ? "border-red-200/20 text-red-200"
                          : color === "orange-200"
                            ? "border-orange-200/20 text-orange-200"
                            : color === "lime-200"
                              ? "border-lime-200/20 text-lime-200"
                              : color === "emerald-200"
                                ? "border-emerald-200/20 text-emerald-200"
                                : color === "sky-200"
                                  ? "border-sky-200/20 text-sky-200"
                                  : color === "fuchsia-200"
                                    ? "border-fuchsia-200/20 text-fuchsia-200"
                                    : ""
                    } px-3 py-2 shadow-lg`}
                >
                  <strong className={`text-${color} roboto-600`}>
                    Speaker {pair["prompt"][2]}
                  </strong>
                  <p className="inter-400 text-white">
                    {pair["prompt"].slice(4, -5)}
                  </p>
                </div>
              )}
              {pair["response"] ? (
                <div className="w-1/2 rounded-xl p-2 border border-white/20 shadow-lg">
                  <strong className="roboto-600 text-white">Agent</strong>
                  <p className="inter-400 text-white">{pair["response"]}</p>
                </div>
              ) : null}
              <div ref={messagesEndRef}></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VoiceAgent;

const getColor = (speakerNumber: string) => {
  switch (speakerNumber) {
    case "1":
      return "white";

    case "2":
      return "purple-200";

    case "3":
      return "violet-200";

    case "4":
      return "red-200";

    case "5":
      return "orange-200";

    case "6":
      return "lime-200";

    case "7":
      return "emerald-200";

    case "8":
      return "sky-200";

    case "9":
      return "fuchsia-200";

    default:
      return;
  }
};
