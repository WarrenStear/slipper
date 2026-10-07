import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ExperienceSettingsDrawer from "./components/ui/ExperienceSettingsDrawer";
import { entries } from "./data/slipperContent";
import "./experiencePolish.css";
import "./mobileEnhancements.css";
import "./mobileEnhancements";
import "./visualPresentation.css";
import "./ui/QuietExperience.css";

const FIRST_ENTRY_ID = entries[0]?.id ?? "";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <ExperienceSettingsDrawer initialEntryId={FIRST_ENTRY_ID} />
  </React.StrictMode>,
);
