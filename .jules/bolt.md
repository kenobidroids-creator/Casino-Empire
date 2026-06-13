
## 2025-05-15 - [Rendering: CanvasPattern vs Procedural Loops]
**Learning:** Procedural background rendering using nested loops and hashing (e.g., grass blades) causes massive overhead in the render loop. On a standard 1080p screen, tens of thousands of `fillRect` calls were being made per frame.
**Action:** Replace high-frequency procedural drawing with cached `CanvasPattern` objects. Use `pattern.setTransform(new DOMMatrix().translate(cx, cy))` to keep patterns world-locked during camera movement, maintaining the intended visual effect with near-zero per-frame CPU cost.
