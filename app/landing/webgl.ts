// Whether this browser can create a WebGL context. The landing page's 3D islands check this
// before loading three.js and fall back to static layouts when it is false.
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
