// LED + Round face renderers. Timings mirror globals.css (.led-*, .round-face-*) in hue-switch-console.
const h = (...a) => window.React.createElement(...a);
const RF = { bg: "#0d0d10", ink: "#f2f2f0", mute: "#8e8e96", accent: "#ff9f1c", error: "#ff5a5a", yellow: "#ffe000" };
const SH = "0 6px 14px rgb(0 0 0 / 35%)";

export const KEYFRAMES = `
@keyframes led-fast{0%{opacity:1}50%{opacity:0}}
@keyframes led-burst-2{0%{opacity:1}5.556%{opacity:0}16.667%{opacity:1}22.222%{opacity:0}}
@keyframes led-burst-3{0%{opacity:1}4.762%{opacity:0}14.286%{opacity:1}19.048%{opacity:0}28.571%{opacity:1}33.333%{opacity:0}}
@keyframes led-burst-4{0%{opacity:1}4.167%{opacity:0}12.5%{opacity:1}16.667%{opacity:0}25%{opacity:1}29.167%{opacity:0}37.5%{opacity:1}41.667%{opacity:0}}
@keyframes led-heart{0%{opacity:1}2.667%{opacity:0}}
@keyframes rf-loading{0%{box-shadow:0 0 0 2px #7a4a10,${SH}}50%{box-shadow:0 0 0 2px ${RF.mute},${SH}}}
@keyframes rf-pairing{0%{box-shadow:0 0 0 2px ${RF.accent},${SH}}50%{box-shadow:0 0 0 2px ${RF.yellow},${SH}}}
@keyframes rf-flash{0%{box-shadow:0 0 0 2px ${RF.error},${SH}}50%{box-shadow:${SH}}}
`;

const LED_ANIM = {
  fast: "led-fast 500ms", "burst-2": "led-burst-2 1800ms", "burst-3": "led-burst-3 2100ms",
  "burst-4": "led-burst-4 2400ms", heart: "led-heart 3000ms",
};

export function led(pattern, size = 14) {
  const a = LED_ANIM[pattern];
  return h("span", {
    role: "img",
    style: { position: "relative", display: "block", width: size, height: size, borderRadius: "50%", background: "#3a2410", boxShadow: "inset 0 0 0 1px rgb(255 140 40 / 25%)", flexShrink: 0 },
  }, h("span", {
    style: { position: "absolute", inset: 0, borderRadius: "50%", background: "#ff8a1f", boxShadow: `0 0 ${8 * size / 14}px ${2 * size / 14}px rgb(255 138 31 / 70%)`, opacity: pattern === "solid" ? 1 : 0, animation: a ? `${a} step-end infinite` : "none" },
  }));
}

const RING = { wifi: RF.mute, nowifi: RF.error, loading: RF.mute, pairing: RF.accent, nobridge: RF.error, empty: RF.mute, tokenfull: RF.error };
const FACE_ANIM = { loading: "rf-loading 800ms step-end infinite", pairing: "rf-pairing 560ms step-end infinite", flash: "rf-flash 1400ms step-end infinite" };

export function face(kind, size = 88, version = "0.5.27") {
  const k = size / 88;
  const ready = kind === "ready" || kind === "token" || kind === "flash";
  const TEXT = {
    wifi: ["Wi-Fi...", version], nowifi: ["No Wi-Fi", "Plug the antenna"], loading: ["Loading...", "Connecting"],
    pairing: ["Press Bridge button", "on the Hue Bridge"], nobridge: ["No Bridge", "same LAN as Bridge"],
    tokenfull: ["Token rejected", "Set a new one in Devices"],
  };
  const line = (t) => h("span", { key: "l", style: { fontSize: 10 * k, fontWeight: 600 } }, t);
  const sub = (t, c) => h("span", { key: "s", style: { position: "relative", fontSize: 8 * k, color: c || RF.mute } }, t);
  let kids;
  if (TEXT[kind]) kids = [line(TEXT[kind][0]), TEXT[kind][1] ? sub(TEXT[kind][1]) : null];
  else if (kind === "empty") kids = [h("span", { key: "n", style: { position: "relative", fontSize: 11 * k, fontWeight: 700 } }, "Page")];
  else {
    const m = `radial-gradient(farthest-side, transparent calc(100% - ${4 * k}px), #000 calc(100% - ${3.5 * k}px))`;
    kids = [
      h("span", { key: "r", style: { position: "absolute", inset: 2 * k, borderRadius: "50%", background: `conic-gradient(from 225deg, ${RF.accent} 0 180deg, #3a3a42 180deg 270deg, transparent 270deg 360deg)`, WebkitMask: m, mask: m } }),
      h("span", { key: "d", style: { position: "absolute", inset: 10 * k, borderRadius: "50%", background: "#6b3f0e" } }),
      h("span", { key: "n", style: { position: "relative", fontSize: 11 * k, fontWeight: 700 } }, "Living room"),
      sub("Relax", "#ffe2b8"),
      h("span", { key: "o", style: { position: "absolute", bottom: 16 * k, display: "flex", gap: 3 * k } },
        [0, 1, 2].map((i) => h("i", { key: i, style: { width: 3 * k, height: 3 * k, borderRadius: "50%", background: i === 0 ? RF.ink : "rgb(255 255 255 / 35%)" } }))),
      kind === "token" ? h("span", { key: "t", style: { position: "absolute", bottom: 4 * k, width: 4 * k, height: 4 * k, borderRadius: "50%", background: RF.error } }) : null,
    ];
  }
  return h("div", {
    role: "img",
    style: {
      position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 2 * k, width: size, height: size, flexShrink: 0, padding: 14 * k, boxSizing: "border-box", borderRadius: "50%",
      background: RF.bg, boxShadow: ready ? SH : `0 0 0 2px ${RING[kind]}, ${SH}`, color: RF.ink,
      fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif", textAlign: "center", lineHeight: 1.15,
      animation: FACE_ANIM[kind] || "none",
    },
  }, ...kids);
}
