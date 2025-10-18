import { z } from "zod";


export const SlidePromptsSchema = z.object({
  prompts: z.array(z.string()),
});

export const DEFAULT_STYLE =
  "clean corporate flat infographic dashboard style, soft neutral/pastel palette (sand, sage, slate), modern sans-serif typography, subtle gradients, high whitespace";

export const GPT_PROMPT_ENHANCE = `
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