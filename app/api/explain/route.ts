import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from 'ai'

export async function POST(request: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const req = await request.json();
  
  const prompt = (() => {
    switch (req.action) {
      case "eli5":
        return "Explain this to me like I'm five:";
      case "summary":
        return "Create a very short and concise summary of the following text:";
      case "poem":
        return "Make a short poem with proper formatting summarizing the following text:";
    }
  })();
  
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: `${prompt}\n${req.text}` }],
    model: "gpt-4",
    stream: true,
  });

  const stream = OpenAIStream(chatCompletion);

  return new StreamingTextResponse(stream);
}
