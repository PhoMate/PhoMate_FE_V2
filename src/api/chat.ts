type JsonRecord = Record<string, unknown>;
import { authFetch, getAccessToken } from './auth';
export type SearchResultItem = {
    postId: number;
    title: string;
    thumbnailUrl: string;
    likeCount: number;
    likedByMe: boolean;
};

type SendEditChatResponse = {
    chatSessionId: number;
    userMessageId: number;
    assistantMessageId: number;
    assistantContent: string;
    editedUrl: string;
};

export type ChatFolderPreviewPhoto = {
    photoId: number;
    previewUrl: string;
    shotAt: string;
};

export type ChatFolderPreviewResponse = {
    suggestedFolderName: string;
    photos: ChatFolderPreviewPhoto[];
};

export type ChatFolderConfirmResponse = {
    folderId: number | null;
};

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

function getMemberIdFromAccessToken(): number {
    const token = getAccessToken();
    if (!token) return 0;

    try {
        const parts = token.split('.');
        if (parts.length < 2) return 0;

        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
        const payload = JSON.parse(atob(padded)) as JsonRecord;
        return asNumber(payload.sub);
    } catch {
        return 0;
    }
}

function extractTextFromPayload(payload: unknown): string {
    if (typeof payload === 'string') return payload;
    if (!payload || typeof payload !== 'object') return '';

    const record = payload as JsonRecord;
    const directKeys = ['delta', 'content', 'message', 'text', 'token'];

    for (const key of directKeys) {
        const value = record[key];
        const text = asText(value);
        if (text) return text;
    }

    const data = record.data;
    if (data && typeof data === 'object') {
        const nested = data as JsonRecord;
        for (const key of directKeys) {
            const value = nested[key];
            const text = asText(value);
            if (text) return text;
        }
    }

    return '';
}

function parseStreamLine(line: string): { done: boolean; text: string } {
    const trimmed = line.trim();
    if (!trimmed) return { done: false, text: '' };

    const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
    if (!payload) return { done: false, text: '' };
    if (payload === '[DONE]') return { done: true, text: '' };

    if (payload.startsWith('{') || payload.startsWith('[')) {
        try {
            const parsed = JSON.parse(payload);
            return { done: false, text: extractTextFromPayload(parsed) };
        } catch {
            return { done: false, text: payload };
        }
    }

    return { done: false, text: payload };
}

function parseEventBlock(block: string): { eventType: string; data: string } {
    const lines = block.split(/\r?\n/);
    let eventType = '';
    const dataLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
            continue;
        }

        if (line.startsWith('data:')) {
            dataLines.push(line.slice(5));
        }
    }

    return {
        eventType,
        data: dataLines.join('\n')
    };
}

function parseResultsItems(data: string): SearchResultItem[] {
    const trimmed = data.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed) as { items?: SearchResultItem[] };
        return Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
        return [];
    }
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

