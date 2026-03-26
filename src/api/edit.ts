import { authFetch } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function toApiUrl(path: string): string {
    if (!API_BASE_URL) return path;
    return new URL(path, API_BASE_URL).toString();
}

function asNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

/** 지수 백오프 재시도 유틸 */
async function fetchWithRetry(
    fn: () => Promise<Response>,
    options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
    const { maxRetries = 3, baseDelayMs = 1000 } = options;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const response = await fn();

        if (response.status === 429 && attempt < maxRetries) {
            const retryAfter = response.headers.get('Retry-After');
            const delayMs = retryAfter
                ? Number(retryAfter) * 1000
                : baseDelayMs * Math.pow(2, attempt); // 1s → 2s → 4s

            console.warn(
                `[edit] 429 Too Many Requests. ${delayMs}ms 후 재시도 (${attempt + 1}/${maxRetries})`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            lastResponse = response;
            continue;
        }

        return response;
    }

    return lastResponse!;
}

export type EditVersionResponse = {
    editSessionId: number;
    editVersionId: number;
    versionIndex: number;
    s3Key: string;
    imageUrl: string;
    sourceType: 'CHAT' | 'DIRECT' | 'INITIAL';
};

/** 1. 편집 세션 시작 (v0 생성) — 서버 필수 파라미터: photoId */
export async function startEditSession(photoId: number): Promise<{ editSessionId: number }> {
    // 서버 스펙 확인된 파라미터명을 첫 번째로, 이후 대체 후보 순서로 시도
    const candidates = [
        `/api/edits/start?photoId=${photoId}`,   // ← 서버 스펙 기준 (필수)
        `/api/edits/start?photo_id=${photoId}`,
        `/api/edits/${photoId}/start`,
        `/api/edits/start?postId=${photoId}`
    ];

    let lastStatus = '';

    for (const path of candidates) {
        const response = await authFetch(toApiUrl(path), { method: 'POST' });

        if (!response.ok) {
            lastStatus = `${response.status} ${response.statusText}`;
            if (response.status === 400 || response.status === 404) continue;
            throw new Error(`편집 세션을 시작할 수 없습니다. (${lastStatus})`);
        }

        const raw = (await response.json()) as unknown;
        const editSessionId =
            asNumber(raw) ||
            asNumber((raw as { editSessionId?: unknown })?.editSessionId) ||
            asNumber((raw as { data?: { editSessionId?: unknown } })?.data?.editSessionId);

        if (editSessionId > 0) {
            return { editSessionId };
        }
    }

    throw new Error(
        `편집 세션을 시작할 수 없습니다. (${lastStatus || '사용 가능한 엔드포인트 없음'})`
    );
}

/** 2. 현재 버전 정보 조회 */
export async function getCurrentEditVersion(editSessionId: number): Promise<EditVersionResponse> {
    const response = await authFetch(toApiUrl(`/api/edits/${editSessionId}/current`), {
        method: 'GET'
    });
    if (!response.ok) throw new Error('현재 버전 정보를 가져오지 못했습니다.');
    return response.json();
}

/**
 * 3. 챗봇 편집 요청 — Gemini 429 대비 지수 백오프 재시도 적용
 * ✅ 수정: sendChatEdit → sendEditChat 으로 이름 통일 (Chatbot.tsx import 와 일치)
 */
export async function sendEditChat(
    chatSessionId: number,
    editSessionId: number,
    userText: string
) {
    const params = new URLSearchParams({
        chatSessionId: String(chatSessionId),
        editSessionId: String(editSessionId),
        userText
    });

    const response = await fetchWithRetry(
        () =>
            authFetch(toApiUrl(`/api/chat/send-edit?${params.toString()}`), {
                method: 'POST'
            }),
        { maxRetries: 3, baseDelayMs: 1000 }
    );

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error(
                'AI 편집 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (429)'
            );
        }
        throw new Error(`편집 메시지 전송 실패 (${response.status} ${response.statusText})`);
    }

    return response.json();
}

/** 4. Undo (이전 버전으로) */
export async function undoEdit(editSessionId: number): Promise<EditVersionResponse> {
    const response = await authFetch(toApiUrl(`/api/edits/${editSessionId}/undo`), {
        method: 'POST'
    });
    if (!response.ok) throw new Error('이전 버전이 없습니다.');
    return response.json();
}

/** 5. Redo (다음 버전으로) */
export async function redoEdit(editSessionId: number): Promise<EditVersionResponse> {
    const response = await authFetch(toApiUrl(`/api/edits/${editSessionId}/redo`), {
        method: 'POST'
    });
    if (!response.ok) throw new Error('다음 버전이 없습니다.');
    return response.json();
}

/** 6. Finalize (최종 저장 및 종료) */
export async function finalizeEdit(editSessionId: number): Promise<string> {
    const response = await authFetch(toApiUrl(`/api/edits/${editSessionId}/finalize`), {
        method: 'POST'
    });
    if (!response.ok) throw new Error('최종 저장 실패');
    return response.text();
}

/** 7. Direct Edit (ToastUI 결과물 업로드) */
export async function uploadDirectEdit(
    editSessionId: number,
    file: File
): Promise<EditVersionResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await authFetch(toApiUrl(`/api/edits/${editSessionId}/direct`), {
        method: 'POST',
        body: formData
    });
    if (!response.ok) throw new Error('직접 편집 업로드 실패');
    return response.json();
}

/** 8. 편집 세션 취소 */
export async function deleteEditSession(editSessionId: number): Promise<void> {
    await authFetch(toApiUrl(`/api/edits/${editSessionId}`), { method: 'DELETE' });
}
