"use client";

import { useState } from "react";
import OpenAI from "openai";

const GPT_PROMPT_ENHANCE = `
You are a senior prompt engineer for presentation decks.

Goal:
Turn a vague topic into a numbered JSON array of COMPLETE, SELF-CONTAINED image-generation prompts for a model with NO MEMORY.

NON-NEGOTIABLE RULES FOR EVERY SLIDE PROMPT
1) Restate full visual context each time:
   - "PowerPoint slide background in <style>, 16:9 landscape"
   - If no user style: "clean corporate flat infographic dashboard style, soft neutral/pastel palette (sand, sage, slate), modern sans-serif typography"
2) Include exact TEXT STRINGS to render (titles, axis labels, captions, legend labels). Keep them concise and readable.
3) Spatial contract (must be explicit):
   - For EVERY element, state location using anchors (top-left, top-right, center-left, bottom strip, etc.)
   - For charts: give chart type, axes labels, tick direction, legend position, color mapping, and data bins or values.
   - For maps: specify projection (simplified flat world), target regions, exact color bins and thresholds, legend contents/position, and where not to color.
   - For grids/splits: define panel sizes or ratios and which side holds what.
4) Provide concrete values (plausible samples) for charts/maps; keep units consistent.
5) Always append: "Draw all listed text EXACTLY as written."
6) Output MUST be a valid JSON array of strings (each string is one complete slide prompt). No extra keys or commentary.
`;


export default function SlidePromptGenerator() {
  const [topic, setTopic] = useState("");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
    dangerouslyAllowBrowser: true, // because we’re calling from client side
  });

async function generatePrompts() {
  if (!topic.trim()) return;
  setLoading(true);
  setPrompts([]);

  try {
    // STEP 1: Enhance the user's vague request
    const enhance = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: GPT_PROMPT_ENHANCE },
        { role: "user", content: topic },
      ],
    });

    const enhanced = enhance.choices[0].message?.content || "";

    // STEP 2: Generate final per-slide image prompts using the enhanced context
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a slide-image prompt generator. Based on the enhanced description below, return ONLY a numbered list of short, vivid, presentation-friendly image prompts — one per slide. No titles or explanations.",
        },
        { role: "user", content: enhanced },
      ],
    });

    const text = chat.choices[0].message?.content || "";
    const slides = text
      .split(/\n+/)
      .map((line) => line.replace(/^\d+\.?\s*/, "").trim())
      .filter(Boolean);

    setPrompts(slides);
  } catch (err) {
    console.error("Error generating prompts:", err);
  } finally {
    setLoading(false);
  }
}


  return (
    <div className="max-w-2xl mx-auto mt-12 p-6 border rounded-lg bg-white shadow-sm">
      <h1 className="text-2xl font-bold mb-4 text-gray-400">AI Slide Prompt Generator</h1>

      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder='e.g. "create 6 slides about global warming"'
        className="w-full border p-3 rounded-md mb-4 text-black "
      />

      <button
        onClick={generatePrompts}
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate Prompts"}
      </button>

      {prompts.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-400">Generated Slide Prompts</h2>
          <ul className="list-disc list-inside text-gray-800">
            {prompts.map((p, i) => (
              <li key={i}>
                <strong>Slide {i + 1}:</strong> {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
