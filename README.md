# DesktopDrawer

A cinematic Windows desktop overlay that hides your files and folders inside hover-activated edge drawers — keeping your wallpaper clean while your files stay a mouse-swipe away.

Built with **Electron**, **React**, **TailwindCSS**, and **Framer Motion**.

---

## What it does

DesktopDrawer replaces the cluttered Windows desktop with a minimal overlay. Two translucent drawer handles sit at the left and right screen edges. Hover over one and a dark, animated panel slides out showing your files. Move your mouse away and it disappears.

Your wallpaper stays dominant. Your files stay accessible. The desktop stays clean.

---

## Features

- **Edge drawers** — left and right panels that slide open on hover
- **Real file system** — files live in `~/Documents/DesktopDrawer/Left` and `~/Documents/DesktopDrawer/Right`
- **Drag & drop** — drag files between drawers, from Explorer into a drawer, or back out to the desktop
- **Open files** — click any file or folder to open it normally
- **Desktop icon toggle** — hide or show Windows desktop icons from the drawer header
- **Tray icon** — lives in the system tray; right-click for options
- **Hover delay** — configurable 0.5s–10s delay before a drawer opens (set from tray menu)
- **Drawer color** — pick a custom accent color per drawer
- **Start with Windows** — optional autostart via tray menu
- **Single instance** — launching a second copy focuses the existing one

---

## Requirements

- **Windows 10 / 11** (x64)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)

---

## Quick start

```bash
# 1. Clone the repo
git clone https://github.com/Silmaril2109/DesktopDrawers.git
cd DesktopDrawers

# 2. Install dependencies
npm install

# 3. Run in development mode
npm start
```

The overlay appears immediately. A tray icon shows in your system tray.

---

## Build a distributable installer

```bash
npm run build
```

The installer (`DesktopDrawer Setup.exe`) is written to the `release/` folder.

---

## How to use

1. **Run the app** — the overlay loads invisibly over your desktop.
2. **Move files into drawers** — drop any file or folder into `~/Documents/DesktopDrawer/Left` or `~/Documents/DesktopDrawer/Right` (or drag them directly onto a drawer handle while it's open).
3. **Hover a screen edge** — move your cursor to the far left or far right edge and hold briefly. The drawer slides open.
4. **Open a file** — click it. It opens with its default Windows application.
5. **Move a file back to the desktop** — drag it out of the drawer and drop it on the desktop area.
6. **Toggle desktop icons** — click the eye button in the drawer header.
7. **Adjust hover delay / colors** — right-click the tray icon.

---

## Project structure

```
DesktopDrawers/
├── electron/
│   ├── main.js          # Electron main process (window, IPC, file ops, tray)
│   └── preload.js       # Context bridge — exposes safe APIs to the renderer
├── src/
│   ├── App.jsx          # Root component — drawer state, mouse tracking, drag/drop
│   ├── index.jsx        # React entry point
│   ├── index.css        # Tailwind base styles
│   └── components/
│       ├── Drawer.jsx   # Animated drawer panel + file list
│       └── FileItem.jsx # Individual file/folder row
├── index.html           # Vite HTML shell
├── vite.config.js       # Vite config
├── tailwind.config.js
└── postcss.config.js
```

---

## Configuration

Settings are stored automatically in Electron's userData directory:
- **Windows:** `C:\Users\<YOU>\AppData\Roaming\DesktopDrawer\drawer-config.json`

You can change the hover delay and drawer colors from the tray menu — no manual editing needed.

---

## Tech stack

| Layer | Library |
|---|---|
| Desktop shell | [Electron 30](https://www.electronjs.org/) |
| UI | [React 18](https://react.dev/) |
| Styling | [TailwindCSS 3](https://tailwindcss.com/) |
| Animation | [Framer Motion 11](https://www.framer.com/motion/) |
| Bundler | [Vite 5](https://vitejs.dev/) |

---

## License

MIT
