# VisualAlgo • Vision AI & Object Grounding (React SPA)

An advanced, task-driven Computer Vision & Visual Question Answering (VQA) system built with **React**, **TypeScript**, and **Multimodal LLMs (Google Gemini Vision)** with high-precision visual object grounding and highlighting.

This project implements the core paradigm:
> **"Identifying the Most Relevant Visual Information from a Given Task"**  
> *"The system focuses only on the parts of the image that are important for the task, and ignores irrelevant details."*

---

## 🌟 Key Features

1. **Highlighting Engine (Rectangles & Squares)**:
   - High-contrast precision bounding boxes around detected entities.
   - High-tech corner bracket accents and pill-shaped confidence badges.
   - Distinct color palettes (Lime Green, Bright Crimson, Electric Blue, Amber Gold, Cyber Purple, Muted Gray).
   - Instant 1-click download of the annotated image.

2. **Task-Driven LLM Visual Grounding (Gemini Vision)**:
   - Answers natural language questions directly about uploaded or live-captured images.
   - Returns normalized 2D coordinates `[ymin, xmin, ymax, xmax]` (scaled 0–1000) for exact visual grounding.
   - Explains what visual features were focused on and what irrelevant background details were filtered out.

3. **Three Detection Modes**:
   - 🎯 **Task-Focused**: Highlights *only* the specific objects needed to answer the question.
   - 🔍 **All Objects**: Highlights and categorizes every distinct object present in the scene.
   - 🌟 **Hybrid**: Highlights all detected entities with secondary muted outlines while boldly spotlighting the primary target.

4. **Multi-Modal Image Input**:
   - 📁 **File Upload & Drag-and-Drop**: Upload JPEG, PNG, WEBP, or BMP images.
   - 📷 **Live Camera Capture**: Integrated camera modal with video stream, device camera flipping, and instant frame snapping.
   - 🎙️ **Voice Dictation**: Web Speech API integration for asking questions using your voice.
   - 🖼️ **Preset Samples Library**: Instant access to benchmark samples (Traffic Light, Golden Retriever, City Cyclist, BMW M4 GT4, etc.).

5. **Modern ChatGPT-Style Web Interface**:
   - Radiant, warm light orange & white aesthetic with glassmorphism.
   - Persistent outputs gallery and sample library drawers.
   - Offline intelligent heuristic grounding fallback for common vision tasks.

---

## 🚀 Development & Build

```bash
# Install dependencies
npm install

# Start Vite dev server on port 3000
npm run dev

# Build for production
npm run build
```

---

## 🔑 Gemini API Key Configuration

The app includes an offline heuristic engine for common tasks. To process any custom image and custom question using live Gemini Vision:

1. Click the **API Key** button in the top navigation bar.
2. Enter your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Click **Save & Test** to validate and save it locally in your browser.
