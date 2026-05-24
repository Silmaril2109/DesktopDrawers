Build a complete working Windows desktop overlay application called DesktopDrawer.

The app should be a SINGLE-SHOT prototype build focused on functionality and visual immersion, NOT enterprise architecture.

Use:
- Electron
- React
- TailwindCSS
- Framer Motion

Do NOT over-engineer.
Keep the code simple, direct, readable, and runnable immediately.

GOAL:
Transform the Windows desktop into an immersive cinematic workspace where files and folders are hidden inside hover-based edge drawers instead of cluttering the desktop.

CORE EXPERIENCE:
- The wallpaper remains visually dominant.
- Only thin drawer handles are visible on screen edges.
- Hovering over a handle smoothly opens a drawer panel.
- Files and folders can be opened normally.
- Users can drag files into and out of drawers.
- Desktop remains usable normally.

FEATURES REQUIRED:

1. TRANSPARENT DESKTOP OVERLAY
- Frameless transparent Electron window
- Covers entire desktop
- Always above wallpaper but below normal windows
- Ignore taskbar

2. EDGE DRAWERS
Create:
- left drawer
- right drawer
- top drawer

Behavior:
- tiny visible edge handles
- hover to open
- smooth cinematic animation
- auto-hide on mouse leave

3. FILE DISPLAY
Each drawer displays:
- icons
- filenames
- folders
- shortcuts

Use actual filesystem data.

4. REAL DESKTOP INTEGRATION
Monitor:
C:/Users/[USERNAME]/Desktop

Read desktop files dynamically.

Allow:
- opening files
- opening folders
- drag/drop movement

5. DESKTOP CLEAN MODE
Add a toggle button:
- hide Windows desktop icons
- show Windows desktop icons

6. DRAWER ORGANIZATION
Assign folders manually:
- left
- right
- top

Store assignments in:
drawer-config.json

7. VISUAL STYLE
Theme:
- dark medieval ambient
- blue-black palette
- subtle candle glow
- immersive
- minimal
- atmospheric

Avoid:
- neon cyberpunk
- glassmorphism
- bright white UI

8. UI DETAILS
- soft fade animations
- subtle blur
- metallic dark panels
- glowing edge handles
- smooth motion

9. DRAG AND DROP
Support:
- dragging desktop files into drawers
- dragging between drawers
- dragging out back to desktop

10. SIMPLE CODEBASE
Keep everything simple:
- minimal files
- no excessive abstraction
- no unnecessary architecture

11. STARTUP
Provide:
- package.json
- all install commands
- runnable immediately with npm install and npm start

12. IMPORTANT
This should feel like:
- a game inventory system
- a cinematic desktop shell
- an ambient workstation HUD

NOT:
- a generic launcher
- a normal file explorer
- a productivity dashboard

Generate the FULL project immediately.
Do not explain theory first.
Create all required files and code directly.