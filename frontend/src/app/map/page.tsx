"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";

const MapPanel = dynamic(() => import("./mapPanel"), { ssr: false });

type AnalysisResult = {
	sceneType: string;
	culture: string;
	historicalContext: string;
	description: string;
	weather: string;
	floraFauna: string[];
	confidence: number;
	location: string;
	latitude?: number;
	longitude?: number;
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

type AIMessage = {
	role: "user" | "ai";
	content: string;
};

export type ServicePin = {
	name: string;
	latitude: number;
	longitude: number;
	category: string;
	address?: string;
};

export default function Chat() {
	const [user, setUser] = useState<any>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const groupBottomRef = useRef<HTMLDivElement>(null);

	const [AIMessages, setAIMessages] = useState<AIMessage[]>([]);
	const [AIInput, setAIInput] = useState("");
	const [AILoading, setAILoading] = useState(false);
	const AIBottomRef = useRef<HTMLDivElement>(null);

	const [analysisContext, setAnalysisContext] = useState<AnalysisResult | null>(null);
	const [servicePins, setServicePins] = useState<ServicePin[]>([]);
	
	// helper function for frontend (neil stuff):
	function handleAnalysisResult(result: AnalysisResult) {
		setAnalysisContext(result);
	}
	
	// effects:
	useEffect(() => { // check if we're looged in, redirect if not and store the user variable
		supabase.auth.getSession().then(({ data }) => {
			if (!data.session) window.location.href = "/";
			setUser(data.session?.user ?? null);
		});
	}, []);

	useEffect(() => { //  load all existing messages and wait for new messages to also load in
		supabase.from("messages").select("*").order("created_at", { ascending: true })
		  .then(({ data }) => setMessages(data ?? []));

		const channel = supabase.channel("messages")
		  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
			(payload) => setMessages((prev) => [...prev, payload.new as Message]))
		  .subscribe();

		return () => { supabase.removeChannel(channel); };
	}, []);

	useEffect(() => { // auto scroll chat
		groupBottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => { // auto scroll ai chat
		AIBottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [AIMessages]);
	
	// async functions/messaging system:
	async function sendAIMessage() {
		if (!AIInput.trim()) return;
		
		const content = AIInput.trim();
		
		setAIInput("");
		setAIMessages( (prev) => [...prev, { role: "user", content }] );
		setAILoading(true);
		
		// give the AI additional context from both the pin and the image itself if possible (claude used here to figure out the best information to send over)
		const AIContext = analysisContext
		? `[Active pin — coordinates: ${analysisContext.latitude?.toFixed(6)}, ${analysisContext.longitude?.toFixed(6)}${analysisContext.location ? `, address: ${analysisContext.location}` : ""}${analysisContext.sceneType ? `, scene: ${analysisContext.sceneType}` : ""}${analysisContext.description ? `, description: ${analysisContext.description}` : ""}]`
		: "";
		
		// if we have coordinates we can check to see if the user wants information about services (restaurants, hotels, etc.)
		if (analysisContext?.latitude && analysisContext?.longitude) {
			const serviceRes = await fetch("http://localhost:8000/service-pins", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: content,
					latitude: analysisContext.latitude,
					longitude: analysisContext.longitude
				})
			});
			
			const serviceData = await serviceRes.json();
			
			if (serviceData.is_service_query && serviceData.pins?.length > 0) { // successfully got locations for requested services
				setServicePins(serviceData.pins);
				setAILoading(false);
				
				setAIMessages( (prev) => [...prev, {
					role: "ai",
					content: `I found ${serviceData.pins.length} ${serviceData.category}s nearby. I've dropped pins on the map for you. Tap any of them to see more details.`,
				}]);
				
				return; // exit function
			}
		} // we don't have coordinates or user did not ask about service locations, resort back to regular ai chat
		
		const res = await fetch("/api/ai-chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: AIContext + content,
				imageBase64: analysisContext?.imageBase64 ?? null,
			})
		});
		
		const data = await res.json();
		
		setAILoading(false);
		setAIMessages( (prev) => [...prev, { role: "ai", content: data.response }] );
	}
	
	async function sendMessage() {
		if (!input.trim() || !user) return;
		
		const content = input.trim();
		
		setInput("");
		
		await supabase.from("messages").insert({
		  user_id: user.id,
		  user_name: user.user_metadata.full_name,
		  user_avatar: user.user_metadata.avatar_url,
		  content
		});
	}
	
	// frontend lol neil got that ewwwwwwww
	return (
		<main className="flex flex-col h-screen bg-background">
		  <header className="flex items-center justify-between border-b px-5 py-3 shrink-0">
			<div className="flex items-center gap-2">
			  <img src="/miniLogo.svg" alt="Logo" className="w-4.2 h-6" />
			  <span className="text-lg font-semibold" style={{ color: "oklch(0.655 0.095 78.0)" }}>
				Pinnical
			  </span>
			</div>
			<div className="flex items-center gap-3">
			  <span className="text-sm text-muted-foreground hidden sm:block">
				{user?.user_metadata.full_name}
			  </span>
			  <Button variant="outline" size="sm" onClick={() => window.location.href = "/"}>Go back</Button>
			  <Button variant="outline" size="sm"
				onClick={() => supabase.auth.signOut().then(() => window.location.href = "/")}>
				Sign out
			  </Button>
			</div>
		  </header>

		  <div className="flex flex-1 overflow-hidden">
			<aside className="w-80 shrink-0 flex flex-col border-r bg-card overflow-hidden">
			  <div className="px-4 pt-4 pb-3 border-b">
				<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Group Chat</p>
				<p className="text-xs text-muted-foreground">Talk Below</p>
			  </div>
			  <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
				{messages.length === 0 && (
				  <p className="text-xs text-muted-foreground text-center mt-6">No messages yet. Say something!</p>
				)}
				{messages.map((msg) => (
				  <div key={msg.id} className="flex items-start gap-2.5">
					<Avatar className="w-7 h-7 shrink-0">
					  <AvatarFallback className="text-xs">{msg.user_name?.[0]}</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
					  <div className="flex items-baseline gap-2 mb-0.5">
						<span className="text-xs font-medium truncate">{msg.user_name}</span>
						<span className="text-[10px] text-muted-foreground shrink-0">
						  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
						</span>
					  </div>
					  <p className="text-xs leading-relaxed text-foreground/90 wrap-break-words">{msg.content}</p>
					</div>
				  </div>
				))}
				<div ref={groupBottomRef} />
			  </div>
			  <div className="border-t px-3 py-3 flex gap-2">
				<Input value={input} onChange={(e) => setInput(e.target.value)}
				  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
				  placeholder="Message the group..." className="flex-1 h-8 text-xs" />
				<Button size="sm" className="h-8 px-3 text-xs" onClick={sendMessage}>Send</Button>
			  </div>
			</aside>

			<div className="flex-1 min-w-0 relative overflow-hidden">
			  <MapPanel
				onAnalysisResult={handleAnalysisResult}
				servicePins={servicePins}
				onClearServicePins={() => setServicePins([])}
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

					const compressed = pin.image ? await compressImage(pin.image) : undefined;
					setAnalysisContext({
					  sceneType: pin.label ?? "",
					  culture: "",
					  historicalContext: "",
					  description: pin.analysis ?? "",
					  weather: "",
					  floraFauna: [],
					  confidence: 0,
					  location: pin.note ?? "",
					  latitude: pin.latitude,
					  longitude: pin.longitude,
					  imageBase64: compressed,
					});
				  } else {
					setAnalysisContext(null);
				  }
				}}
			  />
			</div>

			<section className="flex flex-col w-90 shrink-0 border-l overflow-hidden">
			  <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
				<div>
				  <p className="text-sm font-medium">AI Assistant</p>
				  <p className="text-xs text-muted-foreground">Private — not saved</p>
				</div>
				<Badge variant="secondary" className="text-xs">AI</Badge>
			  </div>

			  <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
				{AIMessages.length === 0 && (
				  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
					<p className="text-sm font-medium text-muted-foreground">Ask me anything</p>
					<p className="text-xs text-muted-foreground">Your conversation is private and not saved.</p>
				  </div>
				)}
				{AIMessages.map((msg, i) => (
				  <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
					<Avatar className="w-8 h-8 shrink-0">
					  <AvatarFallback className="text-xs">
						{msg.role === "ai" ? "AI" : user?.user_metadata.full_name?.[0]}
					  </AvatarFallback>
					</Avatar>
					<div className={`max-w-[70%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
					  <span className="text-xs text-muted-foreground">
						{msg.role === "ai" ? "AI Assistant" : "You"}
					  </span>
					  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
						msg.role === "user"
						  ? "bg-primary text-primary-foreground rounded-tr-sm"
						  : "bg-muted text-foreground rounded-tl-sm"
					  }`}>
						{msg.content}
					  </div>
					</div>
				  </div>
				))}
				{AILoading && (
				  <div className="flex items-start gap-3">
					<Avatar className="w-8 h-8 shrink-0">
					  <AvatarFallback className="text-xs">AI</AvatarFallback>
					</Avatar>
					<div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
					  <span className="text-sm text-muted-foreground animate-pulse">Thinking…</span>
					</div>
				  </div>
				)}
				<div ref={AIBottomRef} />
			  </div>

			  <div className="border-t px-5 py-4 flex gap-3 shrink-0">
				<Input value={AIInput} onChange={(e) => setAIInput(e.target.value)}
				  onKeyDown={(e) => e.key === "Enter" && sendAIMessage()}
				  placeholder="Ask the AI anything" className="flex-1" />
				<Button onClick={sendAIMessage}>Ask</Button>
			  </div>
			</section>
		  </div>
		</main>
	);
}