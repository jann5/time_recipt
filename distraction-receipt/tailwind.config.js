/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "inverse-surface": "#313030",
        "surface-tint": "#5f5e5e",
        "tertiary-fixed-dim": "#cac6c2",
        "primary-fixed-dim": "#c8c6c6",
        "error": "#ba1a1a",
        "secondary-container": "#e0e0dc",
        "outline-variant": "#c4c7c7",
        "surface-container-high": "#ebe7e7",
        "on-error-container": "#93000a",
        "surface-container-low": "#f7f3f2",
        "on-primary-container": "#9c9b9b",
        "secondary-fixed-dim": "#c7c7c3",
        "on-secondary": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "on-tertiary-fixed": "#1d1b1a",
        "tertiary-fixed": "#e7e1de",
        "on-primary-fixed": "#1b1c1c",
        "primary-fixed": "#e4e2e1",
        "on-surface": "#1c1b1b",
        "background": "#fdf8f8",
        "secondary-fixed": "#e3e2df",
        "primary-container": "#333333",
        "surface-dim": "#ddd9d8",
        "on-tertiary": "#ffffff",
        "surface-bright": "#fdf8f8",
        "on-primary-fixed-variant": "#474747",
        "on-tertiary-container": "#9f9b98",
        "secondary": "#5e5f5c",
        "on-surface-variant": "#444748",
        "surface-variant": "#e5e2e1",
        "primary": "#1e1e1e",
        "error-container": "#ffdad6",
        "surface-container-highest": "#e5e2e1",
        "on-background": "#1c1b1b",
        "on-secondary-fixed-variant": "#464744",
        "on-secondary-container": "#626360",
        "outline": "#747878",
        "surface": "#fdf8f8",
        "inverse-primary": "#c8c6c6",
        "surface-container": "#f1edec",
        "on-secondary-fixed": "#1b1c1a",
        "inverse-on-surface": "#f4f0ef",
        "tertiary": "#201e1c",
        "on-tertiary-fixed-variant": "#494644",
        "on-primary": "#ffffff",
        "on-error": "#ffffff",
        "tertiary-container": "#353331"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      spacing: {
        "element-gap": "16px",
        "item-padding-y": "6px",
        unit: "4px",
        "receipt-margin": "8px",
        "container-padding": "12px"
      },
      fontFamily: {
        "receipt-data": ["Courier Prime", "monospace"],
        "receipt-body": ["Courier Prime", "monospace"],
        "receipt-header": ["Courier Prime", "monospace"],
        "nav-title": ["Inter", "sans-serif"],
        "ui-label": ["Inter", "sans-serif"]
      },
      fontSize: {
        "receipt-data": ["11px", { lineHeight: "14px", letterSpacing: "-0.01em", fontWeight: "400" }],
        "receipt-body": ["12px", { lineHeight: "18px", fontWeight: "400" }],
        "receipt-header": ["16px", { lineHeight: "20px", fontWeight: "700" }],
        "nav-title": ["13px", { lineHeight: "16px", fontWeight: "600" }],
        "ui-label": ["11px", { lineHeight: "12px", fontWeight: "500" }]
      }
    },
  },
  plugins: [],
}