import {GoogleGenAI} from "@google/genai";
import {searchWeb} from "./web-search";

const ANY_URL_RE = /https?:\/\/\S+/gi

async function fetchImageAsBase64(url: string): Promise<{mimeType: string, data: string} | null> {
  try {
    const res = await fetch(url)
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return null
    const mimeType = res.headers.get("content-type")!.split(";")[0]
    const buffer = await res.arrayBuffer()
    const data = Buffer.from(buffer).toString("base64")
    return {mimeType, data}
  } catch {
    return null
  }
}

async function buildParts(content: string) {
  ANY_URL_RE.lastIndex = 0
  const urls = Array.from(content.matchAll(ANY_URL_RE), m => m[0])
  const text = content.replace(ANY_URL_RE, "").trim()

  const parts: any[] = []
  if (text) parts.push({text})

  for (const url of urls) {
    const image = await fetchImageAsBase64(url)
    if (image) {
      parts.push({inlineData: image})
    } else {
      // not an image — pass the URL as text so the model still sees it
      parts.push({text: url})
    }
  }

  return parts.length ? parts : [{text: content}]
}

// The client gets the API key from the environment variable.
const ai = new GoogleGenAI({apiKey: process.env.LLM_API_KEY});


interface HealthProfile {
  date_of_birth: Date | string | null
  sex: string | null
  weight_kg: number | null
  height_cm: number | null
  blood_type: string | null
  conditions: string
  medications: string
  allergies: string
}

function formatHealthProfile(p: HealthProfile): string {
  const lines: string[] = []

  if (p.date_of_birth) {
    const dob = new Date(p.date_of_birth)
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 86400000))
    lines.push(`- Age: ${age} (DOB: ${dob.toISOString().split("T")[0]})`)
  }
  if (p.sex)        lines.push(`- Sex: ${p.sex.replace(/_/g, " ")}`)
  if (p.weight_kg && p.height_cm) {
    const bmi = (p.weight_kg / Math.pow(p.height_cm / 100, 2)).toFixed(1)
    lines.push(`- Weight: ${p.weight_kg}kg | Height: ${p.height_cm}cm | BMI: ${bmi}`)
  } else if (p.weight_kg) {
    lines.push(`- Weight: ${p.weight_kg}kg`)
  } else if (p.height_cm) {
    lines.push(`- Height: ${p.height_cm}cm`)
  }
  if (p.blood_type && p.blood_type !== "unknown") lines.push(`- Blood type: ${p.blood_type}`)
  if (p.conditions?.trim())  lines.push(`- Known conditions: ${p.conditions.trim()}`)
  if (p.medications?.trim()) lines.push(`- Current medications: ${p.medications.trim()}`)
  if (p.allergies?.trim())   lines.push(`- Allergies: ${p.allergies.trim()}`)

  return lines.length
    ? `\n\n---\n**Patient health profile (use this to personalise every response):**\n${lines.join("\n")}\n---`
    : ""
}

export const askModel = async (contents: any, model: string, search = false, files: {mimeType: string, data: string}[], healthProfile?: HealthProfile | null) => {
  const profileSection = healthProfile ? formatHealthProfile(healthProfile) : ""
  const systemTurn = {
    role: "user",
    parts: [{text: "You are OpenCare, a knowledgeable medical assistant.\n\n**Default response style — be direct:**\nMost questions need a fast, clear answer. Lead with the answer immediately. No preamble, no filler. Think of it like a precise Google result — give the fact, value, or recommendation upfront.\n\n**Only go into detail when:**\n- The user uses words like \"explain\", \"why\", \"how does\", \"tell me more\", or asks a complex question that genuinely requires it.\n- In those cases, use headers, sections, and thorough explanations.\n\n**Formatting:**\n- Use **bold** for key terms and important values.\n- Use bullet points when listing 3+ items.\n- Use tables when comparing options or showing structured data.\n- Use ⚠️ for warnings, ✅ for confirmed facts, ❌ for contraindications.\n- Use `inline code` for dosages, lab values, and measurements (e.g. `500mg`, `120/80 mmHg`).\n- Use horizontal rules (---) to separate distinct sections in longer answers.\n- **Images:** This chat interface renders markdown images inline. Whenever you have an image URL (e.g. from web search results), you MUST embed it as `![description](url)` — never send raw URLs for images. Only use image URLs that come directly from web search results; never fabricate or guess URLs.\n\n**Medical rules:**\n- Never fabricate facts. If unsure, say so explicitly.\n- For emergencies, diagnoses, or prescriptions, briefly note to consult a professional — but do not repeat this on every message.\n- Do not mention being an AI unless directly asked and again don't go into detail but ask if more detail is desired." + profileSection}]
  }
  let searchTurn = null
  const rawMessage = contents[contents.length - 1].content
  const searchQuery = rawMessage.replace(/https?:\/\/\S+/gi, "").trim()
  if (searchQuery) {
    const searchContext = await searchWeb(searchQuery, search)
    if (searchContext) {
      searchTurn = {
        role: "user",
        parts: [{text: `Here is relevant information from the web to help answer the next question:\n\n${searchContext}`}]
      }
    }
  }

  const mappedContents = await Promise.all(contents.map(async (m: any, i: number) => {
    const parts = await buildParts(m.content)
    if (i === contents.length - 1 && files.length > 0) {
      parts.push(...files.map(f => ({inlineData: f})))
    }

    return {
      role: m.role,
      parts: parts
    }
  }))

  return await ai.models.generateContentStream({
    model: model,
    contents: [systemTurn, ...(searchTurn ? [searchTurn] : []), ...mappedContents],
  });
}

export const generateConversationTitle = async (contents: any) => {
  const systemTurn = {
    role: "user",
    parts: [{text: "Your are tasked to extract a meaning of the prompted message and make a title that summarizes the potential topic the conversation is going to take place. Only respond with a title. The title should be maximum of 8 words."}]
  };

  return await ai.models.generateContent({
    model: "gemma-4-31b-it",
    contents: [systemTurn, ...contents.map((m: any) => ({
      role: m.role,
      parts: [
        {text: m.content},
      ]
    }))],
  });

}
