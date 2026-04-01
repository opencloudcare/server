import { GoogleGenAI } from "@google/genai";

// The client gets the API key from the environment variable.
const ai = new GoogleGenAI({apiKey: process.env.LLM_API_KEY});


export const askModel = async (contents:any) => {
  return await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: "You are a medical assistant"
    },
    contents: contents.map((m:any) => ({
      role: m.role,
      parts: [{text: m.content}]
    })),
  });
}
