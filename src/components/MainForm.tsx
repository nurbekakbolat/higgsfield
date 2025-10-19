"use client";

import { useState } from "react";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { generateImages } from "./image_jobs";
import { pollManyJobsUntilComplete } from "./PollingHelpers";
import Transition from "./Transition";
import { splitAndUpload } from "~/helpers/splitAndUpload";
import type { ChatCompletion } from "openai/resources";
import { buildGptPresPrompt, SlidePromptsSchema } from "~/config";
import { GenerationParamsInput } from "./GenerationParamsInput";
import { ImageEditModal } from "./ImageEditModal";
import Image from "next/image";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
  dangerouslyAllowBrowser: true,
});

export const DEFAULT_STYLE =
  "clean corporate flat infographic dashboard style, soft neutral/pastel palette (sand, sage, slate), modern sans-serif typography, subtle gradients, high whitespace";

export const buildGptPrompt = (userStyle?: string) => `
You are an expert cinematic storyteller and visual director designing a SEQUENCE of consistent, emotionally coherent scenes for a short AI-generated film.

Each prompt represents ONE frame — a full cinematic image — to be rendered independently by Seedream 4.0 (which has no memory).  
Therefore, every prompt must REPEAT the global visual style, environment, and lighting setup to maintain continuity.

OUTPUT FORMAT:
Return ONLY a valid JSON array of strings.
Each string is a single complete cinematic prompt describing one scene.

OBJECTIVE:
Generate ${"${count}"} sequential cinematic frames that visually tell a short narrative around the user's topic.

GLOBAL STYLE (to be repeated in every frame):
${
  userStyle
    ? `Use the user's style exactly: "${userStyle}". Integrate it naturally into every scene description.`
    : `Default to cinematic realism: soft atmospheric lighting, film-grade depth, pastel palette (sand, slate, sage, cream), subtle gradients, realistic reflections, and shallow depth of field.`
}
All frames must share the same tone, palette, and environment evolution.
Lighting continuity (e.g., dawn → noon → dusk) should progress smoothly if the story allows.

CAMERA & COMPOSITION:
- 16:9 landscape ratio.
- Use cinematic shot types: establishing shot, medium, close-up, dolly, tilt, pan, or aerial.
- Include natural motion cues and lens realism (bokeh, glare, reflections, dust, fog).

NARRATIVE RULES:
1. Each frame represents a visual beat in the same world — no abrupt changes of characters or style.
2. Use consistent subject matter and environment details.
3. Focus on emotional storytelling through light, framing, and motion — not text or narration.
4. Avoid diagrams, text, or symbolic icons unless explicitly requested by the user.

MOOD & EMOTION:
Keep cinematic pacing and tone progression (calm → tension → resolution or similar).
Describe subtle emotional cues via environment (light shifts, color tone, atmosphere).

END EVERY FRAME PROMPT WITH:
"same cinematic style, consistent color palette, realistic atmosphere, 16:9 aspect ratio."

