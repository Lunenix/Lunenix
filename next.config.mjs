import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const simliClientJs = path.join(
  __dirname,
  "node_modules/simli-client/dist/client.js"
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep the Node build of the SDK out of webpack so Vercel traces the
    // real package files (nft often misses @google/genai's conditional exports).
    serverComponentsExternalPackages: [
      "@google/genai",
      "google-auth-library",
    ],
    outputFileTracingIncludes: {
      "/api/luna/chat": [
        "./node_modules/@google/genai/**/*",
        "./node_modules/google-auth-library/**/*",
      ],
    },
  },
  async redirects() {
    return [
      {
        source: "/calendar",
        destination: "/dashboard/calendar",
        permanent: false,
      },
    ];
  },
  webpack: (config, { webpack }) => {
    // simli-client@3.0.2's dist/index.js does `require("./Client")` but the
    // file on disk is `client.js`. That fails on Linux (Vercel). Point every
    // resolution of that module at the real file.
    config.resolve.alias = {
      ...config.resolve.alias,
      "simli-client$": simliClientJs,
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /simli-client[\\/]dist[\\/]Client(\.js)?$/,
        simliClientJs
      )
    );
    return config;
  },
};

export default nextConfig;
