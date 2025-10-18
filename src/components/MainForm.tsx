"use client";

import { useState } from "react";
import OpenAI from "openai";

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
      const chat = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a presentation assistant. When given a one-line topic, produce concise, vivid image prompts for each slide idea.",
          },
          { role: "user", content: topic },
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
      <h1 className="text-2xl font-bold mb-4">AI Slide Prompt Generator</h1>

      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder='e.g. "create 6 slides about global warming"'
        className="w-full border p-3 rounded-md mb-4"
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
          <h2 className="text-lg font-semibold">Generated Slide Prompts</h2>
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
