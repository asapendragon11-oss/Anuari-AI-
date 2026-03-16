/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, Flame, Shield, Zap, RefreshCw, Settings, X, Image as ImageIcon, Globe, Wand2, Camera, Paperclip, Mic, MicOff, Video, Loader2, Copy, Check, History, Plus, MessageSquare, Trash2, Menu } from "lucide-react";

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: string; // Store as ISO string for easy serialization
  image?: string;
  video?: string;
  isImageGeneration?: boolean;
  isVideoGeneration?: boolean;
  sources?: { uri: string; title: string }[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: string;
}

const DEFAULT_SYSTEM_PROMPT = "You are Anuari AI, a wise and powerful AI assistant. Your tone is noble, slightly mystical, yet helpful and modern. You refer to users as 'travelers' or 'seekers'.";

const IMAGE_PROMPTS = [
  "A mystical dragon in a digital realm",
  "Cyberpunk city with neon rain",
  "Ancient library floating in space",
  "Majestic phoenix rising from ashes",
  "Futuristic laboratory with holograms"
];

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showImagePrompts, setShowImagePrompts] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [videoProgress, setVideoProgress] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('anuari_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
          setMessages(parsed[0].messages);
        } else {
          createNewSession();
        }
      } catch (e) {
        console.error("Failed to parse sessions", e);
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('anuari_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Manifestation",
      messages: [
        {
          role: 'model',
          text: "Greetings, traveler. I am Anuari AI, your intelligent guide through the realms of knowledge. I now possess the power of sight, the wisdom of the global web, and the ability to manifest visions. How may I assist you today?",
          timestamp: new Date().toISOString()
        }
      ],
      lastUpdated: new Date().toISOString()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages(newSession.messages);
    setIsHistoryOpen(false);
  };

  const selectSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      setIsHistoryOpen(false);
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    if (currentSessionId === id) {
      if (updatedSessions.length > 0) {
        setCurrentSessionId(updatedSessions[0].id);
        setMessages(updatedSessions[0].messages);
      } else {
        createNewSession();
      }
    }
  };

  const updateCurrentSession = (newMessages: Message[]) => {
    setMessages(newMessages);
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        // Update title based on first user message if it's still default
        let title = s.title;
        if (title === "New Manifestation") {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? "..." : "");
          }
        }
        return { ...s, messages: newMessages, title, lastUpdated: new Date().toISOString() };
      }
      return s;
    }));
  };
  
  // Gemini Features State
  const [useSearch, setUseSearch] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Failed to start recognition:", error);
      }
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setImageMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (isImageGen = false) => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: new Date().toISOString(),
      image: selectedImage || undefined
    };

    const updatedMessages = [...messages, userMessage];
    updateCurrentSession(updatedMessages);
    
    const currentInput = input;
    const currentImage = selectedImage;
    const currentMimeType = imageMimeType;
    
    setInput('');
    setSelectedImage(null);
    setImageMimeType(null);
    setShowImagePrompts(false);
    setIsLoading(true);

    try {
      if (isImageGen) {
        // Image Generation Feature
        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: currentInput || "A mystical dragon in a digital realm" }],
          },
          config: {
            imageConfig: { aspectRatio: "1:1" }
          }
        });

        let generatedImageUrl = "";
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        const aiMessage: Message = {
          role: 'model',
          text: "I have manifested your vision from the ethereal mists.",
          timestamp: new Date().toISOString(),
          image: generatedImageUrl,
          isImageGeneration: true
        };
        updateCurrentSession([...updatedMessages, aiMessage]);
      } else {
        // Standard Chat / Vision / Search
        const parts: any[] = [{ text: currentInput }];
        
        if (currentImage && currentMimeType) {
          parts.push({
            inlineData: {
              data: currentImage.split(',')[1],
              mimeType: currentMimeType
            }
          });
        }

        const response = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: { parts },
          config: {
            systemInstruction: systemPrompt,
            tools: useSearch ? [{ googleSearch: {} }] : undefined,
          },
        });

        const text = response.text;
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => ({
          uri: chunk.web?.uri || "",
          title: chunk.web?.title || "Source"
        })).filter(s => s.uri) || [];

        const aiMessage: Message = {
          role: 'model',
          text: text || "My fire is dim... I could not find the words.",
          timestamp: new Date().toISOString(),
          sources: sources.length > 0 ? sources : undefined
        };

        updateCurrentSession([...updatedMessages, aiMessage]);
      }
    } catch (error) {
      console.error("Error calling Gemini AI:", error);
      const errorMessage: Message = {
        role: 'model',
        text: "Forgive me, but my draconic senses are clouded. An error occurred while processing your request.",
        timestamp: new Date().toISOString()
      };
      updateCurrentSession([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoSend = async () => {
    if (!input.trim() || isLoading) return;

    // Check for API key
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await (window as any).aistudio.openSelectKey();
      // Assume success and proceed
    }

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    updateCurrentSession(updatedMessages);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setVideoProgress("Initiating manifestation of your vision...");

    try {
      // Use API_KEY if available (from selection dialog), otherwise fallback to GEMINI_API_KEY
      const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY || "";
      const ai = new GoogleGenAI({ apiKey });
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: currentInput,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      const progressMessages = [
        "Weaving the threads of reality...",
        "Capturing the ethereal light...",
        "Manifesting the temporal flow...",
        "Finalizing the vision from the mists...",
        "Almost there, traveler..."
      ];
      let msgIdx = 0;

      while (!operation.done) {
        setVideoProgress(progressMessages[msgIdx % progressMessages.length]);
        msgIdx++;
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("No video generated");

      const currentApiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY || "";
      const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': currentApiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          await (window as any).aistudio.openSelectKey();
          throw new Error("API key invalid or expired. Please select a valid key.");
        }
        throw new Error("Failed to fetch video");
      }

      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);

      const aiMessage: Message = {
        role: 'model',
        text: "I have woven your vision into the temporal tapestry.",
        timestamp: new Date().toISOString(),
        video: videoUrl,
        isVideoGeneration: true
      };
      updateCurrentSession([...updatedMessages, aiMessage]);
    } catch (error: any) {
      console.error("Error generating video:", error);
      const errorMessage: Message = {
        role: 'model',
        text: `Forgive me, traveler. The mists were too thick: ${error.message || "Unknown error"}`,
        timestamp: new Date().toISOString()
      };
      updateCurrentSession([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      setVideoProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-200 font-sans selection:bg-orange-500/30 flex overflow-hidden">
      {/* Sidebar - Chat History */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              className="fixed inset-y-0 left-0 w-80 bg-[#0d0d0d] border-r border-white/5 z-50 flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400 flex items-center gap-2">
                  <History size={16} />
                  Chronicles
                </h2>
                <button onClick={() => setIsHistoryOpen(false)} className="p-1 hover:bg-white/5 rounded text-stone-500">
                  <X size={18} />
                </button>
              </div>

              <div className="p-4">
                <button
                  onClick={createNewSession}
                  className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-lg shadow-orange-900/20"
                >
                  <Plus size={18} />
                  New Manifestation
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => selectSession(session.id)}
                    className={`w-full p-3 rounded-xl text-left transition-all group relative border ${
                      currentSessionId === session.id
                        ? 'bg-orange-600/10 border-orange-500/30 text-orange-400'
                        : 'bg-white/5 border-transparent hover:bg-white/10 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare size={16} className="mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate pr-6">{session.title}</p>
                        <p className="text-[10px] opacity-50 mt-1">
                          {new Date(session.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteSession(e, session.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </button>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col relative h-screen">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto w-full h-full flex flex-col relative z-10">
          {/* Header */}
          <header className="p-6 border-b border-white/5 flex items-center justify-between backdrop-blur-md bg-black/20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg text-stone-400 lg:hidden"
              >
                <Menu size={20} />
              </button>
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="hidden lg:flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-stone-400 transition-colors group"
                title="View Chronicles"
              >
                <History size={20} className="group-hover:text-orange-400 transition-colors" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
                  <Flame className="text-white w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    Anuari AI
                    <span className="text-[10px] uppercase tracking-widest bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20">Ultra</span>
                  </h1>
                  <p className="text-xs text-stone-500 font-medium italic">Multimodal • Search • Vision</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setUseSearch(!useSearch)}
                className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${useSearch ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-white/5 text-stone-500'}`}
                title="Toggle Google Search Grounding"
              >
                <Globe size={16} />
                <span className="hidden sm:inline">Search</span>
              </button>
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-2 rounded-lg transition-colors ${isSettingsOpen ? 'bg-orange-600 text-white' : 'hover:bg-white/5 text-stone-400 hover:text-white'}`}
                title="Persona Settings"
              >
                <Settings size={18} />
              </button>
              <button 
                onClick={createNewSession}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-stone-400 hover:text-white"
                title="New Chat"
              >
                <Plus size={18} />
              </button>
            </div>
          </header>

        {/* Settings Panel */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/5 bg-stone-900/30 backdrop-blur-sm"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400 flex items-center gap-2">
                    <Sparkles size={14} />
                    Tailor Anuari's Persona
                  </h2>
                  <button 
                    onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                    className="text-[10px] uppercase tracking-wider text-stone-500 hover:text-white transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Define how Anuari should behave..."
                  className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-stone-300 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                    msg.role === 'user' 
                      ? 'bg-stone-800 border border-white/10' 
                      : 'bg-gradient-to-br from-orange-600/20 to-red-700/20 border border-orange-500/30'
                  }`}>
                    {msg.role === 'user' ? <User size={16} className="text-stone-400" /> : <Bot size={16} className="text-orange-400" />}
                  </div>
                  <div className={`space-y-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed relative group/msg ${
                      msg.role === 'user'
                        ? 'bg-stone-800/50 text-stone-200 border border-white/5'
                        : 'bg-white/5 text-stone-300 border border-white/5'
                    }`}>
                      {msg.image && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-white/10">
                          <img src={msg.image} alt="Uploaded content" className="max-w-full h-auto max-h-64 object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      {msg.video && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black">
                          <video src={msg.video} controls className="w-full h-auto max-h-96" />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                      
                      {msg.role === 'model' && (
                        <button
                          onClick={() => handleCopy(msg.text, idx)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-stone-500 hover:text-white opacity-0 group-hover/msg:opacity-100 transition-all"
                          title="Copy to clipboard"
                        >
                          {copiedIndex === idx ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                      )}
                      
                      {msg.sources && (
                        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold flex items-center gap-1">
                            <Globe size={10} /> Sources
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source, sIdx) => (
                              <a 
                                key={sIdx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/5 transition-colors text-blue-400 truncate max-w-[200px]"
                              >
                                {source.title}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-stone-600 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex gap-4 items-center">
                <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                  {videoProgress ? <Loader2 size={16} className="text-orange-400 animate-spin" /> : <Bot size={16} className="text-orange-400 animate-pulse" />}
                </div>
                <div className="flex flex-col gap-1">
                  {videoProgress && <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest animate-pulse">{videoProgress}</span>}
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Input Area */}
        <footer className="p-6 bg-gradient-to-t from-black to-transparent space-y-4">
          <AnimatePresence>
            {showImagePrompts && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex flex-wrap gap-2 pb-2"
              >
                <div className="w-full text-[10px] uppercase tracking-widest text-purple-400 font-bold mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={12} />
                    Manifestation Ideas
                  </div>
                  <button 
                    onClick={() => setShowImagePrompts(false)}
                    className="text-stone-600 hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
                {IMAGE_PROMPTS.map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => {
                      setInput(prompt);
                      setShowImagePrompts(false);
                    }}
                    className="text-[10px] bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 rounded-full transition-all text-stone-300 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {selectedImage && (
            <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10 w-fit animate-in fade-in slide-in-from-bottom-2">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10">
                <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-0 right-0 p-0.5 bg-black/60 text-white hover:bg-red-600 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">
                Image Attached
              </div>
            </div>
          )}

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500" />
            <div className="relative flex items-center bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center pl-2">
                <button
                  onClick={toggleListening}
                  className={`p-2.5 transition-colors rounded-xl hover:bg-white/5 ${isListening ? 'text-red-500 animate-pulse' : 'text-stone-500 hover:text-orange-400'}`}
                  title={isListening ? "Stop Listening" : "Voice Input"}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-stone-500 hover:text-orange-400 transition-colors rounded-xl hover:bg-white/5"
                  title="Upload Image (Vision)"
                >
                  <Paperclip size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={selectedImage ? "Ask about this image..." : "Ask Anuari anything..."}
                className="flex-1 bg-transparent px-4 py-4 text-sm focus:outline-none text-stone-200 placeholder:text-stone-600"
              />
              
              <div className="flex items-center pr-2 gap-1">
                <button
                  onClick={() => {
                    if (!input.trim()) {
                      setShowImagePrompts(!showImagePrompts);
                    } else {
                      handleSend(true);
                    }
                  }}
                  disabled={isLoading}
                  className={`p-2.5 rounded-xl transition-all ${
                    isLoading
                      ? 'text-stone-700 cursor-not-allowed'
                      : showImagePrompts
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                        : 'text-purple-400 hover:bg-purple-500/10'
                  }`}
                  title={input.trim() ? "Generate Image (Imagen)" : "Show Example Prompts"}
                >
                  <Wand2 size={18} />
                </button>
                <button
                  onClick={handleVideoSend}
                  disabled={!input.trim() || isLoading}
                  className={`p-2.5 rounded-xl transition-all ${
                    input.trim() && !isLoading
                      ? 'text-blue-400 hover:bg-blue-500/10'
                      : 'text-stone-700 cursor-not-allowed'
                  }`}
                  title="Generate Video (Veo)"
                >
                  <Video size={18} />
                </button>
                <button
                  onClick={() => handleSend(false)}
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className={`p-2.5 rounded-xl transition-all ${
                    (input.trim() || selectedImage) && !isLoading
                      ? 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-900/20'
                      : 'text-stone-700 cursor-not-allowed'
                  }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center gap-6 text-[10px] uppercase tracking-widest text-stone-600 font-bold">
            <div className="flex items-center gap-1.5">
              <Shield size={12} className="text-orange-900/50" />
              Secure
            </div>
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-orange-900/50" />
              Fast
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-orange-900/50" />
              Intelligent
            </div>
          </div>
        </footer>
      </div>
    </div>
  </div>
  );
}
