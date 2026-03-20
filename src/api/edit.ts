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

export type EditVersionResponse = {
    editSessionId: number;
    editVersionId: number;
    versionIndex: number;
    s3Key: string;
    imageUrl: string;
    sourceType: 'CHAT' | 'DIRECT' | 'INITIAL';
};

/** 1. 편집 세션 시작 (v0 생성) */
export async function startEditSession(photoId: number): Promise<{ editSessionId: number }> {
    const candidates = [
        `/api/edits/start?photoId=${photoId}`,
        `/api/edits/${photoId}/start`,
        `/api/edits/start?postId=${photoId}`
    ];

    let lastStatus = '';

    for (const path of candidates) {
        const response = await authFetch(toApiUrl(path), { method: 'POST' });

        if (!response.ok) {
            lastStatus = `${response.status} ${response.statusText}`;
            // 배포/스펙 불일치 환경에서는 400/404가 섞일 수 있어 다음 후보를 시도한다.
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

    throw new Error(`편집 세션을 시작할 수 없습니다. (${lastStatus || '사용 가능한 엔드포인트 없음'})`);
}

/** 2. 현재 버전 정보 조회 */
export async function getCurrentEditVersion(editSessionId: number): Promise<EditVersionResponse> {
    const response = await authFetch(toApiUrl(`/api/edits/${editSessionId}/current`), {
        method: 'GET'
    });
    if (!response.ok) throw new Error('현재 버전 정보를 가져오지 못했습니다.');
    return response.json();
}

/** 3. 챗봇 편집 요청 (기존 API 유지하되 명세에 맞게 사용) */
export async function sendChatEdit(chatSessionId: number, editSessionId: number, userText: string) {
    const params = new URLSearchParams({
        chatSessionId: String(chatSessionId),
        editSessionId: String(editSessionId),
        userText: userText
    });
    const response = await authFetch(toApiUrl(`/api/chat/send-edit?${params.toString()}`), {
        method: 'POST'
    });
    if (!response.ok) throw new Error('편집 메시지 전송 실패');
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
export async function uploadDirectEdit(editSessionId: number, file: File): Promise<EditVersionResponse> {
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
    await authFetch(toApiUrl(`/api/edits/${editSessionId}`), {
        method: 'DELETE'
    });
}
