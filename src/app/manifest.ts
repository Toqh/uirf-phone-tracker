import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Survey Phone Tracker",
    short_name: "Phone Tracker",
    description: "Manage survey phone configuration, checkout, returns, and history.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f7f4",
    theme_color: "#12372a",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
