# MessagePack typed arrays

This is an extension to MessagePack which provides "native" support for JS's TypedArray family.

## Why?

The official JS library can already handle TypedArrays by serialising them as binary data, but this has two disadvantages:

1. You must know, and manually construct, the correct type of array from raw binary data after deserialising.
2. The data is unaligned, which may require copying it into a new array before using it.

Number 2 is the main reason I was inspired to write an extension to handle these types; I didn't want to give up on the possibility of zero-copy decoding.

## Spec

`data` has some internal layout which looks like the following:

```
+--------+--------+========+========+
| artype |AAAAAAAA| align  |  vals  |
+--------+--------+========+========+
```

Where:

- `artype` is an identifier for the type of array that is stored
- `AAAAAAAA` is an 8-bit unsigned integer
- `align` is a number of bytes equal to the value of `AAAAAAAA`, all of which contain 0
- `vals` is the binary content of the TypedArray

The value of `AAAAAAAA`, and therefore the number of bytes in the `align` segment, is determined so that `cont` begins on a byte offset from the _beginning of the encoded MessagePack object_ which correctly aligns `cont` for efficient access.

If `AAAAAAAA` is 0, then there are no `align` bytes, and `vals` begins immediately after.

Note that the length of `data`, and therefore the value of `YYYYYYYY_YYYYYYYY` includes _all_ of `artype`, `AAAAAAAA`, `align` and `vals`.

## Example

A Float32Array containing 10 values will have a `data` size starting at 42 bytes if there is no alignment:

- 1 byte of `artype` = `0x??`
- 1 byte of `AAAAAAAA` = 0
- 0 bytes of `align`
- 40 bytes of `vals`

A Float32Array should be aligned on 4-byte boundaries, so there may need to be up to 3 bytes of padding.
In that case, the total size of `data` woulb become so this may increase to 45 bytes:

- 1 byte of `artype` = `0x??`
- 1 byte of `AAAAAAAA` = 3
- 3 bytes of `align`
- 40 bytes of `vals`

Since the extension array is wrapped with its own header, there is some additional structure before this content.

See the [MessagePack spec for extensions](https://github.com/msgpack/msgpack/blob/master/spec.md#ext-format-family).
The content of a TypedArray object is inserted after the extension header.
For example, an extension where the size of the encoded array is up to (2^8)-1 bytes will be laid out like this:

```
+--------+--------+--------+========+
|  0xc7  |XXXXXXXX|  type  |  data  |
+--------+--------+--------+========+
```

Where:

- `0xc8` is the `ext 16` header
- `XXXXXXXX` is a 8-bit unsigned integer which represents the length of `data` in bytes
- `type` is the extension type number 0-127

So to put the entire example of a 10-entry Float32Array together, it would be represented as:

```
+--------+--------+--------+--------+--------+========+========+
|  0xc7  |  0x2D  |  type  |  0x??  |  0x03  |3 zeros |  vals  |
+--------+--------+--------+--------+--------+========+========+
```

Where:

- `0xc7` is the MessagePack type for `ext 8`
- `0x2D` is 45, the length of the TypedArray payload described above
- `type` is the extension type number
- `0x??` is the `artype` number for Float32Array
- `0x03` is the number of alignment bytes
- 3 zeros are required for alignment
- `vals` contains the actual floating-point data
