# MessagePack typed arrays

This is an extension to MessagePack which provides "native" support for JS's TypedArray family.

## Why?

The official JS library can already handle TypedArrays by serialising them as binary data, but this has two disadvantages:

1. You must know, and manually construct, the correct type of array from raw binary data after deserialising.
2. The data is unaligned, which may require copying it into a new array before using it. (See [about alignment](#about-alignment).)

Number 2 is the main reason I was inspired to write an extension to handle these types; I didn't want to give up on the possibility of zero-copy decoding.

## Spec

TypedArray support is implemented as a MessagePack [extension](https://github.com/msgpack/msgpack/blob/master/spec.md#ext-format-family).
Extensions are encoded as a header followed by an opaque `data` array.

This extension fills `data` with an internal layout which looks like the following:

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

The value of `AAAAAAAA`, and therefore the number of bytes in the `align` segment, is determined so that `vals` begins on a byte offset from the _beginning of the encoded MessagePack object_ which correctly aligns `vals` for efficient access.

If `AAAAAAAA` is 0, then there are no `align` bytes, and `vals` begins immediately after.

Note that the length of `data`, and therefore the value of `YYYYYYYY_YYYYYYYY` includes _all_ of `artype`, `AAAAAAAA`, `align` and `vals`.

### Array types

| Constructor | `artype` decimal | `artype` hex |
| - | - | - |
| Uint8Array | 1 | 0x01 |
| Int8Array | -1 | 0xfe |
| Uint16Array | 2 | 0x02 |
| Int16Array | -2 | 0xfd |
| Uint32Array | 3 | 0x03 |
| Int32Array | -3 | 0xfc |
| BigUint64Array | 4 | 0x04 |
| BigInt64Array | -4 | 0xfb |
| Float32Array | 9 | 0x09 |
| Float64Array | 10 | 0x0a |

## Example

A Float32Array containing 10 values will have a `data` size starting at 42 bytes if there is no alignment:

- 1 byte of `artype` = `0x09`
- 1 byte of `AAAAAAAA` = 0
- 0 bytes of `align`
- 40 bytes of `vals`

A Float32Array should be aligned on 4-byte boundaries, so there may need to be up to 3 bytes of padding.
In that case, the total size of `data` woulb become so this may increase to 45 bytes:

- 1 byte of `artype` = `0x09`
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
|  0xc7  |  0x2D  |  type  |  0x09  |  0x03  |3 zeros |  vals  |
+--------+--------+--------+--------+--------+========+========+
```

Where:

- `0xc7` is the MessagePack type for `ext 8`
- `0x2D` is 45, the length of the TypedArray payload described above
- `type` is the extension type number
- `0x09` is the `artype` number for Float32Array
- `0x03` is the number of alignment bytes
- 3 zeros are required for alignment
- `vals` contains the actual floating-point data

## About alignment

This [SO question](https://stackoverflow.com/q/7372124) demonstrates the problem:

```js
new Float32Array(buffer, 31, 6);
```

will throw an exception.
When creating any TypedArray, the offset (2nd argument) must be a multiple of the byte length of the element type.
In the case of a Float32Array, 31 is not a multiple of 4 so the creation fails.

As the top answer states,

> Some architectures do not allow unaligned word accesses, and there are performance penalties on architectures that do allow it such as x86 (though some instructions must be aligned).

[This post](http://www.songho.ca/misc/alignment/dataalign.html) contains more details.
So the typical approach if you receive some data from a MessagePack buffer which you want to access as a TypedArray is to copy the data out into a new buffer entirely.
Because new buffers are correctly aligned (e.g. their first byte falls on a [max_align_t](https://en.cppreference.com/w/c/types/max_align_t) memory address), and the offset will be 0 for the new buffer, your access will work fine.