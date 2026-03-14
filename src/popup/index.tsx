import ReactDOM from "react-dom/client";
import "./popup.css";
import { PopupApp } from "./PopupApp";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(<PopupApp />);
}