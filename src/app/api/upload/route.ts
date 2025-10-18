export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    if (!file) return new Response("Missing file", { status: 400 });

    const upstream = new FormData();
    upstream.append("image", file);
    const url = `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      body: upstream,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      return new Response(
        JSON.stringify({ error: "Upload failed", details: data }),
        { status: 500 }
      );
    }

    // Return display_url or direct image URL
    const imageUrl = data?.data?.display_url || data?.data?.url;
    return Response.json({ url: imageUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
