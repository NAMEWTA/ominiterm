import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { migrateLegacyLocalStorage } from "./migrateLegacyLocalStorage";

migrateLegacyLocalStorage();

const { App } = await import("./App");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
