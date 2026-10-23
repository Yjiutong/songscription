import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Two faces with two jobs, shipped as local files rather than fetched from a
// font CDN at build time: this app must run with no network at all.
// Literata sets the works and the sentences a learner reads — it is a face
// designed for long reading on a screen. Archivo carries every label, control
// and measured value, where the job is to be unambiguous at 12px rather than
// pleasant at 18.
import "@fontsource-variable/literata";
import "@fontsource-variable/archivo";
import "./index.css";
import { App } from "./App";
import { SiteBackground } from "./components/SiteBackground";
import { WindowEdges } from "./components/WindowEdges";
import { AppearanceProvider } from "./lib/appearance";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element in index.html.");

createRoot(root).render(
  <StrictMode>
    {/* The appearance sits above everything: the top bar takes its colour from
        whatever background is showing, so it has to be able to read it. */}
    <AppearanceProvider>
      <SiteBackground />
      <App />
      <WindowEdges />
    </AppearanceProvider>
  </StrictMode>,
);
