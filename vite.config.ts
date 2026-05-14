import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /** 构建产物使用相对路径，便于用静态服务器或 `npm run preview` 访问 */
  base: "./",
});
