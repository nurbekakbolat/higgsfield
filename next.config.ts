import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d3u0tzju9qaucj.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
    ],
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
