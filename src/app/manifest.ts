import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "好好意语共读空间",
    short_name: "好好意语",
    description: "好好意语共读空间 7 天免费公测版",
    start_url: "/",
    display: "standalone",
    background_color: "#19caad",
    theme_color: "#19caad",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
