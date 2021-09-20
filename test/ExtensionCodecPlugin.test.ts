import assert from "assert";
import { encode, decode, Encoder, ExtensionCodec, ExtData, decodeAsync } from "../src";
import { typedArrays } from "../example/typed-arrays/plugin";

describe("ExtensionCodecPlugin", () => {
  context("typed-arrays-plugin example", () => {
    const extensionCodec = new ExtensionCodec();
    extensionCodec.register(typedArrays({type: 1}));

    it("encodes and decodes a Float32Array (synchronously)", () => {
      const floatArray = new Float32Array([1, 2, 3, 4, 5]);
      const encoded = encode({ floatArray }, { extensionCodec });
      assert.deepStrictEqual(decode(encoded, { extensionCodec }), { floatArray });
    });
  });
});