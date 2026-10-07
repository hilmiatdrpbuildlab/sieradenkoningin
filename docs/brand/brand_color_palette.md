# Brand Color Palette: Sieradenkoningin Jewelry

Based on the brand identity board, the color scheme revolves around deep, luxurious reds and browns, paired with warm, elegant neutrals. This creates a "moody luxury" aesthetic that feels timeless and empowering. 

Here is the extracted color palette translated into web-ready formats and UI guidelines.

## 🎨 Core Color Palette

| Color Swatch | Name | Hex Code | RGB | Suggested UI Role |
| :--- | :--- | :--- | :--- | :--- |
| 🟤 | **Royal Burgundy** | `#391617` | `rgb(57, 22, 23)` | Primary Brand Color, Hero Backgrounds, Footer, Primary Buttons. |
| 🟤 | **Dark Espresso** | `#492520` | `rgb(73, 37, 32)` | Secondary Color, Primary Text (on light backgrounds), Borders, Shadows. |
| 🟠 | **Warm Cognac** | `#875543` | `rgb(135, 85, 67)` | Accent Color, Icons, Hover States, Secondary Buttons. |
| 🟡 | **Soft Camel** | `#B89985` | `rgb(184, 153, 133)` | Secondary Backgrounds, Product Cards, Muted Text. |
| ⚪ | **Luxurious Cream** | `#EBE1D8` | `rgb(235, 225, 216)` | Main Website Background, Surface Color, Text (on dark backgrounds). |

---

## 💻 Web UI Application Guide

To maintain the "Accessible luxury" and "Feminine" keywords from your brand board, apply the colors strategically across your e-commerce layout:

### 1. Backgrounds & Surfaces
*   **Main Body Background:** Use **Luxurious Cream (`#EBE1D8`)**. This keeps the shop looking clean and legible while retaining a warm, high-end feel unlike stark white.
*   **Hero Sections & Banners:** Use **Royal Burgundy (`#391617`)** paired with large, elegant imagery. 
*   **Product Cards / Subtle Callouts:** You can use **Soft Camel (`#B89985`)** at a lower opacity (e.g., 20%) or keep them Cream with a subtle **Dark Espresso (`#492520`)** border.

### 2. Typography
*   *Note on Fonts: Pair with Playfair Display (Headings) and Montserrat (Body) as per your brand board.*
*   **Primary Text (Headings & Body on light bg):** **Dark Espresso (`#492520`)**. Avoid pure black, as the deep brown maintains the warm, cohesive aesthetic.
*   **Light Text (On dark backgrounds):** Use **Luxurious Cream (`#EBE1D8`)** or pure white (`#FFFFFF`) for maximum readability.
*   **Muted/Secondary Text (Dates, minor labels):** **Warm Cognac (`#875543`)**.

### 3. Interactive Elements (Buttons & Links)
*   **Primary CTA Buttons (e.g., "Add to Cart", "Shop Now"):** **Royal Burgundy (`#391617`)** background with Cream text.
*   **Button Hover States:** Lighten the Burgundy slightly, or transition to **Dark Espresso (`#492520`)**.
*   **Text Links:** **Warm Cognac (`#875543`)** with a subtle underline.

### 4. Accents & Icons
*   Use **Warm Cognac (`#875543`)** or a subtle gold metallic gradient for icons (like the crown logo, cart icon, or category icons shown in your mood board).

---

## 🛠️ CSS Variables Implementation

Here is a quick snippet you can drop into your CSS to start using these colors immediately:

```css
:root {
  /* Brand Colors */
  --color-royal-burgundy: #391617;
  --color-dark-espresso: #492520;
  --color-warm-cognac: #875543;
  --color-soft-camel: #B89985;
  --color-luxurious-cream: #EBE1D8;

  /* UI Assignments */
  --bg-primary: var(--color-luxurious-cream);
  --bg-inverted: var(--color-royal-burgundy);
  --text-primary: var(--color-dark-espresso);
  --text-inverted: var(--color-luxurious-cream);
  --accent-color: var(--color-warm-cognac);
  --border-color: var(--color-soft-camel);
}
```