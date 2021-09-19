// ts-node example/typed-array-plugin-example.ts

import { encode, decode, ExtensionCodec } from "../src";
import { typedArrays } from "../example/typed-arrays-plugin";

const extensionCodec = new ExtensionCodec();
extensionCodec.registerPlugin(typedArrays({ type: 1 }));

const int16Array = new Int16Array([-4, 1, 5]);
const float32Array = new Float32Array([1, -2, 3, 1e-9, 5]);
console.log("Object to encode:");
console.log({ int16Array, float32Array });

const encoded = encode({ int16Array, float32Array }, { extensionCodec });
console.log("\n\nRaw encoded data:");
console.log(encoded);

const decoded = decode(encoded, { extensionCodec });
console.log("\n\nDecoded object:");
console.log(decoded);