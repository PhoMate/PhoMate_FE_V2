import { authFetch } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function toApiUrl(path: string): string {
    if (!API_BASE_URL) return path;
    return new URL(path, API_BASE_URL).toString();
}

export type EditVersionResponse = {
    editSessionId: number;
    editVersionId: number;
    versionIndex: number;
    s3Key: string;
    imageUrl: string;
    sourceType: 'CHAT' | 'DIRECT' | 'INITIAL';
};

/** 1. 편집 세션 시작 (v0 생성) — /api/edits/{editSessionId}/start */
export async function startEditSession(editSessionId: number): Promise<{ editSessionId: number }> {
    const response = await authFetch(toApiUrl(`/api/edits/${editSessionId}/start`), {
        method: 'POST'
    });
    if (!response.ok) throw new Error('편집 세션을 시작할 수 없습니다.');
    return response.json();
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
    return response.text(); // finalUrl 반환
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