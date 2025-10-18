"use client";

import { useState } from "react";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { generateImages } from "./image_jobs";
import { pollManyJobsUntilComplete } from "./poll_result";
import Transition from "./Transition";
import { splitAndUpload } from "~/helpers/splitAndUpload";

const SlidePromptsSchema = z.object({
  prompts: z.array(z.string()),
});

const DEFAULT_STYLE =
  "clean corporate flat infographic dashboard style, soft neutral/pastel palette (sand, sage, slate), modern sans-serif typography, subtle gradients, high whitespace";

const GPT_PROMPT_ENHANCE = `
You are a visual storyteller and presentation director. Your task is to generate a JSON object containing short descriptions of slides for AI image generation using Seedream 4.0.

The user provides:

Topic of the presentation

Number of slides

(Optional) Description — a combined text that may include both the content of the presentation and visual preferences (style, mood, atmosphere, colors, composition, etc.)

Generation Rules:

Each slide must be self-contained (stateless), but all slides together should form a coherent narrative that logically develops the topic.

Use as much of the user’s description as possible — especially the semantic (content) part.

If the user includes visual preferences (for example, style, lighting, emotions, or colors), apply them consistently across all slides.

Each slide should be written as a single concise line, focusing on visual elements that Seedream can interpret.

Include clear visual parameters when possible: lighting (e.g., "warm soft lighting", "cinematic sunset light"), style (e.g., "photorealistic", "3D render", "oil painting"), mood (e.g., "hopeful atmosphere", "dramatic tone"), composition (e.g., "wide shot", "close-up", "aerial view").

Do not use references between slides (such as "next", "previous", or "later").

The output must be a valid JSON object with the key "slides".

Output Format:
{
"slides": [
"Description of the first slide (self-contained visual scene related to the topic).",
"Description of the second slide (new scene that continues the story but stands on its own).",
"Description of the third slide (independent yet logically connected)."
]
}

User Input Format:
Topic: <topic of the presentation>
Number of slides: <number>
Description (optional): <combined text including both presentation content and visual preferences>

Priorities:

Use the user’s description as literally as possible, keeping their original wording whenever feasible.

Apply visual preferences uniformly across all scenes.

Each slide must be visually complete and independently understandable.

Output only the JSON — no explanations, no comments.

Recommendations for Seedream 4.0:

Use vivid visual keywords such as "cinematic", "highly detailed", "8K photorealistic", "depth of field", "soft focus", "dynamic composition".

If the user doesn’t specify a style, default to "cinematic photorealism with soft natural light and depth of field".

Seedream 4.0 performs best with concrete objects, actions, and lighting — avoid abstract descriptions.
`;

function getOutputText(res: any): string {
    // modern SDK exposes .output_text; fallback to digging if needed
    return (res as any).output_text
      ?? (res?.output?.map((o: any) =>
           o?.content?.map((c: any) => c?.text?.value).filter(Boolean).join("\n")
         ).join("\n"))
      ?? "";
  }

export default function SlidePromptGenerator() {
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("");
  const [count, setCount] = useState(6);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  // ⬇️ NEW: optional PDF file, only used if present
  const [pdfFile, setPdfFile] = useState<File | null>(null); // optional
  
  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
    dangerouslyAllowBrowser: true,
  });

async function generatePrompts() {
  if (!topic.trim()) return;
  setLoading(true);
  setPrompts([]);

      const userMsg =
      `Topic: ${topic.trim()}\n` +
      (style.trim() ? `Style: ${style.trim()}\n` : "Description: (default)\n") +
      `Number of slides: ${count}`;

try {
  let slides: string[] = [];

  if (pdfFile) {
    // Upload + run Responses API
    const uploaded = await openai.files.create({
      file: pdfFile,
      purpose: "assistants",
    });

    const res = await openai.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      input: [
        { role: "system", content: [{ type: "input_text", text: GPT_PROMPT_ENHANCE }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: userMsg },
            { type: "input_file", file_id: uploaded.id },
          ],
        },
      ],
    });

    // Normalize text output
    const rawText =
      getOutputText(res)?.trim() ||
      res.output?.[0]?.content?.[0]?.text?.trim() ||
      "";

    // Try parsing JSON array
    try {
      slides = JSON.parse(rawText);
    } catch {
      // fallback: extract from ["..."] style
      const maybeArr = rawText.match(/\[(.|\n)*\]/);
      slides = maybeArr ? JSON.parse(maybeArr[0]) : [];
    }

    setPrompts(slides);
  } else {
    // Text-only Zod flow
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: GPT_PROMPT_ENHANCE },
        { role: "user", content: userMsg },
      ],
      response_format: zodResponseFormat(SlidePromptsSchema, "slide_prompts"),
    });

    const result = JSON.parse(completion.choices[0].message?.content || "{}");
    console.log("Zod parsed result:", result);
    slides = result.prompts || [];
    setPrompts(slides);
  }

  if (slides.length > 0) {
    const jobList = await generateImages(slides);
    const urls = await pollManyJobsUntilComplete(jobList);
    setImageUrls(urls);
  }
} catch (err: any) {
  console.error(err);
  setError(err.message ?? "Prompt generation failed.");
} finally {
  setLoading(false);
}

}

  return (
    <div className="max-w-2xl mx-auto mt-12 p-6 border rounded-lg bg-white shadow-sm">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">AI Slide Prompt Generator</h1>

      <div className="space-y-3">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder='e.g. "create 6 slides about global warming"'
          className="w-full border p-3 rounded-md text-black"
        />

        <input
          type="text"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder='Optional style, e.g. "isometric 3D corporate", or leave blank'
          className="w-full border p-3 rounded-md text-black"
        />

        <div className="flex items-center gap-3">
          <label className="text-gray-700">Slides:</label>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value || "6", 10))}
            className="w-24 border p-2 rounded-md text-black"
          />
        </div>
        {/* ⬇️ NEW: totally optional PDF picker, nothing else changes */}
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          className="w-full border p-2 rounded-md text-black"
        />

        <button
          onClick={generatePrompts}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate Prompts"}
        </button>
      </div>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {prompts.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-700">Generated Slide Prompts</h2>
          <ul className="list-disc list-inside text-gray-800">
            {prompts.map((p, i) => (
              <li key={i} className="whitespace-pre-wrap">
                <strong>Slide {i + 1}:</strong> {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Transition imageUrls={imageUrls} />
    </div>
  );
}

