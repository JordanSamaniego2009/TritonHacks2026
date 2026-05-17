"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";

const MapPanel = dynamic(() => import("./Mappanel"), { ssr: false });

type AnalysisResult = {
  scene_type: string;
  culture: string;
  historical_context: string;
  description: string;
  weather: string;
  flora_fauna: string[];
  confidence: number;
  location: string;
  imageBase64?: string;
  error?: string;
};
type Message = {
  id: number;
  user_id: string;
  user_name: string;
  user_avatar: string;
  content: string;
  created_at: string;
};
type AiMessage = {
  role: "user" | "ai";
  content: string;
};

// Animated message wrapper — fades + slides in on mount
function AnimatedMessage({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Tiny delay so the initial render fires before the transition
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateY(0)"
          : align === "right"
          ? "translateX(8px)"
          : "translateX(-8px)",
        transition: "opacity 220ms ease, transform 220ms ease",
      }}
    >
      {children}
    </div>
  );
}

export default function Chat() {
  const [user, setUser] = useState<any>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const groupBottomRef = useRef<HTMLDivElement>(null);

  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef<HTMLDivElement>(null);

  const [analysisContext, setAnalysisContext] = useState<AnalysisResult | null>(null);

  function handleAnalysisResult(result: AnalysisResult, pinId?: number) {
    setAnalysisContext(result);
  }

  async function sendAiMessage() {
    if (!aiInput.trim()) return;
    const content = aiInput.trim();
    setAiInput("");
    setAiMessages((prev) => [...prev, { role: "user", content }]);
    setAiLoading(true);

    const contextPrefix = analysisContext
      ? `[Image context — scene: ${analysisContext.scene_type}, culture: ${analysisContext.culture}, weather: ${analysisContext.weather}, flora/fauna: ${(analysisContext.flora_fauna ?? []).join(", ")}, history: ${analysisContext.historical_context}, location: ${analysisContext.location}] `
      : "";

    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: contextPrefix + content,
        image_base64: analysisContext?.imageBase64 ?? null,
      }),
    });

    const data = await res.json();
    setAiLoading(false);
    setAiMessages((prev) => [...prev, { role: "ai", content: data.response }]);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.href = "/";
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data ?? []));

    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    groupBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  async function sendMessage() {
    if (!input.trim() || !user) return;
    const content = input.trim();
    setInput("");
    await supabase.from("messages").insert({
      user_id: user.id,
      user_name: user.user_metadata.full_name,
      user_avatar: user.user_metadata.avatar_url,
      content,
    });
  }

  return (
    <main className="flex flex-col h-screen bg-background">
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between border-b px-5 py-3 shrink-0"
        style={{ transition: "border-color 200ms ease, background 200ms ease" }}
      >
        <div className="flex items-center gap-2">
          <img src="/miniLogo.svg" alt="Logo" className="w-4.2 h-6" />
          <span
            className="text-lg font-semibold"
            style={{ color: "oklch(0.655 0.095 78.0)" }}
          >
            Pinnical
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.user_metadata.full_name}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="transition-all duration-150 hover:scale-[1.03] active:scale-95"
            onClick={() => (window.location.href = "/")}
          >
            Go back
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="transition-all duration-150 hover:scale-[1.03] active:scale-95"
            onClick={() =>
              supabase.auth.signOut().then(() => (window.location.href = "/"))
            }
          >
            Sign out
          </Button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Group Chat sidebar ── */}
        <aside className="w-80 shrink-0 flex flex-col border-r bg-card overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Group Chat
            </p>
            <p className="text-xs text-muted-foreground">Talk Below</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-6">
                No messages yet. Say something!
              </p>
            )}
            {messages.map((msg) => (
              <AnimatedMessage key={msg.id}>
                <div className="flex items-start gap-2.5">
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarImage src={msg.user_avatar} />
                    <AvatarFallback className="text-xs">
                      {msg.user_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-medium truncate">
                        {msg.user_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/90 break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              </AnimatedMessage>
            ))}
            <div ref={groupBottomRef} />
          </div>

          <div className="border-t px-3 py-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Message the group..."
              className="flex-1 h-8 text-xs transition-shadow duration-150 focus:shadow-sm"
            />
            <Button
              size="sm"
              className="h-8 px-3 text-xs transition-all duration-150 hover:scale-[1.04] active:scale-95"
              onClick={sendMessage}
            >
              Send
            </Button>
          </div>
        </aside>

        {/* ── Map ── */}
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <MapPanel
            onAnalysisResult={handleAnalysisResult}
            onPinContextSwitch={async (pin) => {
              if (pin) {
                const compressImage = (dataUrl: string): Promise<string> =>
                  new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      const scale = Math.min(1, 800 / img.width);
                      canvas.width = img.width * scale;
                      canvas.height = img.height * scale;
                      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
                      resolve(canvas.toDataURL("image/jpeg", 0.6));
                    };
                    img.src = dataUrl;
                  });

                const compressed = pin.image
                  ? await compressImage(pin.image)
                  : undefined;

                setAnalysisContext({
                  scene_type: pin.label ?? "",
                  culture: "",
                  historical_context: "",
                  description: pin.analysis ?? "",
                  weather: "",
                  flora_fauna: [],
                  confidence: 0,
                  location: pin.note ?? "",
                  imageBase64: compressed,
                });
              } else {
                setAnalysisContext(null);
              }
            }}
          />
        </div>

        {/* ── AI Chat sidebar ── */}
        <section className="flex flex-col w-90 shrink-0 border-l overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
            <div>
              <p className="text-sm font-medium">AI Assistant</p>
              <p className="text-xs text-muted-foreground">Private — not saved</p>
            </div>
            <Badge variant="secondary" className="text-xs">AI</Badge>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            {aiMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Ask me anything
                </p>
                <p className="text-xs text-muted-foreground">
                  Your conversation is private and not saved.
                </p>
              </div>
            )}

            {aiMessages.map((msg, i) => (
              <AnimatedMessage key={i} align={msg.role === "user" ? "right" : "left"}>
                <div
                  className={`flex items-start gap-3 ${
                    msg.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {msg.role === "ai"
                        ? "AI"
                        : user?.user_metadata.full_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[70%] ${
                      msg.role === "user" ? "items-end" : "items-start"
                    } flex flex-col gap-1`}
                  >
                    <span className="text-xs text-muted-foreground">
                      {msg.role === "ai" ? "AI Assistant" : "You"}
                    </span>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              </AnimatedMessage>
            ))}

            {/* Thinking indicator */}
            {aiLoading && (
              <div
                className="flex items-start gap-3"
                style={{
                  animation: "fadeSlideIn 200ms ease forwards",
                }}
              >
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="text-xs">AI</AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 flex gap-1.5 items-center">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 inline-block"
                      style={{
                        animation: `bounce 900ms ${delay}ms ease-in-out infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={aiBottomRef} />
          </div>

          <div className="border-t px-5 py-4 flex gap-3 shrink-0">
            <Input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendAiMessage()}
              placeholder="Ask the AI anything"
              className="flex-1 transition-shadow duration-150 focus:shadow-sm"
            />
            <Button
              onClick={sendAiMessage}
              className="transition-all duration-150 hover:scale-[1.04] active:scale-95"
            >
              Ask
            </Button>
          </div>
        </section>
      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0);    opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1;   }
        }
      `}</style>
    </main>
  );
}