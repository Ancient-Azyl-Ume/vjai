import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./ui/shell/App";
import { OutputView } from "./ui/shell/OutputView";
import { connectDoc } from "./doc/store";

import { call } from "./rpc";

const log = (line: string) => call("log_line", { line: `${new Date().toISOString()} [${location.search || "main"}] ${line}` }).catch(() => {});
window.addEventListener("error", (e) => log(`error: ${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) => log(`unhandled: ${String((e as PromiseRejectionEvent).reason)}`));
const origError = console.error.bind(console);
console.error = (...a: unknown[]) => { log("console.error: " + a.map(String).join(" ")); origError(...a); };
log("boot");

const params = new URLSearchParams(location.search);
const outputId = params.get("output");

connectDoc().catch(console.error);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{outputId ? <OutputView outputId={outputId} /> : <App />}</React.StrictMode>,
);
