export const buildHgPrompt = (userPrompt?: string) => `
Ultra-smooth cinematic transition in 16:9 landscape. 
Start with Frame A, end with Frame B. 
Theme: ${userPrompt || "modern data storytelling, abstract motion graphics"}.

Camera movement: dynamic dolly-in blended with a soft parallax sweep and light depth-of-field pull. 
Motion style: elegant kinetic flow, reminiscent of professional motion design reels (Figma or Apple-style transitions). 
Use gentle particle drift, environmental lighting change, or geometric morph to bridge the two frames seamlessly.

Typography: absolutely stable and sharp. 
No warping, melting, stretching, or blur of text. 
Text remains perfectly crisp and readable during motion. 
Keep layout and font proportions consistent between frames.

Visual style: minimalist cinematic design, soft pastel color palette (sand, sage, slate, cream), subtle gradients, realistic reflections, high contrast lighting. 
Add motion cues like lens flare glints, micro camera shake, or dust particles if appropriate.

Duration: 6 seconds. 
Resolution: 1080p. 
Constraint: preserve both input images’ composition and content integrity. 
Draw all listed text EXACTLY as written.
`;
