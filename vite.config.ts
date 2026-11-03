import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "题迹 - 本地刷题",
        short_name: "题迹",
        description: "本地离线题库、刷题记录与错题本",
        theme_color: "#183c32",
        background_color: "#f4f5ef",
        display: "standalone",
        start_url: ".",
        scope: ".",
        lang: "zh-CN",
        icons: [
          {
            src: "./icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "./icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "./icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"]
      }
    })
  ]
});
