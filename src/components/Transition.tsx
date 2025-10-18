"use client";

import { useState } from "react";

type JobStatus = "queued" | "processing" | "completed" | "failed" | "error";

interface Pair {
  start: string;
  end: string;
}

interface JobItem {
  id: string;            // job-set id
  pair: Pair;            // which images this job is for
  status: JobStatus;
  url?: string;          // final video url
  error?: string;
}

const HIGGSFIELD_BASE = "https://platform.higgsfield.ai/v1";

export default function Transition() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [running, setRunning] = useState(false);

  const imageUrls = [
    "https://d3u0tzju9qaucj.cloudfront.net/435946d1-10e6-491d-8814-f9e49f701651/b510c959-56a4-4e79-98a8-e6c5bdc47c7b_min.webp",
    "https://d3u0tzju9qaucj.cloudfront.net/435946d1-10e6-491d-8814-f9e49f701651/d23ee66b-ef11-45ad-a38e-484c47728a4e_min.webp",
    "https://d3snorpfx4xhv8.cloudfront.net/d5245104-ba57-4942-a7d9-d53936d25c09/8e914a5f-7f0d-4be6-9a94-d0dd9c000008.jpeg",
    "https://d3snorpfx4xhv8.cloudfront.net/d5245104-ba57-4942-a7d9-d53936d25c09/0ac85a6d-1f3e-44cd-a0c4-f5d66bd212e5.png",
  ];

  const headers = {
    "Content-Type": "application/json",
    "hf-api-key": process.env.NEXT_PUBLIC_HIGGSFIELD_KEY!,
    "hf-secret": process.env.NEXT_PUBLIC_HIGGSFIELD_SECRET!,
  };

  const buildPairs = (urls: string[]): Pair[] => {
    const out: Pair[] = [];
    for (let i = 0; i < urls.length - 1; i++) out.push({ start: urls[i], end: urls[i + 1] });
    return out;
  };

  const submitPair = async (pair: Pair) => {
    const res = await fetch(`${HIGGSFIELD_BASE}/image2video/minimax`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        params: {
          prompt: "generate smooth transition",
          duration: 6,
          resolution: "768",
          input_image: { type: "image_url", image_url: pair.start },
          input_image_end: { type: "image_url", image_url: pair.end },
          enhance_prompt: true,
        },
      }),
    });

    if (!res.ok) throw new Error(`submitPair HTTP ${res.status}`);
    const data = await res.json();

    const jobSetId: string | undefined = data?.id;
    const initialStatus: JobStatus | undefined = data?.jobs?.[0]?.status;

    if (!jobSetId) throw new Error("No job-set id in response");

    return { jobSetId, initialStatus: initialStatus ?? "queued" };
  };

  // Poll up to 20 minutes (1_200_000 ms), every 3 seconds
  const pollUntilDone = async (jobSetId: string, stepMs = 3000, maxMs = 1_200_000) => {
    const started = Date.now();

    const fetchStatus = async () => {
      const res = await fetch(`${HIGGSFIELD_BASE}/job-sets/${jobSetId}`, { headers });
      if (!res.ok) throw new Error(`poll HTTP ${res.status}`);
      const data = await res.json();
      const job = data?.jobs?.[0];
      const status: JobStatus | undefined = job?.status;
      const url: string | undefined = job?.results?.raw?.url;
      return { status, url };
    };

    // initial check
    let { status, url } = await fetchStatus();
    if (status === "completed") return { status, url };
    if (status === "failed" || status === "error") return { status, url: undefined };

    while (Date.now() - started < maxMs) {
      await new Promise(r => setTimeout(r, stepMs));
      const res = await fetchStatus();
      status = res.status;
      url = res.url;

      if (status === "completed") return { status, url };
      if (status === "failed" || status === "error") return { status, url: undefined };
    }
    throw new Error("Polling timed out (20 min)");
  };

  const runAll = async () => {
    if (running) return;
    setRunning(true);
    setJobs([]);

    const pairs = buildPairs(imageUrls);

    for (const pair of pairs) {
      // placeholder row
      setJobs(prev => [...prev, { id: "pending", pair, status: "queued" }]);

      try {
        const { jobSetId, initialStatus } = await submitPair(pair);

        // replace placeholder with real id
        setJobs(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { id: jobSetId, pair, status: initialStatus };
          return copy;
        });

        if (initialStatus === "completed") {
          setJobs(prev =>
            prev.map(j => (j.id === jobSetId ? { ...j, status: "completed" } : j))
          );
          continue;
        }
        if (initialStatus === "failed" || initialStatus === "error") {
          setJobs(prev =>
            prev.map(j => (j.id === jobSetId ? { ...j, status: initialStatus, error: "Failed at submit" } : j))
          );
          continue;
        }

        const { status, url } = await pollUntilDone(jobSetId, 3000, 1_200_000);

        setJobs(prev =>
          prev.map(j =>
            j.id === jobSetId
              ? { ...j, status, url, error: status === "completed" ? undefined : "Generation failed" }
              : j
          )
        );
      } catch (e: any) {
        setJobs(prev => {
          const copy = [...prev];
          const idx = copy.length - 1;
          copy[idx] = { ...copy[idx], status: "failed", error: e?.message ?? "Unknown error" };
          return copy;
        });
      }
    }

    setRunning(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={runAll}
        disabled={running}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {running ? "Working..." : "Generate Transitions"}
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job, idx) => (
          <div key={`${job.id}-${idx}`} className="flex flex-col gap-2">
            <div className="text-sm text-gray-600">
              {`Pair ${idx + 1}: `}
              <span className="break-all">{job.pair.start}</span>
              {" → "}
              <span className="break-all">{job.pair.end}</span>
            </div>

            {job.url ? (
              <video src={job.url} controls autoPlay loop className="w-full rounded" />
            ) : (
              <div className="text-sm">
                Status: <b>{job.status}</b>
                {job.error ? <div className="text-red-600 mt-1">{job.error}</div> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
