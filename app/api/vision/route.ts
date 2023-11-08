import { OpenAIStream, StreamingTextResponse } from "ai";
import OpenAI from "openai";

export async function POST(request: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const { image64 } = await request.json();
  
  const chatCompletion = await openai.chat.completions.create({
    messages: [{
      role: "user",
      // @ts-ignore
      content: [
        "Describe this image for me.",
        { image: image64, resize: 768 }
      ],
    }],
    model: "gpt-4-vision-preview",
    stream: true,
    max_tokens: 500,
  });

  const stream = OpenAIStream(chatCompletion);
  return new StreamingTextResponse(stream);
}
