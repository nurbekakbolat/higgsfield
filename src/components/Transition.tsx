"use client";

import { useEffect, useState } from "react";
import { concatVideosBrowser } from "~/helpers/concatVideos";

type JobStatus = "queued" | "processing" | "completed" | "failed" | "error";

interface Pair {
  start: string;
  end: string;
}

interface JobItem {
  id: string;            // job-set id (after submit)
  pair: Pair;            // which images this job is for
  status: JobStatus;
  url?: string;          // final video url
  error?: string;
}

const HIGGSFIELD_BASE = "https://platform.higgsfield.ai/v1";

export default function Transition({ imageUrls }: { imageUrls: string[] }) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [running, setRunning] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    "hf-api-key": process.env.NEXT_PUBLIC_HF_API_KEY!,
    "hf-secret": process.env.NEXT_PUBLIC_HF_API_SECRET!,
  };

  const buildPairs = (urls: string[]): Pair[] => {
    const out: Pair[] = [];
    for (let i = 0; i < urls.length - 1; i++) out.push({ start: urls[i], end: urls[i + 1] });
    return out;
  };

  // POST one pair, return job-set id and initial status
  const submitPair = async (pair: Pair) => {
    const res = await fetch(`${HIGGSFIELD_BASE}/image2video/minimax`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        params: {
          prompt: "generate smooth transition between two slides, keep all text and typography fixed and legible, do NOT morph or distort text",
          duration: 6,
          resolution: "1080",
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

  // Helper to update a specific job by index without racing state
  const updateJobAt = (idx: number, patch: Partial<JobItem>) => {
    setJobs(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  // PARALLEL run: submit all pairs, then poll all in parallel
  const runAllParallel = async () => {
    if (running || !imageUrls.length) return;
    setRunning(true);
  setMergedUrl(null);

    const pairs = buildPairs(imageUrls);

    // initialize placeholders so UI renders all cards immediately
    setJobs(pairs.map(p => ({ id: "pending", pair: p, status: "queued" })));

    // 1) submit all pairs in parallel
    const submitPromises = pairs.map(async (pair, idx) => {
      try {
        const { jobSetId, initialStatus } = await submitPair(pair);
        updateJobAt(idx, { id: jobSetId, status: initialStatus });
        return { idx, jobSetId, status: initialStatus as JobStatus, ok: true as const };
      } catch (e) {
        console.error(e)

        updateJobAt(idx, { status: "failed", error: "Submit failed" });
        return { idx, ok: false as const };
      }
    });

    const submitted = await Promise.all(submitPromises);

    // 2) poll all successfully submitted jobs in parallel
    const pollPromises = submitted
      .filter((s): s is { idx: number; jobSetId: string; status: JobStatus; ok: true } => s.ok === true)
      .map(async s => {
        // if already completed instantly, skip polling
        if (s.status === "completed") {
          // we don't have url in immediate response, still poll once to fetch the url
          try {
            const { url } = await pollUntilDone(s.jobSetId, 500, 5000); // short poll to fetch url
            updateJobAt(s.idx, { status: "completed", url });
          } catch {
            // whatever, mark completed without url
            updateJobAt(s.idx, { status: "completed" });
          }
          return;
        }

        try {
          const { status, url } = await pollUntilDone(s.jobSetId, 3000, 1_200_000);
          updateJobAt(s.idx, { status, url, error: status === "completed" ? undefined : "Generation failed" });
        } catch (e) {
          console.error(e)
          updateJobAt(s.idx, { status: "failed", error: "Polling failed" });
        }
      });

    await Promise.allSettled(pollPromises);

    setRunning(false);
  };

  useEffect(() => {
    if (!imageUrls.length) return;
    runAllParallel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrls.join("|")]); // re-run if list changes content

   useEffect(() => {
    const allDone = jobs.length > 0 && jobs.every((j) => j.status === "completed" && j.url);
  if (!allDone || mergedUrl) return; 

    const urls = jobs.map((j) => j.url!) as string[];
    (async () => {
      try {
        setMerging(true);
        const blob = await concatVideosBrowser(urls);
        setMergedUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error("Concat failed:", e);
      } finally {
        setMerging(false);
      }
    })();
  }, [jobs]);

  return (
    <div className="flex flex-col gap-6">
      {/* If you want manual trigger instead of auto-run, uncomment:
      <button
        onClick={runAllParallel}
        disabled={running}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {running ? "Working..." : "Generate Transitions"}
      </button> */}

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
                {running && !job.error && job.status !== "completed" ? (
                  <div className="text-xs text-gray-500">Waiting on GPUs like everyone else.</div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
            {/* Merged video */}
      {merging && <p className="text-gray-500">Merging all transitions...</p>}
      {mergedUrl && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Merged Video</h2>
          <video src={mergedUrl} controls autoPlay loop className="w-full rounded" />
        </div>
      )}
    </div>
  );
}
