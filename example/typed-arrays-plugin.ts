import type { Encoder } from "../src/Encoder";
import { ensureUint8Array } from "../src/utils/typedArrays";

export function typedArrays<C>({type}: {type: number}) {
  const TypedArray = Object.getPrototypeOf(Int8Array);

  const arrayConstructors = {
    Uint8Array,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    BigUint64Array,
    BigInt64Array,
    Float32Array,
    Float64Array,
  };

  const arrayTypeNameToNumber: Map<string, number> = new Map([
    ["Uint8Array", 1],
    ["Int8Array", 255-1],
    ["Uint16Array", 2],
    ["Int16Array", 255-2],
    ["Uint32Array", 3],
    ["Int32Array", 255-3],
    ["BigUint64Array", 4],
    ["BigInt64Array", 255-4],
    ["Float32Array", 9],
    ["Float64Array", 10],
  ]);

  const arrayTypeNumberToName: Map<number, string> = new Map(
    [...arrayTypeNameToNumber.entries()]
    .map(entry => entry.reverse() as [number, string])
  );

  const arrayHeaderSize = 2;

  return {
    type,

    encode(encoder: Encoder, depth: number, object: unknown, context: C) {
      if (!(object instanceof TypedArray)) {
        return false;
      }

      const array = object as ArrayBufferView;
      const alignment = (array as any).constructor.BYTES_PER_ELEMENT;
      const arrayType = arrayTypeNameToNumber.get((array as any).constructor.name)!;

      // Always use ext32 to make things simpler for now
      const extHeaderSize = 6;
      const unalignedDataStart = encoder["pos"] + extHeaderSize + arrayHeaderSize;
      const alignBytes = alignment - (unalignedDataStart % alignment);
      const extDataSize = arrayHeaderSize + alignBytes + array.buffer.byteLength;

      // Ext32 header
      encoder["writeU8"](0xc9);
      encoder["writeU32"](extDataSize);
      encoder["writeU8"](type);

      // TypedArray header
      encoder["writeU8"](arrayType); // TODO: map typedarray types
      encoder["writeU8"](alignBytes);
      for (let i = 0; i < alignBytes; i += 1) {
        encoder["writeU8"](0);
      }

      const bytes = ensureUint8Array(array);
      encoder["writeU8a"](bytes);

      return true;
    },

    decode(data: Uint8Array, extensionType: number, context: C) {
      if (extensionType !== type) {
        return null;
      }

      const arrayType = data[0]!;
      const alignBytes = data[1]!;

      const ctorName = arrayTypeNumberToName.get(arrayType)!;
      const ctor = (arrayConstructors as any)[ctorName] as new (...args: any[]) => ArrayBufferView;
      const alignment = (ctor as any).BYTES_PER_ELEMENT;

      return new ctor(
        data.buffer,
        data.byteOffset + arrayHeaderSize + alignBytes,
        (data.length - alignBytes - 2) / alignment
      );
    },
  };
}