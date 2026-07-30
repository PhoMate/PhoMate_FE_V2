// 순수 TypeScript JPEG EXIF 파서 — 외부 라이브러리 없음
// DateTimeOriginal(0x9003) > DateTimeDigitized(0x9004) > DateTime(0x0132) 순서로 우선순위 적용

export async function extractExifDateMs(file: File): Promise<number | null> {
    if (!isJpeg(file)) return null;
    try {
        const buffer = await file.slice(0, 131072).arrayBuffer(); // 128KB면 EXIF 충분
        return parseJpegExifDate(new DataView(buffer));
    } catch {
        return null;
    }
}

function isJpeg(file: File): boolean {
    return file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
}

function parseJpegExifDate(view: DataView): number | null {
    if (view.byteLength < 4) return null;
    if (view.getUint8(0) !== 0xFF || view.getUint8(1) !== 0xD8) return null;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
        if (view.getUint8(offset) !== 0xFF) break;
        const marker = view.getUint8(offset + 1);
        const segLen = view.getUint16(offset + 2); // JPEG 세그먼트 길이는 항상 big-endian

        if (marker === 0xDA) break; // Start of Scan — 이미지 데이터 시작

        if (marker === 0xE1 && offset + 10 <= view.byteLength) {
            // "Exif\0\0" 시그니처 확인
            if (
                view.getUint8(offset + 4) === 0x45 &&
                view.getUint8(offset + 5) === 0x78 &&
                view.getUint8(offset + 6) === 0x69 &&
                view.getUint8(offset + 7) === 0x66 &&
                view.getUint8(offset + 8) === 0x00 &&
                view.getUint8(offset + 9) === 0x00
            ) {
                return parseTiffSection(view, offset + 10);
            }
        }

        offset += 2 + segLen;
    }

    return null;
}

function parseTiffSection(view: DataView, tiffStart: number): number | null {
    if (tiffStart + 8 > view.byteLength) return null;

    const byteOrder = view.getUint16(tiffStart); // 'II'=0x4949(LE), 'MM'=0x4D4D(BE)
    if (byteOrder !== 0x4949 && byteOrder !== 0x4D4D) return null;
    const le = byteOrder === 0x4949;

    if (view.getUint16(tiffStart + 2, le) !== 42) return null; // TIFF magic

    const ifd0Offset = view.getUint32(tiffStart + 4, le);

    // IFD0에서 날짜 태그와 SubIFD 포인터 수집
    let bestMs: number | null = null;
    let subIFDOffset = 0;

    const scanIFD = (ifdOffset: number): void => {
        const absBase = tiffStart + ifdOffset;
        if (absBase + 2 > view.byteLength) return;

        const entryCount = view.getUint16(absBase, le);
        for (let i = 0; i < entryCount; i++) {
            const e = absBase + 2 + i * 12;
            if (e + 12 > view.byteLength) break;

            const tag = view.getUint16(e, le);
            const type = view.getUint16(e + 2, le);
            const valueCount = view.getUint32(e + 4, le);

            // ASCII 날짜 태그 처리
            if (type === 2 && (tag === 0x9003 || tag === 0x9004 || tag === 0x0132)) {
                const valOffset = valueCount <= 4
                    ? e + 8
                    : tiffStart + view.getUint32(e + 8, le);

                if (valOffset + valueCount <= view.byteLength) {
                    let str = '';
                    for (let j = 0; j < valueCount - 1; j++) {
                        str += String.fromCharCode(view.getUint8(valOffset + j));
                    }
                    const ms = exifDateStringToMs(str);
                    if (ms !== null) {
                        if (tag === 0x9003) { bestMs = ms; return; } // DateTimeOriginal 최우선
                        if (bestMs === null) bestMs = ms;
                    }
                }
            }

            // SubIFD (Exif IFD) 포인터
            if (tag === 0x8769 && !subIFDOffset) {
                subIFDOffset = view.getUint32(e + 8, le);
            }
        }
    };

    scanIFD(ifd0Offset);
    if (bestMs === null && subIFDOffset) scanIFD(subIFDOffset);

    return bestMs;
}

function exifDateStringToMs(dateStr: string): number | null {
    // "YYYY:MM:DD HH:MM:SS"
    const m = dateStr.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s] = m.map(Number);
    if (y < 1900 || y > 2100) return null;
    const date = new Date(y, mo - 1, d, h, mi, s);
    return isNaN(date.getTime()) ? null : date.getTime();
}
