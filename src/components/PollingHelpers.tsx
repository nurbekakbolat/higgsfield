export type JobStatus = "queued" | "processing" | "completed" | "failed" | "canceled" | string;

export interface HiggsfieldJob {
  id: string;
  job_set_type: string;
  status: JobStatus;
  results?: {
    min?: { type: string; url: string };
    raw?: { type: string; url: string };
  } | null;
}

export interface HiggsfieldJobSetResponse {
  id: string;
  type: string;
  created_at: string;
  jobs: HiggsfieldJob[];
  input_params: Record<string, unknown>;
}

type PollOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  resolveOnFirstCompletedJob?: boolean;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => resolve(), ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });

async function fetchJobSet(jobSetId: string): Promise<HiggsfieldJobSetResponse> {
  const res = await fetch(`https://platform.higgsfield.ai/v1/job-sets/${jobSetId}`, {
    method: "GET",
    headers: {
      "hf-api-key": process.env.NEXT_PUBLIC_HF_API_KEY as string,
      "hf-secret": process.env.NEXT_PUBLIC_HF_API_SECRET as string,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Status check failed (${res.status}) for job_set_id=${jobSetId}`);
  }
  return res.json();
}

export async function pollJobUntilComplete(
  jobSetId: string,
  opts: PollOptions = {}
): Promise<string | null> {
  const {
    intervalMs = 1500,
    timeoutMs = 120_000,
    signal,
  } = opts;

  const start = Date.now();
  let delay = intervalMs;

  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (Date.now() - start > timeoutMs) return null;

    try {
      const data = await fetchJobSet(jobSetId);
      for (const job of data.jobs ?? []) {
        if (job.status === "completed") {
          const url = job.results?.min?.url ?? null;
          return url;
        }
        if (job.status === "failed" || job.status === "canceled") {
          return null;
        }
      }
    } catch (err) {
      delay = Math.min(delay * 1.5, 6000);
    }

    await sleep(delay, signal);
  }
}

export async function pollManyJobsUntilComplete(
  jobSetIds: string[],
  opts: PollOptions = {}
): Promise<string[]> {
  const promises = jobSetIds.map((id) => pollJobUntilComplete(id, opts));
  const results = await Promise.all(promises);
  const urls = results.filter((u): u is string => Boolean(u));
  return urls;
}
