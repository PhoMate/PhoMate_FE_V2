type JsonRecord = Record<string, unknown>;
import { authFetch } from './auth';
export type SearchResultItem = {
    postId?: number;
    photoId?: number;
    title?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    imageUrl?: string;
    likeCount?: number;
    likedByMe?: boolean;
    shotAt?: string;
    score?: number;
    similarity?: number;
    description?: string;
};

function extractItemsFromUnknown(value: unknown): SearchResultItem[] {
    if (Array.isArray(value)) return value as SearchResultItem[];
    if (!value || typeof value !== 'object') return [];

    const record = value as JsonRecord;
    const dataRecord = (record.data && typeof record.data === 'object')
        ? (record.data as JsonRecord)
        : null;

    const candidates = [
        record.items,
        record.results,
        dataRecord?.items,
        dataRecord?.results,
        dataRecord?.photos,
        record.photos
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate as SearchResultItem[];
    }

    return [];
}

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
        return extractItemsFromUnknown(JSON.parse(trimmed));
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

// ─── /api/folders 단건 조회 ─────────────────────────────────────────────────

export type FolderSummary = {
    folderId: number;
    folderName: string;
    folderType: 'PERSONAL' | 'SHARED';
};

function parseFolderItems(payload: unknown): FolderSummary[] {
    const items: unknown[] = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as JsonRecord)?.items)
            ? ((payload as JsonRecord).items as unknown[])
            : Array.isArray((payload as JsonRecord)?.data)
                ? ((payload as JsonRecord).data as unknown[])
                : [];

    return items
        .map((raw) => {
            const item = raw as JsonRecord;
            const folderId = asNumber(item.folderId) || asNumber(item.id) || asNumber(item.folder_id);
            const folderName = asText(item.folderName) || asText(item.name) || asText(item.title);
            const typeRaw = asText(item.type ?? item.folderType).toUpperCase();
            const folderType: 'PERSONAL' | 'SHARED' = typeRaw === 'SHARED' ? 'SHARED' : 'PERSONAL';
            return { folderId, folderName, folderType };
        })
        .filter((f) => f.folderId > 0 && f.folderName.length > 0);
}

export async function getAllFolders(): Promise<FolderSummary[]> {
    try {
        const response = await authFetch(toApiUrl('/api/folders'), { method: 'GET' });
        if (!response.ok) return [];
        return parseFolderItems(await response.json());
    } catch {
        return [];
    }
}

export async function deleteFolder(folderId: number): Promise<void> {
    const response = await authFetch(toApiUrl(`/api/folders/${folderId}`), { method: 'DELETE' });
    if (!response.ok) throw new Error(`폴더 삭제 실패 (${response.status})`);
}

export async function getFolderById(targetId: number): Promise<FolderSummary | null> {
    try {
        const response = await authFetch(toApiUrl('/api/folders'), { method: 'GET' });
        if (!response.ok) return null;
        const all = parseFolderItems(await response.json());
        return all.find((f) => f.folderId === targetId) ?? null;
    } catch {
        return null;
    }
}

// ─── /api/chat/agent/run ────────────────────────────────────────────────────

export type AgentRunParams = {
    chatSessionId: number;
    editSessionId?: number | null;
    userText: string;
    selectedPhotoIds?: number[];
    onDelta?: (delta: string) => void;
    onResults?: (items: SearchResultItem[]) => void;
    onEditedUrl?: (url: string) => void;
    onFolderCreated?: (data: unknown) => void;
    onError?: (code: string) => void;
};

export async function streamAgentRun(params: AgentRunParams): Promise<void> {
    const body = JSON.stringify({
        chatSessionId: params.chatSessionId,
        editSessionId: params.editSessionId ?? null,
        userText: params.userText,
        ...(params.selectedPhotoIds?.length ? { selectedPhotoIds: params.selectedPhotoIds } : {})
    });

    const requestAndConsume = async (accept: string): Promise<void> => {
        const response = await authFetch(toApiUrl('/api/chat/agent/run'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: accept },
            body,
            cache: 'no-store'
        });
        if (!response.ok) throw await buildHttpError(response, 'AI 에이전트 요청에 실패했습니다.');
        await consumeAgentRunResponse(response, params);
    };

    try {
        await requestAndConsume('text/event-stream');
    } catch (error) {
        if (!isHttp2ProtocolError(error)) throw error;
        await requestAndConsume('*/*');
    }
}

async function consumeAgentRunResponse(response: Response, params: AgentRunParams): Promise<void> {
    if (!response.body) {
        const text = await response.text();
        if (text) params.onDelta?.(text);
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let receivedAnyData = false;

    const consumeBlock = (block: string) => {
        if (!block.trim()) return;
        const { eventType, data } = parseEventBlock(block);
        const et = eventType.toLowerCase();

        if (et === 'done' || data.trim() === '[DONE]') return;

        if (et === 'error') {
            params.onError?.(data.trim() || 'agent_failed');
            return;
        }

        if (et === 'results') {
            const items = parseResultsItems(data);
            if (items.length > 0) { receivedAnyData = true; params.onResults?.(items); }
            return;
        }

        if (et === 'delta') {
            const text = data.trim();
            if (text) { receivedAnyData = true; params.onDelta?.(text); }
            return;
        }

        if (et === 'edited_url') {
            const url = data.trim();
            if (url) { receivedAnyData = true; params.onEditedUrl?.(url); }
            return;
        }

        if (et === 'folder_created') {
            receivedAnyData = true;
            try { params.onFolderCreated?.(JSON.parse(data)); }
            catch { params.onFolderCreated?.(data); }
            return;
        }

        // fallback
        const parsed = parseStreamLine(data);
        if (parsed.done) return;
        if (parsed.text) { receivedAnyData = true; params.onDelta?.(parsed.text); }
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            const blocks = pending.split(/\r?\n\r?\n/);
            pending = blocks.pop() ?? '';
            for (const block of blocks) consumeBlock(block);
        }
    } catch (error) {
        if (!receivedAnyData) throw error;
    }

    pending += decoder.decode();
    if (pending.trim()) consumeBlock(pending);
}

function isHttp2ProtocolError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message || '';
    return message.includes('ERR_HTTP2_PROTOCOL_ERROR');
}

