"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STREAMING_HOST = "streaming.assemblyai.com";
const STREAMING_SAMPLE_RATE = 16000;
const STREAMING_MODEL = "universal-streaming-english";

type StreamingStatus = "idle" | "connecting" | "recording" | "stopping" | "error";

type TokenResponse = {
  token?: string;
  error?: string;
};

type AssemblyAITurnMessage = {
  type?: string;
  transcript?: string;
  end_of_turn?: boolean;
  turn_order?: number;
  id?: string;
  turn_id?: string;
};

type UseAssemblyAIStreamingOptions = {
  onFinalTranscript?: (transcript: string) => void;
  onPartialTranscript?: (transcript: string) => void;
};

type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function downsampleTo16BitPcm(input: Float32Array, inputSampleRate: number) {
  const sampleRateRatio = inputSampleRate / STREAMING_SAMPLE_RATE;
  const outputLength = Math.floor(input.length / sampleRateRatio);
  const pcm = new Int16Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const inputIndex = Math.floor(outputIndex * sampleRateRatio);
    const sample = Math.max(-1, Math.min(1, input[inputIndex] ?? 0));
    pcm[outputIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return pcm.buffer;
}

function getFinalTurnKey(message: AssemblyAITurnMessage) {
  if (typeof message.turn_order === "number") {
    return `order:${message.turn_order}`;
  }

  if (message.turn_id) {
    return `turn:${message.turn_id}`;
  }

  if (message.id) {
    return `id:${message.id}`;
  }

  return `text:${message.transcript ?? ""}`;
}

export function useAssemblyAIStreaming({ onFinalTranscript, onPartialTranscript }: UseAssemblyAIStreamingOptions = {}) {
  const [status, setStatus] = useState<StreamingStatus>("idle");
  const [livePreview, setLivePreview] = useState("");
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const finalTurnKeysRef = useRef(new Set<string>());
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onPartialTranscriptRef = useRef(onPartialTranscript);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    onPartialTranscriptRef.current = onPartialTranscript;
  }, [onPartialTranscript]);

  const cleanupAudio = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }

    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const socket = socketRef.current;

    setStatus((current) => (current === "idle" ? current : "stopping"));
    cleanupAudio();

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "Terminate" }));
      socket.close();
      return;
    }

    if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.close();
      return;
    }

    socketRef.current = null;
    setLivePreview("");
    setStatus("idle");
  }, [cleanupAudio]);

  const start = useCallback(async () => {
    if (status === "connecting" || status === "recording") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone recording is not supported in this browser.");
      setStatus("error");
      return;
    }

    setStatus("connecting");
    setError("");
    setLivePreview("");
    finalTurnKeysRef.current.clear();

    try {
      const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tokenResponse = await fetch("/api/assemblyai/token");
      const tokenData = (await tokenResponse.json()) as TokenResponse;

      if (!tokenResponse.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Unable to start AssemblyAI streaming.");
      }

      const params = new URLSearchParams({
        speech_model: STREAMING_MODEL,
        sample_rate: String(STREAMING_SAMPLE_RATE),
        token: tokenData.token,
      });
      const socket = new WebSocket(`wss://${STREAMING_HOST}/v3/ws?${params.toString()}`);
      const AudioContextClass = window.AudioContext || (window as BrowserAudioWindow).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Microphone recording is not supported in this browser.");
      }

      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(microphoneStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();

      silentGain.gain.value = 0;
      streamRef.current = microphoneStream;
      socketRef.current = socket;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;

      processor.onaudioprocess = (event) => {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        socket.send(downsampleTo16BitPcm(event.inputBuffer.getChannelData(0), audioContext.sampleRate));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      socket.addEventListener("open", () => {
        setStatus("recording");
      });

      socket.addEventListener("message", (event) => {
        let message: AssemblyAITurnMessage;

        try {
          message = JSON.parse(String(event.data)) as AssemblyAITurnMessage;
        } catch {
          return;
        }

        if (message.type !== "Turn" || !message.transcript?.trim()) {
          return;
        }

        const transcript = message.transcript.trim();

        if (!message.end_of_turn) {
          setLivePreview(transcript);
          onPartialTranscriptRef.current?.(transcript);
          return;
        }

        const turnKey = getFinalTurnKey(message);
        if (finalTurnKeysRef.current.has(turnKey)) {
          return;
        }

        finalTurnKeysRef.current.add(turnKey);
        setLivePreview("");
        onFinalTranscriptRef.current?.(transcript);
      });

      socket.addEventListener("error", () => {
        setError("AssemblyAI streaming connection failed.");
        setStatus("error");
        cleanupAudio();
      });

      socket.addEventListener("close", () => {
        socketRef.current = null;
        cleanupAudio();
        setLivePreview("");
        setStatus((current) => (current === "error" ? current : "idle"));
      });
    } catch (nextError) {
      cleanupAudio();
      socketRef.current?.close();
      socketRef.current = null;
      setError(nextError instanceof Error ? nextError.message : "Unable to start voice transcription.");
      setStatus("error");
    }
  }, [cleanupAudio, status]);

  useEffect(() => stop, [stop]);

  return {
    error,
    isRecording: status === "recording",
    isStarting: status === "connecting",
    isStopping: status === "stopping",
    livePreview,
    start,
    status,
    stop,
  };
}
