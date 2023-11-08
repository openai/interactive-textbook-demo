import { OpenAIStream, StreamingTextResponse } from "ai";
import OpenAI from "openai";

export async function POST(request: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const req = await request.json();

  const { language, text } = req;
  
  const prompt = `Translate the following text into ${language}:`
  
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: `${prompt}\n${text}` }],
    model: "gpt-4",
    stream: true,
  });

  const stream = OpenAIStream(chatCompletion);
  return new StreamingTextResponse(stream);
}
