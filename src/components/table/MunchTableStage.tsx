'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Table3DScene, CameraViewMode } from '@/lib/table/scene/Table3DScene';
import {
  TableSessionState,
  TableMessage,
  createInitialTableState,
  ALL_TABLE_CHARACTERS
} from '@/lib/table/group-events';
import { MASCOT_SELF_IDENTITIES } from '@/lib/mascots/self-identity';
import { MascotCharacter } from '@/lib/mascots/registry';
import {
  Send,
  Users,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles
} from 'lucide-react';

const TOPIC_STARTERS = [
  'How is everyone at the table feeling today?',
  'Who was the most difficult to build?',
  'What should our main focus be right now?',
  'Let’s take a quiet group breath together.'
];

export function MunchTableStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Table3DScene | null>(null);
  const { resolvedTheme } = useTheme();

  const [state, setState] = useState<TableSessionState>(() => createInitialTableState());
  const [inputText, setInputText] = useState('');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('overview');
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [activeSpeechBubble, setActiveSpeechBubble] = useState<TableMessage | null>(null);

  // 1. Initialize High-Performance 3D Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = resolvedTheme === 'dark';
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new Table3DScene(containerRef.current, isDark, isReducedMotion);
    sceneRef.current = scene;

    // Show initial welcome message
    if (state.messages.length > 0) {
      const initialMsg = state.messages[0];
      setActiveSpeechBubble(initialMsg);
      scene.setActiveSpeaker(initialMsg.senderId as MascotCharacter);
    }

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 2. Synchronize Theme Changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateTheme(resolvedTheme === 'dark');
    }
  }, [resolvedTheme]);

  // 3. Camera Mode Handler
  const handleCameraChange = (mode: CameraViewMode) => {
    setCameraMode(mode);
    if (sceneRef.current) {
      sceneRef.current.setCameraMode(mode);
    }
  };

  // 4. Send Message to Table Circle
  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputText).trim();
    if (!message || state.isProcessing) return;

    setInputText('');

    const userMsg: TableMessage = {
      id: `usr-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      content: message,
      eventType: 'USER_MESSAGE',
      intent: 'lead_response',
      timestamp: Date.now()
    };

    // Update local state with user message
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      activeSpeakerId: 'user',
      isProcessing: true
    }));

    setActiveSpeechBubble(userMsg);
    if (sceneRef.current) {
      sceneRef.current.setActiveSpeaker('user');
    }

    try {
      const res = await fetch('/api/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: message,
          history: state.messages.slice(-8),
          currentTopic: state.currentTopic
        })
      });

      const data = await res.json();

      if (data.success && Array.isArray(data.messages)) {
        // Sequence character responses with natural spoken pacing
        for (let i = 0; i < data.messages.length; i++) {
          const charMsg: TableMessage = data.messages[i];

          // Small natural delay before secondary speaker
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 1400));
          }

          const speakerId = charMsg.senderId as MascotCharacter;

          // If this character interrupts a previous speaker, recoil previous speaker
          if (charMsg.interruptedSpeakerId && sceneRef.current) {
            sceneRef.current.updateCharacterState(charMsg.interruptedSpeakerId, 'interrupted');
          }

          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, charMsg],
            activeSpeakerId: speakerId,
            interruptedSpeakerId: charMsg.interruptedSpeakerId || null
          }));

          setActiveSpeechBubble(charMsg);

          if (sceneRef.current) {
            sceneRef.current.setActiveSpeaker(speakerId);
            sceneRef.current.updateCharacterState(speakerId, 'speaking');

            // Apply non-verbal social reactions to listening mascots
            if (charMsg.reactions) {
              for (const rx of charMsg.reactions) {
                sceneRef.current.updateCharacterReaction(rx.characterId, rx.reaction);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to send table message:', err);
    } finally {
      setState((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  const getSpeakerColor = (senderId: string) => {
    if (senderId === 'user') return '#10b981';
    const mascot = MASCOT_SELF_IDENTITIES[senderId as MascotCharacter];
    switch (mascot?.id) {
      case 'munch': return '#8fd9a8';
      case 'ollie': return '#cdb4ff';
      case 'ellie': return '#bce3ff';
      case 'pandy': return '#64748b';
      case 'dobby': return '#ead5c3';
      case 'coco': return '#ffaf7a';
      case 'froggy': return '#8fd9a8';
      case 'bubbles': return '#bce3ff';
      case 'chicky': return '#ffe08a';
      default: return '#10b981';
    }
  };

  return (
    <div className="relative w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent select-none">
      {/* 3D Canvas Viewport (Fills the entire stage seamlessly) */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
        style={{ touchAction: 'none' }}
      />

      {/* Top Floating Glass Navigation & Camera Perspective Controls */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex items-center justify-between pointer-events-none z-10 gap-2">
        {/* Room & Seating Counter Pill */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg pointer-events-auto">
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-dark dark:text-emerald-400" />
          <span className="text-xs sm:text-sm font-bold text-charcoal dark:text-slate-100">
            Munch Table
          </span>
          <span className="text-[11px] text-charcoal/60 dark:text-slate-400 hidden xs:inline">
            ({ALL_TABLE_CHARACTERS.length + 1} seated)
          </span>
        </div>

        {/* Camera Perspective Mode Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg pointer-events-auto">
          <button
            onClick={() => handleCameraChange('overview')}
            className={`px-2.5 sm:px-3 py-1 text-xs rounded-full font-semibold transition-all ${
              cameraMode === 'overview'
                ? 'bg-primary-dark text-white shadow-sm'
                : 'text-charcoal/70 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => handleCameraChange('speaker')}
            className={`px-2.5 sm:px-3 py-1 text-xs rounded-full font-semibold transition-all ${
              cameraMode === 'speaker'
                ? 'bg-primary-dark text-white shadow-sm'
                : 'text-charcoal/70 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            Speaker
          </button>
          <button
            onClick={() => handleCameraChange('user_pov')}
            className={`px-2.5 sm:px-3 py-1 text-xs rounded-full font-semibold transition-all ${
              cameraMode === 'user_pov'
                ? 'bg-primary-dark text-white shadow-sm'
                : 'text-charcoal/70 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            Your Seat
          </button>
        </div>

        {/* Clean Transcript Log Drawer Button */}
        <button
          onClick={() => setIsTranscriptOpen((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-full bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg text-xs font-semibold text-charcoal dark:text-slate-200 pointer-events-auto hover:bg-white dark:hover:bg-slate-800 transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5 text-primary-dark dark:text-emerald-400" />
          <span className="hidden sm:inline">Transcript</span>
          {isTranscriptOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Floating Active Speaker Bubble (Lightweight Glass Dialogue Card) */}
      {activeSpeechBubble && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 max-w-xl w-[92%] pointer-events-none z-10 transition-all duration-300">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full ring-2 ring-white/60 dark:ring-black/40 animate-pulse"
                  style={{ backgroundColor: getSpeakerColor(activeSpeechBubble.senderId) }}
                />
                <span className="text-xs font-bold text-charcoal dark:text-slate-100 tracking-wide">
                  {activeSpeechBubble.senderName}
                </span>
              </div>
              <span className="text-[10px] text-charcoal/40 dark:text-slate-400 font-medium">
                Speaking
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-charcoal/90 dark:text-slate-200 leading-relaxed">
              {activeSpeechBubble.content}
            </p>
          </div>
        </div>
      )}

      {/* Clean Transcript History Drawer */}
      {isTranscriptOpen && (
        <div className="absolute top-14 sm:top-16 right-3 sm:right-4 w-72 sm:w-80 max-h-[55vh] bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl shadow-2xl p-3.5 sm:p-4 overflow-y-auto z-20 flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-charcoal/10 dark:border-white/10 pb-2">
            <span className="text-xs font-bold text-charcoal dark:text-slate-200">Discussion Transcript</span>
            <span className="text-[10px] text-charcoal/50 dark:text-slate-400">{state.messages.length} messages</span>
          </div>
          <div className="flex flex-col gap-2">
            {state.messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl text-xs transition-all ${
                  msg.senderId === 'user'
                    ? 'bg-primary/15 dark:bg-emerald-950/40 border border-primary/20 dark:border-emerald-800/40 ml-3'
                    : 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 mr-3'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-charcoal dark:text-slate-100 mb-0.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getSpeakerColor(msg.senderId) }}
                  />
                  <span>{msg.senderName}</span>
                </div>
                <div className="text-charcoal/80 dark:text-slate-300 leading-snug">{msg.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Bottom Composer & Quick Topics */}
      <div className="absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-[94%] sm:w-[90%] z-10 flex flex-col gap-2 pointer-events-none">
        {/* Quick Topic Starter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pointer-events-auto">
          {TOPIC_STARTERS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(topic)}
              disabled={state.isProcessing}
              className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border border-white/40 dark:border-white/10 text-charcoal/80 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-md disabled:opacity-50"
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Floating Glass Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 p-1.5 sm:p-2 rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-2xl pointer-events-auto"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={state.isProcessing ? 'The circle is speaking...' : 'Speak to everyone at the table...'}
            disabled={state.isProcessing}
            className="flex-1 px-3 sm:px-4 py-2 bg-transparent text-xs sm:text-sm text-charcoal dark:text-slate-100 placeholder-charcoal/40 dark:placeholder-slate-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || state.isProcessing}
            className="p-2 sm:p-2.5 rounded-xl bg-primary-dark hover:bg-emerald-600 disabled:bg-stone-300 dark:disabled:bg-slate-700 text-white transition-all shadow-md flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            {state.isProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
