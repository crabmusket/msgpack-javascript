import assert from "assert";
import { encode, decode, Encoder, ExtensionCodec, ExtData, decodeAsync } from "../src";
import { typedArrays } from "../example/typed-arrays/plugin";

describe("ExtensionCodecPlugin", () => {
  context("custom extension plugin", () => {
    const extensionCodec = new ExtensionCodec();

    // Set<T>
    extensionCodec.registerPlugin({
      type: 0,
      encode: (encoder: Encoder, depth: number, object: unknown): boolean => {
        if (object instanceof Set) {
          // This uses the plugin mechanism in a pointless way: simply encoding an extension
          // the same as it would have been normally.
          const extData = encode([...object]);
          encoder["encodeExtension"](new ExtData(0, extData));
          return true;
        }
        return false;
      },
      decode: (data: Uint8Array) => {
        const array = decode(data) as Array<unknown>;
        return new Set(array);
      },
    });

    it("encodes and decodes custom data types (synchronously)", () => {
      const set = new Set([1, 2, 3]);
      const encoded = encode([set], { extensionCodec });
      assert.deepStrictEqual(decode(encoded, { extensionCodec }), [set]);
    });

    it("encodes and decodes custom data types (asynchronously)", async () => {
      const set = new Set([1, 2, 3]);
      const encoded = encode([set], { extensionCodec });
      const createStream = async function* () {
        yield encoded;
      };
      assert.deepStrictEqual(await decodeAsync(createStream(), { extensionCodec }), [set]);
    });
  });

  context("typed-arrays-plugin example", () => {
    const extensionCodec = new ExtensionCodec();
    extensionCodec.registerPlugin(typedArrays({type: 1}));

    it("encodes and decodes a Float32Array (synchronously)", () => {
      const floatArray = new Float32Array([1, 2, 3, 4, 5]);
      const encoded = encode({ floatArray }, { extensionCodec });
      assert.deepStrictEqual(decode(encoded, { extensionCodec }), { floatArray });
    });
  });
});