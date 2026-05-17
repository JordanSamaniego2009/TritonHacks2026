export async function POST(req: Request) {
  const { message, image_base64 } = await req.json();

  const userContent = image_base64
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: image_base64 } }, // already has data: prefix
      ]
    : message;

  // forward to your Python backend or call model directly
  const res = await fetch("http://localhost:8000/ai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, image_base64 }),
  });

  return Response.json(await res.json());
}