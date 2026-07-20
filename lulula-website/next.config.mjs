/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a fully static site into ./out — serve those files behind the Cloudflare tunnel.
  output: "export",
  // Static export can't use the Next.js image optimizer, so serve images as-is.
  images: { unoptimized: true },
  // Each route becomes a folder with an index.html — clean, predictable static serving.
  trailingSlash: true,
  // Dev-only: allow the phone/LAN to load dev resources (HMR, client chunks) when
  // previewing over the local network. Has no effect on the static production build.
  allowedDevOrigins: ["192.168.1.50", "localhost"],
};

export default nextConfig;
