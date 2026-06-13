## 2025-05-14 - [Keyboard Accessibility for Custom UI]
**Learning:** Custom UI elements built with `div` or `span` are completely invisible to keyboard navigation and screen readers by default. To make them accessible, they require `tabIndex="0"`, an appropriate `role` (e.g., "button"), and manual event listeners for "Enter" and "Space" keys.
**Action:** Always check for interactive `div` elements and ensure they have the necessary ARIA attributes and keyboard listeners. Use `:focus-visible` to provide non-intrusive focus indicators for keyboard users.
