export async function POST(req: Request) {
  const { message, imageBase64 } = await req.json();

  const res = await fetch("http://localhost:8000/ai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, imageBase64 }),
  });

  return Response.json(await res.json());
}