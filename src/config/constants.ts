import { z } from "zod";

export const SlidePromptsSchema = z.object({
  prompts: z.array(z.string()),
});

export const DEFAULT_STYLE =
  "clean corporate flat infographic dashboard style, soft neutral/pastel palette (sand, sage, slate), modern sans-serif typography, subtle gradients, high whitespace";

export const buildGptPresPrompt = (userStyle?: string) => `
You are producing COMPLETE Seedream 4.0 image prompts for slides. The image model has ZERO MEMORY.

OUTPUT: return ONLY a valid JSON array of strings; each string is one full prompt. No prose, no keys.





ABSOLUTE RULES FOR EVERY SLIDE


1) Start with: "PowerPoint slide background in <STYLE>, 16:9 landscape".


   ${!userStyle ? `- If the user didn't specify, use: "${DEFAULT_STYLE}".` : ""}


   - Repeat the SAME style in every slide.





2) Include ALL TEXT to render and ALL DATA.


   - Capture everything the viewer should read or understand: titles, subtitles, labels, legends, and captions.


   - Express information in clear, concise English unless another language is requested.


   - Always use numerals for numbers (e.g., 7.5, not “seven point five”).


   - If a period or range is mentioned, include complete data for each point in time.


   - Do not invent information; only use facts or data explicitly present in the source.





3) Slide composition and focus.


  - Describe the main message or insight each slide conveys.


  - Identify the key visual or comparison that supports that message (chart, map, photo, list, etc.).


  - Specify how text and visuals relate — e.g., what the chart explains, what the caption clarifies.


  - Keep structure simple and readable: one clear idea per slide, supported by evidence or data.


  - Prioritize clarity, relevance, and story flow over decorative layout details.





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

export const HIGGSFIELD_BASE = "https://platform.higgsfield.ai/v1";
export const HG_PROMPT = `Ultra-smooth cinematic transition in 16:9 landscape. Start with Frame A, end with Frame B. Camera movement: slow dolly-in then gentle arc around the scene, subtle film-look tracking shot. Preserve all static slide text exactly, no distortion, fuzz or blur of typography. Typography remains sharp and readable throughout. Visual style: clean corporate infographic, pastel palette (sand, sage, slate), modern sans-serif typography. Motion duration: 6 s, resolution: 1080p. Draw all listed text EXACTLY as written.`;
