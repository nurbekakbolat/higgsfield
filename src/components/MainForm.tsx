"use client";

import { useState } from "react";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { generateImages } from "./image_jobs";
import { pollManyJobsUntilComplete } from "./PollingHelpers";
import Transition from "./Transition";
import { splitAndUpload } from "~/helpers/splitAndUpload";
import type { ChatCompletion } from "openai/resources";
import { GPT_PROMPT_ENHANCE, SlidePromptsSchema } from "~/config";
import { GenerationParamsInput } from "./GenerationParamsInput";

export default function SlidePromptGenerator() {
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("");
  const [count, setCount] = useState(6);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [skipGeneration, setSkipGeneration] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
    dangerouslyAllowBrowser: true,
  });

  async function generatePrompts() {
    if (!topic.trim() && !pdfFile) return;
    setLoading(true);
    setPrompts([]);

    if (skipGeneration && pdfFile) {
      const urls = await splitAndUpload(pdfFile);
      setImageUrls(urls);
      setPrompts([]); // skip GPT
      setLoading(false);
      return;
    }

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
            {
              role: "system",
              content: [{ type: "input_text", text: GPT_PROMPT_ENHANCE }],
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

        let slides: string[] = [];
        try {
          slides = JSON.parse(text);
        } catch {
          const maybeArr = text.match(/\[(.|\n)*\]/);
          slides = maybeArr ? JSON.parse(maybeArr[0]) : [];
        }

        setPrompts(slides);
      } else {
        // Text-only Zod flow
        const completion: ChatCompletion = await openai.chat.completions.create(
          {
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: GPT_PROMPT_ENHANCE },
              { role: "user", content: topic },
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
        const jobList = await generateImages(slides);
        const urls = await pollManyJobsUntilComplete(jobList);
        setImageUrls(urls);
      }
    } catch (err) {
      console.error(err);
      setError("Prompt generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-6 border rounded-lg bg-white shadow-sm">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        AI Slide Prompt Generator
      </h1>

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
            : "Generate Prompts"}
        </button>
      </div>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {prompts.length > 0 && !skipGeneration && (
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-700">
            Generated Slide Prompts
          </h2>
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
