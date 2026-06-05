"use client";

import {
  Bot,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  LayoutTemplate,
  Loader2,
  Mic,
  MicOff,
  PenLine,
  Send,
  Sparkles,
  Square,
  TableColumnsSplit,
  Waypoints,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { runAssistantTurn, type AssistantHistoryMessage, type AssistantPendingAction } from "@/app/assistant/actions";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionSummary?: string;
  pendingAction?: AssistantPendingAction;
};

type VoiceStatus = "idle" | "connecting" | "listening" | "processing" | "speaking" | "error";

type VoiceTokenResponse = {
  token?: string;
  error?: string;
};

type VoiceMessage = {
  type?: string;
  data?: string;
  text?: string;
  status?: string;
  message?: string;
  call_id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
};

const RATE = 24000;
const PLAYBACK_JITTER_SECONDS = 0.08;
const suggestions = [
  { label: "Create a task for tomorrow", icon: ClipboardList, accent: "text-amber-600" },
  { label: "Add meeting reminder on calendar", icon: CalendarDays, accent: "text-teal-600" },
  { label: "Summarize my notes", icon: FileText, accent: "text-sky-600" },
  { label: "Create a Kanban board", icon: TableColumnsSplit, accent: "text-amber-700" },
  { label: "Plan my week", icon: PenLine, accent: "text-rose-500" },
  { label: "Generate a habit tracker template", icon: LayoutTemplate, accent: "text-pink-600" },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function bytesToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function base64ToPcm16(value: string) {
  const raw = atob(value);
  const pcm = new Int16Array(raw.length / 2);

  for (let index = 0; index < pcm.length; index += 1) {
    pcm[index] = raw.charCodeAt(index * 2) | (raw.charCodeAt(index * 2 + 1) << 8);
  }

  return pcm;
}

function useAssemblyAIVoiceAgent({
  onAgentTranscript,
  onError,
  onUserTranscript,
}: {
  onAgentTranscript: (text: string) => void;
  onError: (text: string) => void;
  onUserTranscript: (text: string) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextStartTimeRef = useRef(0);
  const readyRef = useRef(false);
  const lastVoiceEventRef = useRef<string | null>(null);
  const toolResultCacheRef = useRef(new Map<string, { expiresAt: number; result: unknown }>());
  const onAgentTranscriptRef = useRef(onAgentTranscript);
  const onUserTranscriptRef = useRef(onUserTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onAgentTranscriptRef.current = onAgentTranscript;
  }, [onAgentTranscript]);

  useEffect(() => {
    onUserTranscriptRef.current = onUserTranscript;
  }, [onUserTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const flushPlayback = useCallback(() => {
    for (const source of sourcesRef.current) {
      try {
        source.onended = null;
        source.stop(0);
        source.disconnect();
      } catch {
        // The source may already be stopped.
      }
    }
    sourcesRef.current.clear();
    nextStartTimeRef.current = audioContextRef.current?.currentTime ?? 0;
  }, []);

  const cleanup = useCallback(() => {
    readyRef.current = false;
    lastVoiceEventRef.current = null;
    toolResultCacheRef.current.clear();
    flushPlayback();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }

    streamRef.current = null;
    audioContextRef.current = null;
  }, [flushPlayback]);

  const stop = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const playReplyAudio = useCallback((base64Audio: string) => {
    const audioContext = audioContextRef.current;
    if (!audioContext) {
      return;
    }

    const pcm = base64ToPcm16(base64Audio);
    const samples = new Float32Array(pcm.length);
    for (let index = 0; index < pcm.length; index += 1) {
      samples[index] = pcm[index] / 32768;
    }

    const buffer = audioContext.createBuffer(1, samples.length, RATE);
    buffer.getChannelData(0).set(samples);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => sourcesRef.current.delete(source);

    const startAt = Math.max(audioContext.currentTime + PLAYBACK_JITTER_SECONDS, nextStartTimeRef.current);
    source.start(startAt);
    sourcesRef.current.add(source);
    nextStartTimeRef.current = startAt + buffer.duration;
  }, []);

  const sendToolResult = useCallback((callId: string, result: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "tool.result",
        call_id: callId,
        result: JSON.stringify(result),
      })
    );
  }, []);

  const handleToolCall = useCallback(async (message: VoiceMessage) => {
    if (!message.call_id) {
      return;
    }

    const args = message.arguments ?? {};
    const request = typeof args.request === "string" ? args.request : JSON.stringify(args);
    const cacheKey = request.trim().toLowerCase();
    const cached = toolResultCacheRef.current.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      sendToolResult(message.call_id, cached.result);
      return;
    }

    const result = await runAssistantTurn({ message: request });
    const voiceResult = {
      ok: true,
      message: result.message,
      actionSummary: result.actionSummary ?? null,
      needsConfirmation: Boolean(result.pendingAction),
    };
    toolResultCacheRef.current.set(cacheKey, {
      expiresAt: Date.now() + 30000,
      result: voiceResult,
    });
    sendToolResult(message.call_id, voiceResult);
  }, [sendToolResult]);

  const start = useCallback(async () => {
    if (status !== "idle" && status !== "error") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "Microphone access is not supported in this browser.";
      setError(message);
      setStatus("error");
      onErrorRef.current(message);
      return;
    }

    setStatus("connecting");
    setError("");

    try {
      const tokenResponse = await fetch("/api/assemblyai/voice-agent-token");
      const tokenData = (await tokenResponse.json()) as VoiceTokenResponse;

      if (!tokenResponse.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Unable to start the voice assistant.");
      }

      const audioContext = new AudioContext({ sampleRate: RATE });
      await audioContext.resume();
      const workletUrl = URL.createObjectURL(
        new Blob(
          [
            `
              const TARGET_RATE = ${RATE};

              class PCMProcessor extends AudioWorkletProcessor {
                constructor() {
                  super();
                  this.pending = [];
                  this.pendingLength = 0;
                }

                pushSamples(channel) {
                  const ratio = sampleRate / TARGET_RATE;
                  const outputLength = Math.max(1, Math.floor(channel.length / ratio));
                  const output = new Float32Array(outputLength);

                  for (let i = 0; i < outputLength; i += 1) {
                    const position = i * ratio;
                    const index = Math.floor(position);
                    const nextIndex = Math.min(index + 1, channel.length - 1);
                    const fraction = position - index;
                    const current = channel[index] || 0;
                    const next = channel[nextIndex] || current;
                    output[i] = current + (next - current) * fraction;
                  }

                  this.pending.push(output);
                  this.pendingLength += output.length;
                }

                flushFrames() {
                  const frameSize = 480;

                  while (this.pendingLength >= frameSize) {
                    const pcm = new Int16Array(frameSize);
                    let written = 0;

                    while (written < frameSize && this.pending.length) {
                      const head = this.pending[0];
                      const take = Math.min(frameSize - written, head.length);

                      for (let i = 0; i < take; i += 1) {
                        const sample = Math.max(-1, Math.min(1, head[i]));
                        pcm[written + i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                      }

                      written += take;

                      if (take === head.length) {
                        this.pending.shift();
                      } else {
                        this.pending[0] = head.slice(take);
                      }
                    }

                    this.pendingLength -= frameSize;
                    this.port.postMessage(pcm.buffer, [pcm.buffer]);
                  }
                }

                process(inputs) {
                  const channel = inputs[0]?.[0];
                  if (channel) {
                    this.pushSamples(channel);
                    this.flushFrames();
                  }
                  return true;
                }
              }
              registerProcessor("flowbase-pcm", PCMProcessor);
            `,
          ],
          { type: "application/javascript" }
        )
      );
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      const source = audioContext.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioContext, "flowbase-pcm");
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      source.connect(worklet).connect(silentGain).connect(audioContext.destination);

      const url = new URL("wss://agents.assemblyai.com/v1/ws");
      url.searchParams.set("token", tokenData.token);
      const socket = new WebSocket(url);

      socketRef.current = socket;
      streamRef.current = stream;
      audioContextRef.current = audioContext;

      worklet.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
        if (!readyRef.current || socket.readyState !== WebSocket.OPEN) {
          return;
        }
        socket.send(JSON.stringify({ type: "input.audio", audio: bytesToBase64(data) }));
      };

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            type: "session.update",
            session: {
              system_prompt:
                "You are Flowbase AI Assistant. Help users plan, write, and organize work. Keep spoken replies short and natural. Answer ordinary questions directly without tools. For app actions like tasks, calendar items, notes, boards, whiteboards, templates, or settings, call the flowbase_action tool with the user's request. Ask follow-up questions when details are missing. Do not claim an action is saved unless the tool result says it was done.",
              greeting: "Hey, what should we organize?",
              output: { type: "audio", voice: "ivy", format: { encoding: "audio/pcm" } },
              input: {
                format: { encoding: "audio/pcm" },
                turn_detection: {
                  vad_threshold: 0.58,
                  min_silence: 500,
                  max_silence: 1200,
                  interrupt_response: true,
                },
              },
              tools: [
                {
                  type: "function",
                  name: "flowbase_action",
                  description:
                    "Create, update, summarize, or plan Flowbase workspace items. Use only for explicit Flowbase actions such as creating Kanban boards, adding columns, adding tasks, calendar reminders, notes, whiteboards, templates, or settings changes. Do not call this for normal questions or casual chat.",
                  execution_mode: "interactive",
                  timeout_seconds: 20,
                  parameters: {
                    type: "object",
                    properties: {
                      request: {
                        type: "string",
                        description: "The user's complete Flowbase action request, including any dates, names, and details.",
                      },
                    },
                    required: ["request"],
                  },
                },
              ],
            },
          })
        );
      });

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as VoiceMessage;

        switch (message.type) {
          case "session.ready":
            readyRef.current = true;
            lastVoiceEventRef.current = "session.ready";
            setStatus("listening");
            break;
          case "input.speech.started":
            lastVoiceEventRef.current = "input.speech.started";
            flushPlayback();
            setStatus("listening");
            break;
          case "input.speech.stopped":
            lastVoiceEventRef.current = "input.speech.stopped";
            setStatus("processing");
            break;
          case "reply.started":
            lastVoiceEventRef.current = "reply.started";
            setStatus("speaking");
            break;
          case "reply.audio":
            if (message.data) {
              playReplyAudio(message.data);
            }
            break;
          case "reply.done":
            lastVoiceEventRef.current = "reply.done";
            if (message.status === "interrupted") {
              flushPlayback();
            }
            setStatus("listening");
            break;
          case "transcript.user":
            if (message.text?.trim()) {
              onUserTranscriptRef.current(message.text.trim());
            }
            break;
          case "transcript.agent":
            if (message.text?.trim()) {
              onAgentTranscriptRef.current(message.text.trim());
            }
            break;
          case "tool.call":
            void handleToolCall(message);
            break;
          case "session.error": {
            const nextError = message.message || "Voice assistant session failed.";
            setError(nextError);
            setStatus("error");
            onErrorRef.current(nextError);
            break;
          }
        }
      });

      socket.addEventListener("close", () => {
        socketRef.current = null;
        cleanup();
        setStatus((current) => (current === "error" ? current : "idle"));
      });

      socket.addEventListener("error", () => {
        const message = "Voice assistant connection failed.";
        setError(message);
        setStatus("error");
        onErrorRef.current(message);
        cleanup();
      });
    } catch (nextError) {
      cleanup();
      socketRef.current?.close();
      socketRef.current = null;
      const message = nextError instanceof Error ? nextError.message : "Unable to start voice assistant.";
      setError(message);
      setStatus("error");
      onErrorRef.current(message);
    }
  }, [cleanup, flushPlayback, handleToolCall, playReplyAudio, status]);

  useEffect(() => stop, [stop]);

  return {
    error,
    isActive: status !== "idle" && status !== "error",
    start,
    status,
    stop,
  };
}

