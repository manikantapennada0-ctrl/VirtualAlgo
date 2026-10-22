/**
 * VisualAlgo — clean chat client for OpenCV + Gemini visual grounding.
 */

document.addEventListener("DOMContentLoaded", () => {
  const chatMessages = document.getElementById("chatMessages");
  const chatViewport = document.getElementById("chatViewport");
  const promptInput = document.getElementById("promptInput");
  const btnSend = document.getElementById("btnSend");
  const btnAttachImage = document.getElementById("btnAttachImage");
  const imageFileInput = document.getElementById("imageFileInput");
  const attachmentPreviewBar = document.getElementById("attachmentPreviewBar");
  const attachedThumb = document.getElementById("attachedThumb");
  const attachedFilename = document.getElementById("attachedFilename");
  const btnRemoveAttach = document.getElementById("btnRemoveAttach");
  const btnModeToggle = document.getElementById("btnModeToggle");
  const lblActiveMode = document.getElementById("lblActiveMode");
  const brandLogoHome = document.getElementById("brandLogoHome");
  const btnMic = document.getElementById("btnMic");
  const btnCamera = document.getElementById("btnCamera");
  const cameraModal = document.getElementById("cameraModal");
  const cameraVideo = document.getElementById("cameraVideo");
  const cameraCanvas = document.getElementById("cameraCanvas");
  const cameraStatus = document.getElementById("cameraStatus");
  const btnCloseCamera = document.getElementById("btnCloseCamera");
  const btnSnapCamera = document.getElementById("btnSnapCamera");
  const btnFlipCamera = document.getElementById("btnFlipCamera");
  const workspaceHero = document.getElementById("workspaceHero");
  const initialHeroNode = workspaceHero ? workspaceHero.cloneNode(true) : null;

  const apiKeyModal = document.getElementById("apiKeyModal");
  const btnApiKey = document.getElementById("btnApiKey");
  const btnCloseApiKey = document.getElementById("btnCloseApiKey");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const btnSaveApiKey = document.getElementById("btnSaveApiKey");
  const btnClearApiKey = document.getElementById("btnClearApiKey");
  const apiKeyStatus = document.getElementById("apiKeyStatus");

  let currentFile = null;
  let lastFile = null;
  let detectionMode = "task_focused";
  let recognizing = false;
  let recognition = null;
  let cameraStream = null;
  let cameraFacing = "environment";

  const modes = [
    { id: "task_focused", label: "Task-Focused" },
    { id: "all_objects", label: "All Objects" },
    { id: "hybrid", label: "Hybrid" }
  ];

  pingHealth();

  async function pingHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const chip = document.querySelector(".opencv-chip span:last-child");
      if (chip && data.opencv_version) chip.textContent = `OpenCV ${data.opencv_version}`;
    } catch (_) { /* non-blocking */ }
  }

  promptInput.addEventListener("input", () => {
    promptInput.style.height = "auto";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 140) + "px";
  });

  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  btnSend.addEventListener("click", sendMessage);

  btnModeToggle.addEventListener("click", () => {
    const currentIndex = modes.findIndex((m) => m.id === detectionMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    detectionMode = modes[nextIndex].id;
    lblActiveMode.textContent = modes[nextIndex].label;
  });

  btnAttachImage.addEventListener("click", () => imageFileInput.click());

  imageFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleAttachedFile(e.target.files[0]);
  });

  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) handleAttachedFile(file);
    }
  });

  function handleAttachedFile(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      attachedThumb.src = e.target.result;
      attachedFilename.textContent = file.name;
      attachmentPreviewBar.style.display = "flex";
    };
    reader.readAsDataURL(file);
    promptInput.focus();
  }

  btnRemoveAttach.addEventListener("click", () => {
    currentFile = null;
    imageFileInput.value = "";
    attachedThumb.src = "";
    attachmentPreviewBar.style.display = "none";
  });

  function resetChat() {
    if (!chatMessages) return;
    chatMessages.innerHTML = "";
    if (initialHeroNode) {
      const freshHero = initialHeroNode.cloneNode(true);
      chatMessages.appendChild(freshHero);
    }
    btnRemoveAttach.click();
    promptInput.value = "";
    promptInput.style.height = "auto";
    lastFile = null;
  }

  brandLogoHome?.addEventListener("click", resetChat);

  function storedApiKey() {
    return (localStorage.getItem("gemini_api_key") || "").trim();
  }

  async function compressImageForUpload(file, maxSide = 960, quality = 0.62) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) return file;
      const base = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
      return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
    } catch (_) {
      return file;
    }
  }

  async function sendMessage() {
    if (!chatMessages) return;
    const question = promptInput.value.trim();
    const sendFile = currentFile || lastFile;

    if (!question && !sendFile) {
      promptInput.focus();
      return;
    }
    if (!sendFile) {
      renderBotError("Attach an image with + so OpenCV can detect objects.");
      btnAttachImage.click();
      return;
    }

    const finalQuestion = question || "Detect and highlight the main objects in this image";
    document.getElementById("workspaceHero")?.remove();

    if (currentFile) lastFile = currentFile;

    renderUserMessage(finalQuestion);
    promptInput.value = "";
    promptInput.style.height = "auto";

    btnSend.disabled = true;
    const loadingId = "bot-loading-" + Date.now();
    renderBotLoading(loadingId);
    scrollToBottom();

    try {
      const compactFile = await compressImageForUpload(sendFile);
      const formData = new FormData();
      formData.append("image", compactFile);
      formData.append("question", finalQuestion);
      formData.append("mode", detectionMode);
      const key = storedApiKey();
      if (key) formData.append("api_key", key);

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!response.ok) {
        let errMessage = "Analysis request failed.";
        try {
          const errData = await response.json();
          errMessage = errData.detail || errMessage;
        } catch (_) { /* keep default */ }
        throw new Error(errMessage);
      }
      const result = await response.json();
      removeBotLoading(loadingId);
      renderBotResponse(result);
      scrollToBottom();
    } catch (err) {
      removeBotLoading(loadingId);
      renderBotError(`Failed to analyze image: ${err.message}`);
      scrollToBottom();
    } finally {
      btnSend.disabled = false;
    }
  }

  function renderUserMessage(text) {
    const item = document.createElement("div");
    item.className = "message-item user";
    item.innerHTML = `
      <div class="msg-bubble">
        <div>${escapeHtml(text)}</div>
      </div>
    `;
    chatMessages.appendChild(item);
  }

  function renderBotLoading(id) {
    const item = document.createElement("div");
    item.className = "message-item bot";
    item.id = id;
    item.innerHTML = `
      <div class="msg-bubble">
        <div class="loading-bubble">
          <div class="pulse-spinner"></div>
          <span>Detecting objects...</span>
        </div>
      </div>
    `;
    chatMessages.appendChild(item);
  }

  function removeBotLoading(id) {
    document.getElementById(id)?.remove();
  }

  function renderBotResponse(data) {
    const item = document.createElement("div");
    item.className = "message-item bot";
    const annotatedSrc = data.annotated_image || data.saved_files?.highlighted_url || "";
    const savedFile = data.saved_files?.highlighted_filename || "output.jpg";
    const downloadHref = data.saved_files?.highlighted_url || annotatedSrc;
    const dims = data.image_dims || {};

    item.innerHTML = `
      <div class="msg-bubble">
        <div class="bot-answer-text">${escapeHtml(data.answer)}</div>
        ${data.relevant_visual_info ? `
          <div style="font-size: 0.86rem; color: #9a3412; font-style: italic; margin-bottom: 12px; background: #fff7ed; border: 1px solid rgba(249, 115, 22, 0.25); padding: 10px 14px; border-radius: 10px;">
            ${escapeHtml(data.relevant_visual_info)}
          </div>
        ` : ""}
        <div class="msg-result-card">
          <div class="msg-result-img-wrap">
            <img src="${escapeAttr(annotatedSrc)}" alt="OpenCV highlighted result">
          </div>
          <div class="msg-result-footer">
            <div class="msg-stats-chips">
              <span class="msg-stat-chip">Detected: ${data.total_detected || 0}</span>
              <span class="msg-stat-chip">${dims.width || "?"} × ${dims.height || "?"}px</span>
            </div>
            <a href="${escapeAttr(downloadHref)}" download="${escapeAttr(savedFile)}" class="btn-msg-download">
              <span>Download</span>
            </a>
          </div>
        </div>
      </div>
    `;
    chatMessages.appendChild(item);
  }

  function renderBotError(errMsg) {
    if (!chatMessages) return;
    const item = document.createElement("div");
    item.className = "message-item bot";
    item.innerHTML = `
      <div class="msg-bubble">
        <div style="color: #b91c1c; font-size: 0.95rem; background: #fef2f2; border: 1px solid #fecaca; padding: 12px 16px; border-radius: 12px; font-weight: 500;">${escapeHtml(errMsg)}</div>
      </div>
    `;
    chatMessages.appendChild(item);
  }

  function scrollToBottom() {
    if (!chatViewport) return;
    chatViewport.scrollTop = chatViewport.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  btnApiKey?.addEventListener("click", () => {
    apiKeyInput.value = storedApiKey();
    apiKeyStatus.textContent = storedApiKey()
      ? "A key is saved in this browser."
      : "No browser key saved. Server .env key is used if present.";
    apiKeyModal.style.display = "flex";
  });
  btnCloseApiKey?.addEventListener("click", () => { apiKeyModal.style.display = "none"; });
  apiKeyModal?.addEventListener("click", (e) => {
    if (e.target === apiKeyModal) apiKeyModal.style.display = "none";
  });

  btnSaveApiKey?.addEventListener("click", async () => {
    const key = (apiKeyInput.value || "").trim();
    if (!key) {
      apiKeyStatus.textContent = "Paste a key first.";
      return;
    }
    apiKeyStatus.textContent = "Testing key...";
    try {
      const res = await fetch("/api/test_key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key })
      });
      const data = await res.json();
      apiKeyStatus.textContent = data.message || (data.valid ? "Valid." : "Invalid.");
      if (data.valid) localStorage.setItem("gemini_api_key", key);
    } catch (err) {
      apiKeyStatus.textContent = `Could not validate: ${err.message}`;
    }
  });

  btnClearApiKey?.addEventListener("click", () => {
    localStorage.removeItem("gemini_api_key");
    apiKeyInput.value = "";
    apiKeyStatus.textContent = "Browser key cleared.";
  });

  async function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    if (cameraVideo) cameraVideo.srcObject = null;
    if (cameraModal) cameraModal.style.display = "none";
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      renderBotError("Live capture is not supported in this browser.");
      return;
    }
    cameraModal.style.display = "flex";
    cameraStatus.textContent = "Starting camera...";
    btnSnapCamera.disabled = true;
    try {
      if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      cameraVideo.srcObject = cameraStream;
      await cameraVideo.play();
      cameraStatus.textContent = "Live";
      btnSnapCamera.disabled = false;
    } catch (err) {
      cameraStatus.textContent = "Camera permission denied or unavailable.";
      btnSnapCamera.disabled = true;
      renderBotError("Could not open the camera. Allow camera access and try again.");
    }
  }

  function captureCameraFrame() {
    if (!cameraVideo || cameraVideo.readyState < 2) return;
    const width = cameraVideo.videoWidth || 960;
    const height = cameraVideo.videoHeight || 720;
    cameraCanvas.width = width;
    cameraCanvas.height = height;
    const ctx = cameraCanvas.getContext("2d", { alpha: false });
    ctx.drawImage(cameraVideo, 0, 0, width, height);
    cameraCanvas.toBlob((blob) => {
      if (!blob) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([blob], `live-capture-${stamp}.jpg`, { type: "image/jpeg" });
      handleAttachedFile(file);
      stopCamera();
      promptInput.focus();
    }, "image/jpeg", 0.82);
  }

  btnCamera?.addEventListener("click", startCamera);
  btnCloseCamera?.addEventListener("click", stopCamera);
  btnSnapCamera?.addEventListener("click", captureCameraFrame);
  btnFlipCamera?.addEventListener("click", () => {
    cameraFacing = cameraFacing === "environment" ? "user" : "environment";
    startCamera();
  });
  cameraModal?.addEventListener("click", (e) => {
    if (e.target === cameraModal) stopCamera();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      apiKeyModal.style.display = "none";
      stopCamera();
    }
  });
  window.addEventListener("beforeunload", stopCamera);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && btnMic) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      promptInput.value = (promptInput.value + " " + transcript).trim();
      promptInput.dispatchEvent(new Event("input"));
    };
    recognition.onend = () => {
      recognizing = false;
      btnMic.classList.remove("listening");
    };
    recognition.onerror = () => {
      recognizing = false;
      btnMic.classList.remove("listening");
    };
    btnMic.addEventListener("click", () => {
      if (recognizing) {
        recognition.stop();
        return;
      }
      recognizing = true;
      btnMic.classList.add("listening");
      recognition.start();
    });
  } else if (btnMic) {
    btnMic.title = "Voice dictation is not supported in this browser";
  }
});
