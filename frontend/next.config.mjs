/** @type {import('next').NextConfig} */

// Same-Origin-Proxy /api/* → Backend läuft als Runtime-Route-Handler
// (app/api/[...path]/route.ts), NICHT als next.config-rewrite: nur so wird
// BACKEND_URL zur Laufzeit gelesen statt zur Build-Zeit eingebacken.
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // schlankes Docker-Image (Block 13)
};

export default nextConfig;
