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
You are producing COMPLETE Seedream 4.0 image prompts for slides. The image model has ZERO MEMORY.

OUTPUT: return ONLY a valid JSON array of strings; each string is one full prompt. No prose, no keys.

ABSOLUTE RULES FOR EVERY SLIDE
1) Start with: "PowerPoint slide background in <STYLE>, 16:9 landscape".
   - If the user didn't specify, use: "${DEFAULT_STYLE}".
   - Repeat the SAME style in every slide.

2) Include ALL TEXT to render (titles, axis labelsnpm i pdfjs-dist, legend keys, captions) and ALL DATA.
   - Use concise English unless user specifies another language.
   - Use numerals (never spell out numbers); one decimal max where relevant.
   - If a range of years is referenced, provide a contiguous year:value list for EVERY year.
   - No placeholders like "...", "etc", "N/A". No invented “model knowledge” beyond the dataset you output.

3) Spatial contract: explicitly place everything with anchors and sizes/ratios.
   - Examples: "TITLE top-left:", "legend bottom-right:", "left panel 60% width:", "right panel 40% width:", "empty right gutter for bullets".
   - For charts: chart type, axes labels, tick labels, legend position, color mapping, and explicit DATA values.
   - For maps: projection = "simplified flat world"; define which regions get which color bins; include a legend and its position.

4) Consistency & tone: professional presentation; avoid animals/people unless requested.

5) End every slide with: "Draw all listed text EXACTLY as written."

6) Respect requested slide count (default 6).

FORMAT INSIDE EACH PROMPT (use these section tags verbatim):
STYLE:
TITLE:
LAYOUT:
CHART/MAP/GRID:
DATA:
AXES:
LEGEND:
COLORS:
CAPTION:
CONSTRAINTS: Draw all listed text EXACTLY as written.
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
      (style.trim() ? `Style: ${style.trim()}\n` : "Style: (default)\n") +
      `Slide count: ${count}`;

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
        { role: "user", content: topic },
      ],
      response_format: zodResponseFormat(SlidePromptsSchema, "slide_prompts"),
    });

    const result = JSON.parse(completion.choices[0].message?.content || "{}");
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

