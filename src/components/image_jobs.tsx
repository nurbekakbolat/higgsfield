export interface HiggsfieldResponse {
  id: string;
  type: string;
  created_at: string;
  jobs: Array<{
    id: string;
    job_set_type: string;
    status: string;
    results: any;
  }>;
  input_params: {
    prompt: string;
    input_images: string[];
    quality: string;
    aspect_ratio: string;
  };
}

export async function generateImages(prompts: string[]): Promise<string[]> {
  const jobs_list: string[] = [];

  const requests = prompts.map((prompt) =>
    fetch("https://platform.higgsfield.ai/v1/text2image/seedream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "hf-api-key": process.env.NEXT_PUBLIC_HF_API_KEY as string,
        "hf-secret": process.env.NEXT_PUBLIC_HF_API_SECRET as string,
      },
      body: JSON.stringify({
        params: {
          prompt,
          quality: "basic",
          aspect_ratio: "16:9",
          input_images: [],
        },
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data: HiggsfieldResponse = await res.json();
        return data.id;
      })
      .catch((err) => {
        console.error(`Error generating for prompt "${prompt}":`, err);
        return null;
      })
  );

  const results = await Promise.all(requests);

  for (const id of results) {
    if (id) jobs_list.push(id);
  }

  return jobs_list;
}
