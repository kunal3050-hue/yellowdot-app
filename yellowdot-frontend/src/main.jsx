import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Import CSS in the correct cascade order via JS (avoids PostCSS @import ordering warnings)
import "./styles/tokens.css";
import "./styles/animations.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/settings.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
