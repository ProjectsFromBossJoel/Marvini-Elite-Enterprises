// js/ui-modal.js
// Self-contained confirm/alert modal component. Injects its own styles and
// markup once on load, then exposes window.uiConfirm() and window.uiAlert()
// as drop-in async replacements for the native confirm()/alert().
//
// Usage:
//   const ok = await uiConfirm("Delete this item?", { title: "Delete", danger: true });
//   if (!ok) return;
//
//   await uiAlert("Saved successfully.", { title: "Success" });

(function () {
  if (window.uiConfirm && window.uiAlert) return; // already installed

  const STYLE_ID = "ui-modal-styles";
  const OVERLAY_ID = "uiModalOverlay";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        display: flex; align-items: center; justify-content: center;
        z-index: 4000; opacity: 0; visibility: hidden;
        transition: opacity .2s ease, visibility .2s ease;
        padding: 1.5rem; font-family: 'Poppins', system-ui, sans-serif;
      }
      #${OVERLAY_ID}.open { opacity: 1; visibility: visible; }
      #${OVERLAY_ID} .ui-modal-card {
        background: #fff; border-radius: 14px; padding: 1.75rem;
        width: 100%; max-width: 420px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        transform: translateY(16px); transition: transform .2s ease;
      }
      #${OVERLAY_ID}.open .ui-modal-card { transform: translateY(0); }
      #${OVERLAY_ID} .ui-modal-title {
        font-size: 1.05rem; font-weight: 700; margin: 0 0 .6rem; color: #0f172a;
      }
      #${OVERLAY_ID} .ui-modal-message {
        font-size: .9rem; color: #475569; line-height: 1.5; margin: 0 0 1.5rem;
        white-space: pre-line;
      }
      #${OVERLAY_ID} .ui-modal-actions {
        display: flex; justify-content: flex-end; gap: .6rem;
      }
      #${OVERLAY_ID} .ui-modal-btn {
        padding: .55rem 1.1rem; border-radius: 8px; font-size: .85rem;
        font-weight: 600; cursor: pointer; border: 1px solid #e2e8f0;
        background: #fff; color: #0f172a; font-family: inherit;
      }
      #${OVERLAY_ID} .ui-modal-btn.ui-modal-primary {
        background: #1a56ff; border-color: #1a56ff; color: #fff;
      }
      #${OVERLAY_ID} .ui-modal-btn.ui-modal-danger {
        background: #dc2626; border-color: #dc2626; color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  function injectMarkup() {
    if (document.getElementById(OVERLAY_ID)) return;
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="ui-modal-card">
        <h3 class="ui-modal-title" id="uiModalTitle"></h3>
        <p class="ui-modal-message" id="uiModalMessage"></p>
        <div class="ui-modal-actions" id="uiModalActions"></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function openModal({ title, message, buttons }) {
    injectStyles();
    injectMarkup();

    const overlay = document.getElementById(OVERLAY_ID);
    const titleEl = document.getElementById("uiModalTitle");
    const msgEl = document.getElementById("uiModalMessage");
    const actionsEl = document.getElementById("uiModalActions");

    titleEl.textContent = title;
    msgEl.textContent = message;
    actionsEl.innerHTML = "";

    return new Promise((resolve) => {
      function close(result) {
        overlay.classList.remove("open");
        document.removeEventListener("keydown", onKeydown);
        resolve(result);
      }

      function onKeydown(e) {
        if (e.key === "Escape") close(false);
      }

      buttons.forEach((btn) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "ui-modal-btn" + (btn.className ? " " + btn.className : "");
        el.textContent = btn.text;
        el.addEventListener("click", () => close(btn.value));
        actionsEl.appendChild(el);
      });

      document.addEventListener("keydown", onKeydown);
      requestAnimationFrame(() => overlay.classList.add("open"));
    });
  }

  window.uiConfirm = function (message, opts = {}) {
    const { title = "Please Confirm", confirmText = "Confirm", cancelText = "Cancel", danger = false } = opts;
    return openModal({
      title,
      message,
      buttons: [
        { text: cancelText, value: false },
        { text: confirmText, value: true, className: danger ? "ui-modal-danger" : "ui-modal-primary" },
      ],
    });
  };

  window.uiAlert = function (message, opts = {}) {
    const { title = "Notice", okText = "OK", danger = false } = opts;
    return openModal({
      title,
      message,
      buttons: [
        { text: okText, value: true, className: danger ? "ui-modal-danger" : "ui-modal-primary" },
      ],
    });
  };
})();