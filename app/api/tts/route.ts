export async function POST(request: Request) {
  const req = await request.json();
  
  const { text } = req;
  
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: "alloy",
    }),
  });

  return new Response(response.body, { headers: { 'content-type': 'audio/mp3' } });
}
