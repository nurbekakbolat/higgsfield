import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false; // ignore node-canvas
    config.resolve.alias["pdfjs-dist/build/pdf"] =
      "pdfjs-dist/legacy/build/pdf";
    config.resolve.alias["pdfjs-dist/build/pdf.worker"] =
      "pdfjs-dist/legacy/build/pdf.worker";
    return config;
  },
};

export default nextConfig;
