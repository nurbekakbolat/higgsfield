import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.entry";

export async function uploadViaProxy(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  return data.url;
}

export async function splitAndUpload(file: File): Promise<string[]> {
  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files supported.");
  }

  const uploadedUrls: string[] = [];

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png")
    );

    const pngFile = new File([blob], `page-${i}.png`, { type: "image/png" });
    try {
      const link = await uploadViaProxy(pngFile);

      uploadedUrls.push(link);
    } catch (err) {
      console.error("Error during upload", err);
    }
  }

  return uploadedUrls;
}
