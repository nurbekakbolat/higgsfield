import { FFmpeg } from "@ffmpeg/ffmpeg";

export async function concatVideosBrowser(videoUrls: string[]): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  // Write each input video
  for (let i = 0; i < videoUrls.length; i++) {
    const res = await fetch(videoUrls[i]);
    const data = new Uint8Array(await res.arrayBuffer());
    await ffmpeg.writeFile(`v${i}.mp4`, data);
  }

  // Write concat list
  const list = videoUrls.map((_, i) => `file v${i}.mp4`).join("\n");
  await ffmpeg.writeFile("list.txt", list);

  // Run concat command
  await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "out.mp4"]);

  // Read output file
  const output = await ffmpeg.readFile("out.mp4");

  // Safely normalize to Uint8Array
  const outData =
    output instanceof Uint8Array
      ? output
      : new TextEncoder().encode(String(output));

  // Force cast so TS stops complaining
  return new Blob([outData as unknown as Uint8Array<ArrayBuffer>], {
    type: "video/mp4",
  });
}