function StatusPill({ status }: { status: VoiceStatus }) {
  const label: Record<VoiceStatus, string> = {
    idle: "Voice ready",
    connecting: "Connecting",
    listening: "Listening",
    processing: "Processing",
    speaking: "Speaking",
    error: "Voice error",
  };

  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-black",
        status === "error"
          ? "border-[#f0c7c1] bg-[#fff0ed] text-[#944139]"
          : status === "idle"
            ? "border-[#e1d8c8] bg-white text-[#6b675f]"
            : "border-[#c9eadf] bg-[#eefbf7] text-[#28685c]"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", status === "idle" ? "bg-[#c6baaa]" : "animate-pulse bg-[#55cdb4]")} />
      {label[status]}
    </span>
  );
}

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const history = useMemo<AssistantHistoryMessage[]>(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages]
  );

  const appendMessage = useCallback((message: Omit<ChatMessage, "id">) => {
    setMessages((current) => [...current, { ...message, id: createId() }]);
  }, []);

  const voice = useAssemblyAIVoiceAgent({
    onUserTranscript: (text) => appendMessage({ role: "user", content: text }),
    onAgentTranscript: (text) => appendMessage({ role: "assistant", content: text }),
    onError: setNotice,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [prompt]);

  async function sendPrompt(value = prompt) {
    const text = value.trim();
    if (!text || isSending) {
      return;
    }

    const userMessage: ChatMessage = { id: createId(), role: "user", content: text };
    const nextHistory = [...history, { role: "user" as const, content: text }];
    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setNotice("");
    setIsSending(true);

    try {
      const result = await runAssistantTurn({ message: text, history: nextHistory });
      appendMessage({
        role: "assistant",
        content: result.message,
        actionSummary: result.actionSummary,
        pendingAction: result.pendingAction,
      });
    } catch (error) {
      appendMessage({
        role: "assistant",
        content: error instanceof Error ? error.message : "I hit a snag while answering.",
      });
    } finally {
      setIsSending(false);
    }
  }

  async function confirmAction(action: AssistantPendingAction) {
    if (isSending) {
      return;
    }

    appendMessage({ role: "user", content: `Confirm: ${action.label}` });
    setIsSending(true);
    setNotice("");

    try {
      const result = await runAssistantTurn({ message: "Confirm this action.", confirmedAction: action });
      appendMessage({
        role: "assistant",
        content: result.message,
        actionSummary: result.actionSummary,
      });
    } catch (error) {
      appendMessage({
        role: "assistant",
        content: error instanceof Error ? error.message : "I could not complete that confirmation.",
      });
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendPrompt();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt();
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col overflow-hidden rounded-lg border border-[#e1d8c8] bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8dfcf] bg-[#fffaf0] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ef594a] text-white shadow-sm">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black text-[#111827]">AI Assistant</h1>
            <p className="truncate text-sm font-semibold text-[#6b675f]">Ask, plan, and act across Flowbase.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={voice.status} />
          <button
            type="button"
            onClick={voice.isActive ? voice.stop : voice.start}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-md border shadow-sm transition",
              voice.isActive
                ? "border-[#f0c7c1] bg-[#fee4df] text-[#c94d42] hover:bg-[#fdd8d0]"
                : "border-[#e1d8c8] bg-white text-[#5f5b55] hover:border-[#ef594a] hover:text-[#ef594a]"
            )}
            aria-label={voice.isActive ? "Stop voice assistant" : "Start voice assistant"}
            title={voice.isActive ? "Stop voice assistant" : "Start voice assistant"}
          >
            {voice.isActive ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto bg-[#fffdf8] px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
          {messages.length ? (
            <div className="space-y-5">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  {message.role === "assistant" ? (
                    <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#fee4df] text-[#c94d42]">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[min(760px,85%)] rounded-lg border px-4 py-3 text-[15px] font-semibold leading-7 shadow-sm",
                      message.role === "user"
                        ? "border-[#ef594a] bg-[#ef594a] text-white"
                        : "border-[#e1d8c8] bg-white text-[#292524]"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    {message.actionSummary ? (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#c9eadf] bg-[#eefbf7] px-2.5 py-1 text-xs font-black text-[#28685c]">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {message.actionSummary}
                      </div>
                    ) : null}
                    {message.pendingAction ? (
                      <div className="mt-4 rounded-md border border-[#f0d98c] bg-[#fff7dd] p-3 text-[#7c6227]">
                        <p className="text-sm font-black">Confirmation needed</p>
                        <p className="mt-1 text-sm font-semibold leading-6">{message.pendingAction.label}</p>
                        <button
                          type="button"
                          onClick={() => confirmAction(message.pendingAction as AssistantPendingAction)}
                          disabled={isSending}
                          className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-[#ef594a] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#dc4d40] disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Confirm
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}

              {isSending ? (
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-[#fee4df] text-[#c94d42]">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-[#e1d8c8] bg-white px-4 py-3 text-sm font-black text-[#6b675f] shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Thinking
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center py-10">
              <div className="w-full max-w-3xl text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-[#fee4df] text-[#c94d42]">
                  <Sparkles className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">AI Assistant</h2>
                <p className="mx-auto mt-3 max-w-2xl text-base font-semibold leading-7 text-[#6b675f]">
                  Chat with Flowbase to create tasks, plan calendar reminders, write notes, shape whiteboard ideas, and generate mini apps.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestions.map((suggestion) => {
                    const Icon = suggestion.icon;
                    return (
                      <button
                        key={suggestion.label}
                        type="button"
                        onClick={() => void sendPrompt(suggestion.label)}
                        className="group flex min-h-24 items-start gap-3 rounded-lg border border-[#e1d8c8] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#ef594a]"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#fffaf0]">
                          <Icon className={cn("h-5 w-5", suggestion.accent)} aria-hidden="true" />
                        </span>
                        <span className="text-sm font-black leading-6 text-[#292524] group-hover:text-[#c94d42]">
                          {suggestion.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </section>

      <footer className="border-t border-[#e8dfcf] bg-white p-3 sm:p-4">
        <div className="mx-auto max-w-4xl">
          {notice || voice.error ? (
            <div className="mb-3 rounded-md border border-[#f0c7c1] bg-[#fff0ed] px-3 py-2 text-sm font-bold text-[#944139]">
              {notice || voice.error}
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-lg border border-[#e1d8c8] bg-[#fffaf0] p-2 shadow-sm">
            <button
              type="button"
              onClick={voice.isActive ? voice.stop : voice.start}
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-md border bg-white shadow-sm transition",
                voice.isActive
                  ? "border-[#f0c7c1] text-[#c94d42] hover:bg-[#fee4df]"
                  : "border-[#e1d8c8] text-[#5f5b55] hover:border-[#ef594a] hover:text-[#ef594a]"
              )}
              aria-label={voice.isActive ? "Stop voice assistant" : "Talk to assistant"}
              title={voice.isActive ? "Stop voice assistant" : "Talk to assistant"}
            >
              {voice.isActive ? <Square className="h-4 w-4 fill-current" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
            </button>
            <textarea
              ref={textareaRef}
              value={prompt}
              rows={1}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              className="max-h-44 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] font-semibold leading-6 text-[#292524] outline-none placeholder:text-[#a9a196]"
              placeholder="Ask Flowbase to create, summarize, schedule, or plan..."
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isSending}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#ef594a] text-white shadow-sm transition hover:bg-[#dc4d40] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
              title="Send"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            </button>
          </form>
          <p className="mt-2 text-center text-xs font-semibold text-[#8a867d]">
            Actions apply only to your signed-in Flowbase workspace.
          </p>
        </div>
      </footer>
    </div>
  );
}
