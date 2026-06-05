/** @type {import('next').NextConfig} */

// Backend-Adresse aus Sicht des Next-SERVERS (nicht des Browsers).
// Lokal: localhost:8000 · Docker: http://backend:8000 (in Block 14 gesetzt).
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // schlankes Docker-Image (Block 13)
  async rewrites() {
    // Same-Origin-Proxy: Browser ruft /api/*, Next leitet serverseitig weiter.
    // Kein CORS, keine im Browser hartkodierte Backend-Adresse → funktioniert
    // auch über Tailscale/Remote.
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
};

export default nextConfig;
