"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

export default function Chat() {
  const [user, setUser] = useState<any>(null);

  // group chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const groupBottomRef = useRef<HTMLDivElement>(null);

  // ai chat
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.href = "/";
      setUser(data.session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    // load existing messages
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data ?? []));

    // real-time subscription
    const channel = supabase
      .channel("messages")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  async function sendAiMessage() {
    if (!aiInput.trim()) return;
    const content = aiInput.trim();
    setAiInput("");

    setAiMessages((prev) => [...prev, { role: "user", content }]);
    setAiLoading(true);

    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: content }),
    });
    const data = await res.json();
    setAiLoading(false);
    setAiMessages((prev) => [...prev, { role: "ai", content: data.response }]);
  }

  return (
    <main className="flex flex-col h-screen bg-background">

      {/* header */}
      <div className="relative border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold">Chat Room</h1>

        {/*Title */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
          <img src="/pinnicalMini.png" alt="Logo" className="w-6 h-6" />
          <h2 className="text-lg text-yellow-500">Pinnical</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user?.user_metadata.full_name}</span>
        <Button variant="outline" size="sm" onClick={() => window.location.href = "/"}>
            Go back
          </Button>
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut().then(() => window.location.href = "/")}>
            Sign out
          </Button>
        </div>
      </div>

      {/* two panels */}
      <div className="flex flex-1 overflow-hidden">

        {/* group chat */}
        <div className="flex flex-col flex-1 border-r">
          <div className="px-4 py-2 border-b">
            <p className="text-sm font-medium">Group chat</p>
            <p className="text-xs text-muted-foreground">Users Connected:  </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={msg.user_avatar} />
                  <AvatarFallback>{msg.user_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{msg.user_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={groupBottomRef} />
          </div>
          <div className="border-t px-4 py-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Message the group..."
              className="flex-1"
            />
            <Button onClick={sendMessage}>Send</Button>
          </div>
        </div>

        {/* ai chat */}
        <div className="flex flex-col flex-1">
          <div className="px-4 py-2 border-b">
            <p className="text-sm font-medium">AI assistant</p>
            <p className="text-xs text-muted-foreground">Private — not saved</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {aiMessages.map((msg, i) => (
              <div key={i} className="flex items-start gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback>{msg.role === "ai" ? "AI" : user?.user_metadata.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{msg.role === "ai" ? "Placeholder AI" : "You"}</span>
                    {msg.role === "ai" && <Badge variant="secondary" className="text-xs">AI</Badge>}
                  </div>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {aiLoading && <p className="text-sm text-muted-foreground animate-pulse">Thinking...</p>}
            <div ref={aiBottomRef} />
          </div>
          <div className="border-t px-4 py-3 flex gap-2">
            <Input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendAiMessage()}
              placeholder="Ask the AI anything..."
              className="flex-1"
            />
            <Button onClick={sendAiMessage}>Ask</Button>
          </div>
        </div>

      </div>
    </main>
  );
}