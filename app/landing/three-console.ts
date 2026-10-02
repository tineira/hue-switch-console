import { setConsoleFunction } from "three";

// On Windows, Chrome runs WebGL on Direct3D (ANGLE), whose HLSL compiler warns when it folds
// float constants ("warning X4122: sum of 1 and -1.5e-17 cannot be represented accurately").
// The program links fine; three.js just prints any non-empty link log. Drop that one message
// and pass everything else through unchanged. Imported for its side effect by each renderer.
const X4122_ONLY = /^(\s*\(\d+,[\d-]+\): warning X4122:[^\n]*\n?)+$/;

setConsoleFunction((type: "log" | "warn" | "error", message: string, ...params: unknown[]) => {
  if (
    type === "warn" &&
    message === "THREE.WebGLProgram: Program Info Log:" &&
    typeof params[0] === "string" &&
    X4122_ONLY.test(params[0].trim())
  ) {
    return;
  }
  console[type](message, ...params);
});
