'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Table3DScene, CameraViewMode } from '@/lib/table/scene/Table3DScene';
import {
  TableSessionState,
  TableMessage,
  createInitialTableState,
  ALL_TABLE_CHARACTERS,
  TableEventType
} from '@/lib/table/group-events';
import { MASCOT_SELF_IDENTITIES } from '@/lib/mascots/self-identity';
import { MascotCharacter } from '@/lib/mascots/registry';
import {
  Send,
  Eye,
  User,
  Users,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Volume2,
  ChevronDown,
  ChevronUp,
  Flame,
  Laugh,
  CheckCircle2,
  AlertCircle
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

  // 1. Initialize 3D Scene
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

  // 2. Synchronize Day/Night Theme
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateTheme(resolvedTheme === 'dark');
    }
  }, [resolvedTheme]);

  // 3. Handle Camera Mode Change
  const handleCameraChange = (mode: CameraViewMode) => {
    setCameraMode(mode);
    if (sceneRef.current) {
      sceneRef.current.setCameraMode(mode);
    }
  };

  // 4. Send Message to Table
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

    // Update state with user message
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
        // Sequence character responses with visual timing
        for (let i = 0; i < data.messages.length; i++) {
          const charMsg: TableMessage = data.messages[i];

          // Small delay before secondary/interrupted speaker
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 1500));
          }

          const speakerId = charMsg.senderId as MascotCharacter;

          // If this character interrupts a previous speaker, trigger yielding recoil on the previous speaker
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

            // Apply reactions to other characters
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

  const renderEventBadge = (eventType: TableEventType) => {
    switch (eventType) {
      case 'CHARACTER_INTERRUPT':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Interrupted!
          </span>
        );
      case 'CHARACTER_ROAST':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 font-semibold flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" /> Roast
          </span>
        );
      case 'CHARACTER_TEASE':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1">
            <Laugh className="w-3 h-3 text-rose-500" /> Tease
          </span>
        );
      case 'CHARACTER_DISAGREE':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 font-semibold">
            Challenges
          </span>
        );
      case 'CHARACTER_AGREE':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Agrees
          </span>
        );
      case 'DISCUSSION_END':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 font-semibold">
            Settle & Floor
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-stone-900 select-none">
      {/* 3D Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        {/* Room Header */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-stone-200 dark:border-stone-800 shadow-sm pointer-events-auto">
          <Users className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-stone-800 dark:text-stone-100">
            Munch Table <span className="text-stone-400 font-normal">({ALL_TABLE_CHARACTERS.length + 1} seated)</span>
          </span>
        </div>

        {/* Camera Perspective Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-stone-200 dark:border-stone-800 shadow-sm pointer-events-auto">
          <button
            onClick={() => handleCameraChange('overview')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
              cameraMode === 'overview'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => handleCameraChange('speaker')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
              cameraMode === 'speaker'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            Speaker Focus
          </button>
          <button
            onClick={() => handleCameraChange('user_pov')}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
              cameraMode === 'user_pov'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            Your Seat
          </button>
        </div>

        {/* Transcript Toggle */}
        <button
          onClick={() => setIsTranscriptOpen((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-stone-200 dark:border-stone-800 shadow-sm text-xs font-medium text-stone-700 dark:text-stone-200 pointer-events-auto hover:bg-white dark:hover:bg-stone-800 transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
          <span>Log</span>
          {isTranscriptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Floating Active Speaker Bubble (Hybrid 3D Overlay) */}
      {activeSpeechBubble && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 max-w-lg w-[90%] pointer-events-none z-10 transition-all duration-300">
          <div className="p-4 rounded-2xl bg-white/90 dark:bg-stone-900/90 backdrop-blur-lg border border-stone-200/80 dark:border-stone-800/80 shadow-xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{
                    backgroundColor:
                      activeSpeechBubble.senderId === 'user'
                        ? '#10b981'
                        : MASCOT_SELF_IDENTITIES[activeSpeechBubble.senderId as MascotCharacter]?.species
                        ? '#8fd9a8'
                        : '#10b981'
                  }}
                />
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                  {activeSpeechBubble.senderName}
                </span>
                {renderEventBadge(activeSpeechBubble.eventType)}
              </div>
              <span className="text-[10px] text-stone-400">Live</span>
            </div>
            <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-relaxed">
              {activeSpeechBubble.content}
            </p>
          </div>
        </div>
      )}

      {/* Transcript Log Drawer */}
      {isTranscriptOpen && (
        <div className="absolute top-16 right-4 w-80 max-h-[60vh] bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl p-4 overflow-y-auto z-20 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-200">Discussion History</span>
            <span className="text-[10px] text-stone-400">{state.messages.length} turns</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {state.messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl text-xs ${
                  msg.senderId === 'user'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40 ml-4'
                    : 'bg-stone-100 dark:bg-stone-800/60 mr-4'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-stone-900 dark:text-stone-100 mb-0.5">
                  <span>{msg.senderName}</span>
                  {renderEventBadge(msg.eventType)}
                </div>
                <div className="text-stone-700 dark:text-stone-300">{msg.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Composer & Quick Topics */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-[92%] z-10 flex flex-col gap-2 pointer-events-none">
        {/* Quick Topic Starter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pointer-events-auto">
          {TOPIC_STARTERS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(topic)}
              disabled={state.isProcessing}
              className="whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium bg-white/75 dark:bg-stone-900/75 backdrop-blur-md border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800 transition-all shadow-sm disabled:opacity-50"
            >
              {topic}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 p-2 rounded-2xl bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border border-stone-200/90 dark:border-stone-800/90 shadow-2xl pointer-events-auto"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={state.isProcessing ? 'The circle is speaking...' : 'Speak to the circle at the table...'}
            disabled={state.isProcessing}
            className="flex-1 px-4 py-2 bg-transparent text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || state.isProcessing}
            className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white transition-all shadow-sm"
          >
            {state.isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
