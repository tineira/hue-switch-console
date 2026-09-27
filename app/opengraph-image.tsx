import { ImageResponse } from "next/og";

// Link preview for every page (GitHub, X, chat apps). Colors are the Ember theme from globals.css.
export const alt = "Hue Switch Console: Wi-Fi wall switches for Philips Hue";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: "#14110f",
          color: "#f4eee6",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>Hue Switch Console</div>
          <div style={{ marginTop: 20, fontSize: 38, color: "#a89a8c" }}>
            Wi-Fi wall switches for Philips Hue, set up from your browser.
          </div>
          <div style={{ marginTop: 48, fontSize: 28, color: "#e07a3d" }}>
            hue.tineira.com · free and open source
          </div>
        </div>
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: 150,
            border: "14px solid #3a322c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 75,
              background: "#e07a3d",
              boxShadow: "0 0 90px 30px rgba(224, 122, 61, 0.45)",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