export async function startChatSession(): Promise<number> {
    const response = await authFetch(toApiUrl('/api/chat/sessions/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });

    if (!response.ok) {
        throw await buildHttpError(response, '채팅 세션 생성에 실패했습니다.');
    }

    const raw = (await response.json()) as unknown;
    const data = (typeof raw === 'object' && raw !== null ? raw : {}) as JsonRecord;
    const sessionId =
        asNumber(raw) ||
        asNumber(data.chatSessionId) ||
        asNumber(data.chat_session_id) ||
        asNumber(data.sessionId) ||
        asNumber(data.session_id) ||
        asNumber((data.data as JsonRecord | undefined)?.chatSessionId) ||
        asNumber((data.data as JsonRecord | undefined)?.chat_session_id) ||
        asNumber((data.data as JsonRecord | undefined)?.sessionId) ||
        asNumber((data.data as JsonRecord | undefined)?.session_id);

    if (!Number.isFinite(sessionId) || sessionId <= 0) {
        throw new Error('세션 ID를 찾을 수 없습니다.');
    }

    return sessionId;
}

export async function streamSearchChat(
    params: {
        sessionId: number;
        message: string;
        onDelta: (delta: string) => void;
        onResults?: (items: SearchResultItem[]) => void;
    }
): Promise<void> {
    const response = await authFetch(toApiUrl('/api/chat/search/stream'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream'
        },
        body: JSON.stringify({
            chatSessionId: params.sessionId,
            userText: params.message
        })
    });

    if (!response.ok) {
        throw await buildHttpError(response, '검색 스트리밍 요청에 실패했습니다.');
    }

    if (!response.body) {
        const text = await response.text();
        if (text) params.onDelta(text);
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let emittedAnyDelta = false;

    const consumeBlock = (block: string) => {
        if (!block.trim()) return;

        const { eventType, data } = parseEventBlock(block);

        if (eventType === 'results') {
            const items = parseResultsItems(data);
            if (items.length && params.onResults) {
                params.onResults(items);
            }
            return;
        }

        if (eventType === 'delta') {
            emittedAnyDelta = true;
            params.onDelta(data);
            return;
        }

        if (isDoneEvent(eventType, data)) {
            return;
        }

        const parsed = parseStreamLine(data);
        if (parsed.done) return;
        if (parsed.text) {
            emittedAnyDelta = true;
            params.onDelta(parsed.text);
        }
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            pending += decoder.decode(value, { stream: true });
            const blocks = pending.split(/\r?\n\r?\n/);
            pending = blocks.pop() ?? '';

            for (const block of blocks) {
                consumeBlock(block);
            }
        }
    } catch (error) {
        if (!emittedAnyDelta) {
            throw error;
        }
    }

    pending += decoder.decode();
    if (pending.trim()) {
        consumeBlock(pending);
    }
}

export async function streamTextChat(
    params: {
        sessionId: number;
        message: string;
        onDelta: (delta: string) => void;
        onError?: (code: string) => void;
    }
): Promise<void> {
    const memberId = getMemberIdFromAccessToken();
    const endpoint = toApiUrl('/api/chat/stream');
    const body = JSON.stringify({
        ...(memberId > 0 ? { memberId } : {}),
        chatSessionId: params.sessionId,
        userText: params.message
    });

    const response = await authFetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream'
        },
        body,
        cache: 'no-store'
    });

    if (!response.ok) {
        throw await buildHttpError(response, '텍스트 스트리밍 요청에 실패했습니다.');
    }
    try {
        await consumeTextStreamResponse(response, {
            onDelta: params.onDelta,
            onError: params.onError
        });
    } catch (error) {
        if (!isHttp2ProtocolError(error)) {
            throw error;
        }

        const retryResponse = await authFetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: '*/*'
            },
            body,
            cache: 'no-store'
        });

        if (!retryResponse.ok) {
            throw await buildHttpError(retryResponse, '텍스트 스트리밍 재시도에 실패했습니다.');
        }

        await consumeTextStreamResponse(retryResponse, {
            onDelta: params.onDelta,
            onError: params.onError
        });
    }
}

