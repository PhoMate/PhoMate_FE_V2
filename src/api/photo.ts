import { authFetch } from './auth';

type JsonRecord = Record<string, unknown>;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function toApiUrl(path: string): string {
    if (!API_BASE_URL) return path;
    return new URL(path, API_BASE_URL).toString();
}

function asText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function asNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== 'object') return null;
    return value as JsonRecord;
}

function inferImageMimeType(filename: string): string {
    const lowered = filename.toLowerCase();
    if (lowered.endsWith('.png')) return 'image/png';
    if (lowered.endsWith('.webp')) return 'image/webp';
    if (lowered.endsWith('.gif')) return 'image/gif';
    if (lowered.endsWith('.bmp')) return 'image/bmp';
    if (lowered.endsWith('.heic')) return 'image/heic';
    if (lowered.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
}

function normalizeImageFile(file: File): File {
    if (file.type && file.type.startsWith('image/')) {
        return file;
    }

    const normalizedType = inferImageMimeType(file.name);
    return new File([file], file.name, {
        type: normalizedType,
        lastModified: file.lastModified
    });
}

async function buildHttpError(response: Response, fallbackMessage: string): Promise<Error> {
    let detail = '';
    try {
        detail = (await response.text()).trim();
    } catch {
        detail = '';
    }

    const suffix = detail
        ? ` (${response.status} ${response.statusText}: ${detail})`
        : ` (${response.status} ${response.statusText})`;
    return new Error(`${fallbackMessage}${suffix}`);
}

export type PhotoFeedItem = {
    photoId: number;
    thumbnailUrl: string;
    previewUrl: string;
    shotAt: string;
    sizeBytes?: number;
};

export type PhotoDetail = {
    photoId: number;
    postId?: number;
    originalUrl: string;
    shotAt: string;
};

export async function getAlbumLatest(params?: {
    cursorShotAt?: string;
    cursorId?: number;
    size?: number;
}): Promise<PhotoFeedItem[]> {
    const query = new URLSearchParams();
    if (params?.cursorShotAt) query.set('cursorShotAt', params.cursorShotAt);
    if (params?.cursorId) query.set('cursorId', String(params.cursorId));
    if (params?.size) query.set('size', String(params.size));

    const url = `${toApiUrl('/api/photos')}${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await authFetch(url, { method: 'GET' });

    if (!response.ok) {
        throw await buildHttpError(response, '앨범 조회에 실패했습니다.');
    }

    const payload = (await response.json()) as JsonRecord;
    const data = asRecord(payload.data) ?? payload;
    const items = Array.isArray(data.items) ? data.items : [];

    return items
        .map((item) => asRecord(item))
        .filter((item): item is JsonRecord => !!item)
        .map((item) => ({
          photoId: asNumber(item.photoId),
           thumbnailUrl: asText(item.thumbnailUrl),
            previewUrl: asText(item.previewUrl),
           shotAt: asText(item.shotAt),
          sizeBytes: asNumber(item.sizeBytes) || asNumber(item.fileSizeBytes) || asNumber(item.size) || 0 // 추가
         }));
}

export async function getTrashLatest(params?: {
    cursorDeletedAt?: string;
    cursorId?: number;
    size?: number;
}): Promise<PhotoFeedItem[]> {
    const query = new URLSearchParams();
    if (params?.cursorDeletedAt) query.set('cursorDeletedAt', params.cursorDeletedAt);
    if (params?.cursorId) query.set('cursorId', String(params.cursorId));
    if (params?.size) query.set('size', String(params.size));

    const url = `${toApiUrl('/api/photos/trash')}${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await authFetch(url, { method: 'GET' });

    if (!response.ok) {
        throw await buildHttpError(response, '휴지통 조회에 실패했습니다.');
    }

    const payload = (await response.json()) as JsonRecord;
    const data = asRecord(payload.data) ?? payload;
    const items = Array.isArray(data.items) ? data.items : [];

    return items
        .map((item) => asRecord(item))
        .filter((item): item is JsonRecord => !!item)
        .map((item) => ({
            photoId: asNumber(item.photoId),
            thumbnailUrl: asText(item.thumbnailUrl),
            previewUrl: asText(item.previewUrl),
            shotAt: asText(item.shotAt)
        }));
}

export async function getPhotoDetail(photoId: number): Promise<PhotoDetail> {
    const response = await authFetch(toApiUrl(`/api/photos/${photoId}`), { method: 'GET' });

    if (!response.ok) {
        throw await buildHttpError(response, '사진 상세 조회에 실패했습니다.');
    }

    const payload = (await response.json()) as JsonRecord;
    const data = asRecord(payload.data) ?? payload;

    return {
        photoId: asNumber(data.photoId),
        postId: asNumber(data.postId) || undefined,
        originalUrl: asText(data.originalUrl),
        shotAt: asText(data.shotAt)
    };
}

export async function movePhotoToTrash(photoId: number): Promise<void> {
    const response = await authFetch(toApiUrl(`/api/photos/${photoId}`), { method: 'DELETE' });
    if (!response.ok) {
        throw await buildHttpError(response, '사진 휴지통 이동에 실패했습니다.');
    }
}

export async function restorePhoto(photoId: number): Promise<void> {
    const response = await authFetch(toApiUrl(`/api/photos/${photoId}/restore`), { method: 'POST' });
    if (!response.ok) {
        throw await buildHttpError(response, '사진 복구에 실패했습니다.');
    }
}

export async function purgePhoto(photoId: number): Promise<void> {
    const response = await authFetch(toApiUrl(`/api/photos/${photoId}/purge`), { method: 'DELETE' });
    if (!response.ok) {
        throw await buildHttpError(response, '사진 완전 삭제에 실패했습니다.');
    }
}

export async function createPhoto(file: File, clientLastModifiedMs?: number): Promise<void> {
    const normalizedFile = normalizeImageFile(file);
    const formData = new FormData();
    formData.append('image', normalizedFile, normalizedFile.name);
    // Some server setups reject optional numeric multipart fields with 415.
    // Keep this endpoint minimal and send only required binary part.
    void clientLastModifiedMs;

    const response = await authFetch(toApiUrl('/api/photos'), {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw await buildHttpError(response, '사진 업로드에 실패했습니다.');
    }
}

export async function replacePhoto(photoId: number, file: File, clientLastModifiedMs?: number): Promise<void> {
    const normalizedFile = normalizeImageFile(file);
    const formData = new FormData();
    formData.append('image', normalizedFile, normalizedFile.name);
    void clientLastModifiedMs;

    const response = await authFetch(toApiUrl(`/api/photos/${photoId}`), {
        method: 'PATCH',
        body: formData
    });

    if (!response.ok) {
        throw await buildHttpError(response, '사진 수정에 실패했습니다.');
    }
}
