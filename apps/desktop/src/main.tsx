import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { migrateLegacyLocalStorage } from "./migrateLegacyLocalStorage";

function renderFatalBootstrapError(message: string, detail: string) {
  const root = document.getElementById("root");
  const target = root ?? document.body;
  target.innerHTML = `
    <div style="min-height:100vh;background:#111;color:#f5f5f5;padding:24px;font-family:Consolas, 'Courier New', monospace;white-space:pre-wrap;line-height:1.5;">
      <div style="font-size:18px;font-weight:700;margin-bottom:12px;">OminiTerm renderer failed to start</div>
      <div style="margin-bottom:8px;opacity:.9;">${message}</div>
      <div style="opacity:.75;">${detail}</div>
    </div>
  `;
}

async function bootstrap() {
  try {
    migrateLegacyLocalStorage();
  } catch (err) {
    console.error("[bootstrap] migrateLegacyLocalStorage failed:", err);
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Missing #root element");
  }

  const { App } = await import("./App");
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap().catch((err) => {
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  console.error("[bootstrap] renderer init failed:", err);
  renderFatalBootstrapError("Bootstrap exception", detail);
});
