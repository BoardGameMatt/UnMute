/** @type {import('next').NextConfig} */
const nextConfig = {};

// No Content-Security-Policy is configured in this repo (no middleware.ts,
// no headers() here). If a CSP is added later, the Evaluoi embed on
// /survey requires these origins:
//   script-src  https://survey.evaluoi.app
//   frame-src   https://survey.evaluoi.app
//   connect-src https://survey.evaluoi.app
//   img-src     https://survey.evaluoi.app

export default nextConfig;
