import type { Encoder } from "./Encoder";

/**
 * ExtData is used to handle Extension Types that are not registered to ExtensionCodec.
 */
export class ExtData {
  constructor(readonly type: number, readonly data: Uint8Array) {}

  write<ContextType>(encoder: Encoder<ContextType>, depth: number, source: unknown) {
    encoder["encodeExtension"](this);
  }
}