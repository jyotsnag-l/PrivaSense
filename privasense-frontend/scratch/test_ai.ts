import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });

async function test() {
  try {
    const modelToTry = "gemini-2.5-flash"; 
    console.log(`Trying model: ${modelToTry} with responseSchema`);
    
    const response = await ai.models.generateContent({
      model: modelToTry,
      contents: "Return a JSON object with a field 'greeting' saying hello.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            greeting: { type: Type.STRING }
          },
          required: ["greeting"]
        }
      }
    });
    console.log("Response Text:", response.text);
  } catch (e) {
    console.error("Test failed:", e);
  }
}

test();
