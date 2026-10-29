# PixelCut Studio V2

A responsive photo/video editing workspace starter built with React + Vite.

## V2 features
- Import multiple images, videos and audio assets.
- Media library with asset metadata and thumbnails.
- Multi-track timeline (audio, video, second video, overlays).
- Add text overlays, select/duplicate/delete clips, edit timing, source in-point, opacity and scale.
- Layer panel with visibility and lock toggles.
- Photo/video preview adjustments: presets, brightness, contrast and saturation.
- Canvas aspect ratio controls (16:9, 9:16, 1:1).
- Export a selected photo as PNG, export a selected video segment as MP4, and download project metadata as JSON.
- Responsive desktop/mobile layout with mobile panel navigation.

## Requirements
- Node.js 20.19+ or 22.12+ recommended
- Chrome or Edge recommended for video export
- Internet connection for npm packages and first FFmpeg WebAssembly core download

## Run locally
1. Install Node.js from https://nodejs.org/
2. Extract this zip.
3. Open a terminal in `pixelcut-studio-v2`.
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Open the local address Vite prints, usually `http://localhost:5173`.

## Production build
```bash
npm run build
npm run preview
```
Deploy the generated `dist/` folder to a static host (Netlify, Vercel, Cloudflare Pages, etc.).

## Important scope notes
This is a development starter, not yet a professional NLE. The timeline supports multiple clips and tracks as an editing model, but does not yet implement drag-to-move clips, transitions, audio mixing, keyframes, undo/redo, or a full composite renderer. Export currently handles a selected photo (PNG) or selected video clip segment (MP4), not the complete multi-track timeline. Text overlays are previewed and included in photo export when active. CSS video filters and layered video/text compositions are not yet baked into MP4 export. Project JSON stores edit metadata, not the actual media files; re-import media after reloading. FFmpeg WebAssembly can consume substantial memory, especially on mobile devices.

## Suggested next engineering milestones
1. Implement drag-and-drop clip positioning, snapping, ripple edits, and undo/redo.
2. Build a WebCodecs or FFmpeg compositor that renders every timeline track, effects and text into one output.
3. Add audio waveform generation, gain/fades, transitions and keyframes.
4. Save media/project data in IndexedDB and restore projects from JSON.
5. Add worker-based rendering, export progress/cancellation, and test large-file limits on target devices.
6. For a hosted product, add authentication and cloud storage only when needed.