export async function sendEditChat(
    params: { chatSessionId: number; editSessionId: number; userText: string }
): Promise<SendEditChatResponse> {
    // chatSessionId가 유효하지 않으면 즉시 에러
    if (!params.chatSessionId || params.chatSessionId <= 0) {
        throw new Error('유효한 채팅 세션이 없습니다. 잠시 후 다시 시도해주세요.');
    }

    const query = new URLSearchParams({
        chatSessionId: String(params.chatSessionId),
        editSessionId: String(params.editSessionId),
        userText: params.userText
    });

    const response = await authFetch(`${toApiUrl('/api/chat/send-edit')}?${query.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw await buildHttpError(response, '편집 메시지 전송에 실패했습니다.');
    }

    const data = (await response.json()) as JsonRecord;
    return {
        chatSessionId:
            asNumber(data.chatSessionId) ||
            asNumber((data.data as JsonRecord | undefined)?.chatSessionId),
        userMessageId:
            asNumber(data.userMessageId) ||
            asNumber((data.data as JsonRecord | undefined)?.userMessageId),
        assistantMessageId:
            asNumber(data.assistantMessageId) ||
            asNumber((data.data as JsonRecord | undefined)?.assistantMessageId),
        assistantContent:
            asText(data.assistantContent) ||
            asText((data.data as JsonRecord | undefined)?.assistantContent),
        editedUrl:
            asText(data.editedUrl) ||
            asText((data.data as JsonRecord | undefined)?.editedUrl)
    };
}

export async function previewAutoFolder(
    params: { chatSessionId: number; userText: string; topK?: number }
): Promise<ChatFolderPreviewResponse> {
    const response = await authFetch(toApiUrl('/api/chat/folders/preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatSessionId: params.chatSessionId,
            userText: params.userText,
            ...(typeof params.topK === 'number' ? { topK: params.topK } : {})
        })
    });

    if (!response.ok) {
        throw await buildHttpError(response, 'AI 자동 폴더 미리보기에 실패했습니다.');
    }

    const payload = (await response.json()) as JsonRecord;
    const data = (payload.data as JsonRecord | undefined) ?? payload;
    const photosRaw = Array.isArray(data.photos) ? (data.photos as JsonRecord[]) : [];

    return {
        suggestedFolderName: asText(data.suggestedFolderName),
        photos: photosRaw.map((item) => ({
            photoId: asNumber(item.photoId),
            previewUrl: asText(item.previewUrl),
            shotAt: asText(item.shotAt)
        }))
    };
}

export async function confirmAutoFolder(
    params: { accepted: boolean; folderName: string; photoIds: number[] }
): Promise<ChatFolderConfirmResponse> {
    const response = await authFetch(toApiUrl('/api/chat/folders/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            accepted: params.accepted,
            folderName: params.folderName,
            photoIds: params.photoIds
        })
    });

    if (!response.ok) {
        throw await buildHttpError(response, 'AI 자동 폴더 생성 확정에 실패했습니다.');
    }

    const payload = (await response.json()) as JsonRecord;
    const data = (payload.data as JsonRecord | undefined) ?? payload;
    const folderId =
        asNumber(data.folderId) ||
        asNumber(payload.folderId) ||
        asNumber((payload.data as JsonRecord | undefined)?.folderId);

    return {
        folderId: folderId > 0 ? folderId : null
    };
}

function isDoneEvent(eventType: string, data: string): boolean {
    return eventType === 'done' || data.trim() === '[DONE]';
}

function isHttp2ProtocolError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message || '';
    return (
        message.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
        message.includes('TypeError: Failed to fetch') ||
        message.includes('NetworkError')
    );
}

async function consumeTextStreamResponse(
    response: Response,
    params: {
        onDelta: (delta: string) => void;
        onError?: (code: string) => void;
    }
): Promise<void> {
    if (!response.body) {
        const text = await response.text();
        if (text) params.onDelta(text);
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let emittedAnyDelta = false;

    const consumeBlock = (block: string): boolean => {
        if (!block.trim()) return false;

        const { eventType, data } = parseEventBlock(block);

        if (eventType === 'delta') {
            emittedAnyDelta = true;
            params.onDelta(data);
            return false;
        }

        if (eventType === 'error') {
            if (params.onError) {
                params.onError(data.trim() || 'stream_failed');
            }
            return false;
        }

        if (isDoneEvent(eventType, data)) {
            return true;
        }

        const parsed = parseStreamLine(data);
        if (parsed.done) return true;
        if (parsed.text) {
            emittedAnyDelta = true;
            params.onDelta(parsed.text);
        }
        return false;
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            pending += decoder.decode(value, { stream: true });
            const blocks = pending.split(/\r?\n\r?\n/);
            pending = blocks.pop() ?? '';

            for (const block of blocks) {
                const shouldStop = consumeBlock(block);
                if (shouldStop) return;
            }
        }
    } catch (error) {
        if (!emittedAnyDelta) {
            throw error;
        }
    }

    pending += decoder.decode();
    if (pending.trim()) {
        consumeBlock(pending);
    }
}