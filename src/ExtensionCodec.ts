// ExtensionCodec to handle MessagePack extensions

import { ExtData } from "./ExtData";
import { timestampExtension } from "./timestamp";
import type { Encoder } from "./Encoder";

export type ExtensionDecoderType<ContextType> = (
  data: Uint8Array,
  extensionType: number,
  context: ContextType,
) => unknown;

export type ExtensionEncoderType<ContextType> = (input: unknown, context: ContextType) => Uint8Array | null;

export type ExtensionEncoderPluginType<ContextType> = (encoder: Encoder<ContextType>, depth: number, input: unknown, context: ContextType) => boolean;

// immutable interfce to ExtensionCodec
export type ExtensionCodecType<ContextType> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __brand?: ContextType;
  tryToEncode(object: unknown, context: ContextType): ExtData | null;
  tryToEncodePlugin(encoder: Encoder<ContextType>, depth: number, object: unknown, context: ContextType): boolean;
  decode(data: Uint8Array, extType: number, context: ContextType): unknown;
};

export class ExtensionCodec<ContextType = undefined> implements ExtensionCodecType<ContextType> {
  public static readonly defaultCodec: ExtensionCodecType<undefined> = new ExtensionCodec();

  // ensures ExtensionCodecType<X> matches ExtensionCodec<X>
  // this will make type errors a lot more clear
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __brand?: ContextType;

  // built-in extensions
  private readonly builtInEncoders: Array<ExtensionEncoderType<ContextType> | undefined | null> = [];
  private readonly builtInDecoders: Array<ExtensionDecoderType<ContextType> | undefined | null> = [];

  // custom extensions
  private readonly encoders: Array<ExtensionEncoderType<ContextType> | undefined | null> = [];
  private readonly decoders: Array<ExtensionDecoderType<ContextType> | undefined | null> = [];
  private readonly rawEncoders: Array<ExtensionEncoderPluginType<ContextType> | undefined | null> = [];

  public constructor() {
    this.register(timestampExtension);
  }

  public register({
    type,
    encode,
    decode,
  }: {
    type: number;
    encode: ExtensionEncoderType<ContextType>;
    decode: ExtensionDecoderType<ContextType>;
  }): void {
    if (type >= 0) {
      // custom extensions
      this.encoders[type] = encode;
      this.decoders[type] = decode;
    } else {
      // built-in extensions
      const index = 1 + type;
      this.builtInEncoders[index] = encode;
      this.builtInDecoders[index] = decode;
    }
  }

  public registerPlugin({
    type,
    encode,
    decode,
  }: {
    type: number;
    encode: ExtensionEncoderPluginType<ContextType>;
    decode: ExtensionDecoderType<ContextType>;
  }): void {
    if (type >= 0) {
      // custom extensions
      this.rawEncoders[type] = encode;
      this.decoders[type] = decode;
    } else {
      throw new Error("cannot register plugin for builtin type");
    }
  }

  public tryToEncode(object: unknown, context: ContextType): ExtData | null {
    // built-in extensions
    for (let i = 0; i < this.builtInEncoders.length; i++) {
      const encodeExt = this.builtInEncoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = -1 - i;
          return new ExtData(type, data);
        }
      }
    }

    // custom extensions
    for (let i = 0; i < this.encoders.length; i++) {
      const encodeExt = this.encoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = i;
          return new ExtData(type, data);
        }
      }
    }

    if (object instanceof ExtData) {
      // to keep ExtData as is
      return object;
    }
    return null;
  }

  public tryToEncodePlugin(encoder: Encoder<ContextType>, depth: number, object: unknown, context: ContextType): boolean {
    for (let i = 0; i < this.rawEncoders.length; i++) {
      const encodeExt = this.rawEncoders[i];
      if (encodeExt != null) {
        const accepted = encodeExt(encoder, depth, object, context);
        if (accepted) {
          return true;
        }
      }
    }

    return false;
  }

  public decode(data: Uint8Array, type: number, context: ContextType): unknown {
    const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
    if (decodeExt) {
      return decodeExt(data, type, context);
    } else {
      // decode() does not fail, returns ExtData instead.
      return new ExtData(type, data);
    }
  }
}
