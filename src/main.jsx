import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Im Produktivbetrieb: kein Kontextmenü und keine Tastenkürzel für die Entwicklerwerkzeuge.
if (import.meta.env.PROD) {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener(
    "keydown",
    (e) => {
      const key = e.key.toLowerCase();
      const devtoolsShortcut =
        e.key === "F12" || (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) || (e.ctrlKey && key === "u");
      if (devtoolsShortcut) e.preventDefault();
    },
    true
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
