import "react-native-get-random-values";
import { Buffer } from "@craftzdog/react-native-buffer";

if (typeof globalThis.Buffer === "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

if (typeof globalThis.process === "undefined") {
  (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} };
}
