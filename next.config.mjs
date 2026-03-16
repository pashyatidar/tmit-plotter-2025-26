/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. DISABLE STRICT MODE to prevent 3D Canvas double-mount crashes
  reactStrictMode: false, 

  // 2. Transpile 3D libraries to ensure they work with Next.js App Router
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
};

export default nextConfig;