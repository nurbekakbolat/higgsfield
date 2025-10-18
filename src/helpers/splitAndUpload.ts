import { PDFDocument } from "pdf-lib";

const HIGGSFIELD_BASE = "https://platform.higgsfield.ai";

export async function splitAndUpload(file: File): Promise<string[]> {
  const uploadedUrls: string[] = [];

  // Step 1. Split file into images
  const fileType = file.type;

  const images: Blob[] = [];

  if (fileType === "application/pdf") {
    // Split PDF pages into images using pdf-lib + canvas
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const totalPages = pdf.getPageCount();

    for (let i = 0; i < totalPages; i++) {
      const pageBlob = await renderPdfPageToPng(pdf, i);
      images.push(pageBlob);
    }
  } else if (fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    // handle PPTX — simplest: convert to PDF first server-side, or use a library that can render slides
    throw new Error("PPTX splitting not implemented client-side yet.");
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  // Step 2. Upload each image via Higgsfield presigned upload
  for (const img of images) {
    const { upload_url, file_url } = await fetch(`${HIGGSFIELD_BASE}/files/generate-upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "hf-api-key": process.env.NEXT_PUBLIC_HF_API_KEY!,
      },
      body: JSON.stringify({ content_type: img.type }),
    }).then(r => r.json());

    const put = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": img.type },
      body: img,
    });
    if (!put.ok) throw new Error(`Upload failed: ${put.status}`);

    uploadedUrls.push(file_url);
  }

  return uploadedUrls;
}

// Utility to render PDF page to Blob
async function renderPdfPageToPng(pdf: PDFDocument, pageIndex: number): Promise<Blob> {
  const page = pdf.getPage(pageIndex);
  const viewport = page.getSize();

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  const renderTask = await (window as any).pdfjsLib
    .getDocument({ data: await pdf.save() })
    .promise.then((doc: any) => doc.getPage(pageIndex + 1))
    .then((page: any) =>
      page.render({
        canvasContext: ctx,
        viewport: page.getViewport({ scale: 2 }),
      }).promise
    );

  const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), "image/png"));
  return blob;
}
