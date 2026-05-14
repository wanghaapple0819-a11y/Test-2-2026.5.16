import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ReviewWorkbench } from "./ReviewWorkbench";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReviewWorkbench />
  </StrictMode>,
);