EXAMPLE OUTPUT:
[
  "Wide establishing shot of a lone traveler walking through misty mountains under golden dawn light, ${
    userStyle || "cinematic realism, pastel tones, soft haze, 16:9"
  }",
  "Medium shot of the traveler stopping at a broken bridge, wind moving the trees, ${
    userStyle || "cinematic realism, pastel tones, soft haze, 16:9"
  }",
  "Close-up of the traveler's face reflecting hope as the clouds part, ${
    userStyle || "cinematic realism, pastel tones, soft haze, 16:9"
  }"
]
`;

export default function SlidePromptGenerator() {
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("");
  const [count, setCount] = useState(6);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [genState, setGenState] = useState<
    "promptGen" | "imagesGen" | "resultGen" | "resultReady" | "idle"
  >("idle");
  const [useDefaultStoryline, setUseDefaultStoryline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [skipGeneration, setSkipGeneration] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [regenLoadingMap, setRegenLoadingMap] = useState<
    Record<number, boolean>
  >({});

  async function generatePrompts() {
    if (!topic.trim() && !pdfFile) return;
    setLoading(true);
    setPrompts([]);
    setGenState("promptGen");

    if (skipGeneration && pdfFile) {
      const urls = await splitAndUpload(pdfFile);
      setImageUrls(urls);
      console.log("urls", urls);
      setGenState("resultReady");
      setPrompts([]); // skip GPT
      setLoading(false);
      return;
    }

    const userMsg =
      `Topic: ${topic.trim()}\n` +
      (style.trim() ? `Style: ${style.trim()}\n` : "Style: (default)\n") +
      `Frame count: ${count}`;

    const selectedPrompt = useDefaultStoryline
      ? buildGptPrompt(style.trim())
      : buildGptPresPrompt(style.trim());

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
            {
              role: "system",
              content: [{ type: "input_text", text: selectedPrompt }],
            },
            {
              role: "user",
              content: [
                { type: "input_text", text: userMsg },
                { type: "input_file", file_id: uploaded.id },
              ],
            },
          ],
        });

        // simplest fallback extraction:
        const text =
          res.output_text ??
          (Array.isArray(res.output)
            ? res.output
                .flatMap(
                  (o) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (o as any).content?.map((c: any) => c.text?.value ?? "") ??
                    []
                )
                .join("\n")
            : "");

        try {
          slides = JSON.parse(text);
        } catch {
          const maybeArr = text.match(/\[(.|\n)*\]/);
          slides = maybeArr ? JSON.parse(maybeArr[0]) : [];
        }
      } else {
        // Text-only Zod flow
        const completion: ChatCompletion = await openai.chat.completions.create(
          {
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: selectedPrompt },
              { role: "user", content: userMsg },
            ],
            response_format: zodResponseFormat(
              SlidePromptsSchema,
              "slide_prompts"
            ),
          }
        );

        const result = JSON.parse(
          completion.choices[0].message?.content || "{}"
        );
        slides = result.prompts || [];
        setPrompts(slides);
      }

      if (slides.length > 0) {
        setGenState("imagesGen");
        const jobList = await generateImages(slides);
        const urls = await pollManyJobsUntilComplete(jobList);
        setImageUrls(urls);
        setGenState("resultReady");
      }
    } catch (err) {
      console.error(err);
      setError("Prompt generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!editPrompt.trim() || editingIndex === null) return;

    setRegenLoadingMap((prev) => ({ ...prev, [editingIndex]: true }));

    try {
      const res = await fetch(
        "https://platform.higgsfield.ai/v1/text2image/seedream",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "hf-api-key": process.env.NEXT_PUBLIC_HF_API_KEY as string,
            "hf-secret": process.env.NEXT_PUBLIC_HF_API_SECRET as string,
          },
          body: JSON.stringify({
            params: {
              prompt: editPrompt,
              quality: "basic",
              aspect_ratio: "16:9",
              input_images: [],
            },
          }),
        }
      );
      if (!res.ok) throw new Error(`Regeneration failed: ${res.status}`);
      const data = await res.json();

      const jobId = data.id;
      const poll = async () => {
        const r = await fetch(
          `https://platform.higgsfield.ai/v1/job-sets/${jobId}`,
          {
            headers: {
              "hf-api-key": process.env.NEXT_PUBLIC_HF_API_KEY as string,
              "hf-secret": process.env.NEXT_PUBLIC_HF_API_SECRET as string,
            },
          }
        );
        const j = await r.json();
        const url = j?.jobs?.[0]?.results?.raw?.url;
        if (url) {
          setImageUrls((prev) => {
            const copy = [...prev];
            copy[editingIndex] = url;
            return copy;
          });
          setEditingIndex(null);
          setRegenLoadingMap((prev) => ({ ...prev, [editingIndex]: false }));
        } else {
          setTimeout(poll, 2000);
        }
      };
      poll();
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      setRegenLoadingMap((prev) => ({ ...prev, [editingIndex!]: false }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-6 border rounded-lg bg-white shadow-sm">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        AI Story Line Generator
      </h1>

      <div className="flex items-center justify-between mb-4">
        <label className="text-gray-800 font-medium">
          Use default cinematic storyline
        </label>
        <input
          type="checkbox"
          checked={useDefaultStoryline}
          onChange={(e) => setUseDefaultStoryline(e.target.checked)}
          className="w-5 h-5 cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <label className="text-gray-800 font-medium">
          Upload & Animate (skip AI generation)
        </label>
        <input
          type="checkbox"
          checked={skipGeneration}
          onChange={(e) => setSkipGeneration(e.target.checked)}
          className="w-5 h-5 cursor-pointer"
        />
      </div>

      <div className="space-y-3">
        {!skipGeneration && (
          <GenerationParamsInput
            topic={topic}
            setTopic={setTopic}
            style={style}
            setStyle={setStyle}
            count={count}
            setCount={setCount}
          />
        )}
        <input
          type="file"
          accept=".pdf,.pptx"
          onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          className="w-full border p-2 rounded-md text-black"
        />
        <button
          onClick={generatePrompts}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-60"
        >
          {loading
            ? "Processing..."
            : skipGeneration
            ? "Upload & Animate"
            : "Generate video"}
        </button>
      </div>
      {imageUrls.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Generated Frames
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative group">
                <Image
                  height={100}
                  src={url}
                  width={100}
                  alt={`Frame ${i + 1}`}
                  className={`rounded-md border shadow-sm w-full transition-opacity ${
                    regenLoadingMap[i] ? "opacity-60" : ""
                  }`}
                />
                {/* Spinner overlay */}
                {regenLoadingMap[i] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-md">
                    <div className="h-6 w-6 border-2 border-gray-400 border-t-black rounded-full animate-spin"></div>
                  </div>
                )}
                <button
                  onClick={() => {
                    setEditPrompt(prompts[i] ?? "");
                    setEditingIndex(i);
                    setIsModalOpen(true);
                  }}
                  disabled={!!regenLoadingMap[i]}
                  className="absolute bottom-2 right-2 bg-black text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition disabled:opacity-40"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <ImageEditModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        editPrompt={editPrompt}
        setEditPrompt={setEditPrompt}
        handleRegenerate={handleRegenerate}
        regenLoading={editingIndex !== null && !!regenLoadingMap[editingIndex]}
      />
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {genState === "resultReady" &&
        imageUrls.length > 0 &&
        Object.values(regenLoadingMap).every((v) => !v) && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Generated Videos
            </h2>
            <Transition imageUrls={imageUrls} />
          </div>
        )}
    </div>
  );
}
