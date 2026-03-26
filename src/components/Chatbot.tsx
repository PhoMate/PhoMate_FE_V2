import React, { useEffect, useRef, useState } from 'react';
import { X, Edit3, Undo, Redo, Save } from 'lucide-react';
import {
    type ChatFolderPreviewPhoto,
    type SearchResultItem,
    confirmAutoFolder,
    previewAutoFolder,
    startChatSession,
    streamSearchChat,
    streamTextChat
} from '../api/chat';
import {
    startEditSession,
    getCurrentEditVersion,
    undoEdit,
    redoEdit,
    sendEditChat,
    finalizeEdit
} from '../api/edit';
import { getPhotoDetail } from '../api/photo';
import '../styles/Chatbot.css';

type ChatTab = 'search' | 'edit';
type ChatRole = 'assistant' | 'user';
type SearchMode = 'auto' | 'search' | 'organize';

type ChatMessage = {
    id: string;
    role: ChatRole;
    content: string;
};

type FolderPreviewState = {
    folderName: string;
    photoIds: number[];
    status: 'pending' | 'accepted' | 'rejected';
    folderType: 'PERSONAL' | 'SHARED';
    photos: ChatFolderPreviewPhoto[];
    selectedPhotoIds: number[];
};

type ChatbotProps = {
    isOpen: boolean;
    onClose: () => void;
    onOpen: () => void;
    isLoggedIn: boolean;
    selectedPhotoId?: number | null;
    onSearchResults?: (payload: { query: string; photos: ChatFolderPreviewPhoto[] }) => void;
    onSessionStart?: (id: number) => void;
    onFolderCreated?: (folderName: string, folderType: 'PERSONAL' | 'SHARED', photoIds: number[]) => void;
};

const INITIAL_SEARCH_MESSAGES: ChatMessage[] = [
    { id: 'initial-assistant', role: 'assistant', content: '사진에 대한 설명을 적어주세요.' }
];

const INITIAL_EDIT_MESSAGES: ChatMessage[] = [
    {
        id: 'initial-edit-assistant',
        role: 'assistant',
        content: '편집할 사진을 선택하거나 이미지를 드래그해서 올려주세요.'
    }
];

export default function Chatbot({
    isOpen,
    onClose,
    onOpen,
    isLoggedIn,
    selectedPhotoId,
    onSearchResults,
    onSessionStart,
    onFolderCreated
}: ChatbotProps) {
    const isGuestChatMode = import.meta.env.VITE_CHAT_GUEST_MODE === 'true';
    const [activeTab, setActiveTab] = useState<ChatTab>('search');

    const [sessionId, setSessionId] = useState<number | null>(null);
    const sessionIdRef = useRef<number | null>(null);

    const [editSessionId, setEditSessionId] = useState<number | null>(null);
    const editSessionIdRef = useRef<number | null>(null);
    const [isEditSessionLoading, setIsEditSessionLoading] = useState(false);
    const editSessionPhotoIdRef = useRef<number | null>(null);

    const [searchMessages, setSearchMessages] = useState<ChatMessage[]>(INITIAL_SEARCH_MESSAGES);
    const [editMessages, setEditMessages] = useState<ChatMessage[]>(INITIAL_EDIT_MESSAGES);

    const [editedImageUrl, setEditedImageUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [folderPreview, setFolderPreview] = useState<FolderPreviewState | null>(null);
    const [folderPreviewType, setFolderPreviewType] = useState<'PERSONAL' | 'SHARED'>('PERSONAL');
    const [searchMode, setSearchMode] = useState<SearchMode>('auto');
    const [isEditDragOver, setIsEditDragOver] = useState(false);

    const bodyRef = useRef<HTMLDivElement | null>(null);
    const editChatRef = useRef<HTMLDivElement | null>(null);
    const localEditPreviewUrlRef = useRef<string | null>(null);

    const setSessionIdSync = (id: number) => {
        sessionIdRef.current = id;
        setSessionId(id);
    };

    const setEditSessionIdSync = (id: number) => {
        editSessionIdRef.current = id;
        setEditSessionId(id);
    };

    // 편집 상태 초기화
    const resetEditState = () => {
        editSessionIdRef.current = null;
        editSessionPhotoIdRef.current = null;
        setEditSessionId(null);
        setEditedImageUrl('');
        setEditMessages([...INITIAL_EDIT_MESSAGES]);
        setErrorMessage('');
        if (localEditPreviewUrlRef.current) {
            URL.revokeObjectURL(localEditPreviewUrlRef.current);
            localEditPreviewUrlRef.current = null;
        }
    };

    // X버튼 — 전체 초기화 후 닫기
    const handleClose = () => {
        setSearchMessages([...INITIAL_SEARCH_MESSAGES]);
        setFolderPreview(null);
        setInput('');
        setErrorMessage('');
        sessionIdRef.current = null;
        setSessionId(null);
        resetEditState();
        onClose();
    };

    const handleTabChange = (tab: ChatTab) => {
        setActiveTab(tab);
        setErrorMessage('');
    };

    // 채팅 세션 초기화
    useEffect(() => {
        if (!isOpen || sessionIdRef.current !== null) return;
        if (!isGuestChatMode && !isLoggedIn) {
            setErrorMessage('로그인 후 챗봇을 사용할 수 있습니다.');
            return;
        }
        let mounted = true;
        startChatSession()
            .then((id) => {
                if (!mounted) return;
                setSessionIdSync(id);
                if (onSessionStart) onSessionStart(id);
            })
            .catch((error: unknown) => {
                if (!mounted) return;
                setErrorMessage(error instanceof Error ? error.message : '세션을 시작할 수 없습니다.');
            });
        return () => { mounted = false; };
    }, [isGuestChatMode, isLoggedIn, isOpen, onSessionStart]);

    // selectedPhotoId로 편집 세션 자동 시작
    useEffect(() => {
        if (!isOpen || activeTab !== 'edit' || !isLoggedIn || !selectedPhotoId) return;
        if (editSessionPhotoIdRef.current === selectedPhotoId && editSessionIdRef.current !== null) return;
        if (isEditSessionLoading) return;

        setIsEditSessionLoading(true);
        setErrorMessage('');
        editSessionPhotoIdRef.current = selectedPhotoId;

        const resolveTargetId = async () => {
            try {
                const detail = await getPhotoDetail(selectedPhotoId);
                return detail.postId ?? selectedPhotoId;
            } catch {
                return selectedPhotoId;
            }
        };

        resolveTargetId()
            .then((targetId) => startEditSession(targetId))
            .then((res) => {
                setEditSessionIdSync(res.editSessionId);
                return getCurrentEditVersion(res.editSessionId);
            })
            .then((ver) => {
                if (ver.imageUrl) setEditedImageUrl(ver.imageUrl);
                appendEditMessage('assistant', '원본 이미지를 불러왔습니다. 편집 명령을 입력해주세요.');
            })
            .catch((error: unknown) => {
                editSessionPhotoIdRef.current = null;
                setErrorMessage(error instanceof Error ? error.message : '편집 세션을 시작할 수 없습니다.');
            })
            .finally(() => setIsEditSessionLoading(false));
    }, [isOpen, activeTab, isLoggedIn, selectedPhotoId, isEditSessionLoading]);

    // 로그인 시 오류 메시지 초기화
    useEffect(() => {
        if (isLoggedIn && errorMessage.includes('로그인 후')) {
            setErrorMessage('');
        }
    }, [errorMessage, isLoggedIn]);

    // 검색 탭 스크롤
    useEffect(() => {
        if (!bodyRef.current) return;
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [searchMessages, errorMessage]);

    // 편집 탭 스크롤
    useEffect(() => {
        if (!editChatRef.current) return;
        editChatRef.current.scrollTop = editChatRef.current.scrollHeight;
    }, [editMessages]);

    // ObjectURL 정리
    useEffect(() => {
        return () => {
            if (localEditPreviewUrlRef.current) URL.revokeObjectURL(localEditPreviewUrlRef.current);
        };
    }, []);

    const ensureSessionId = async (): Promise<number> => {
        if (sessionIdRef.current !== null && sessionIdRef.current > 0) return sessionIdRef.current;
        const newId = await startChatSession();
        setSessionIdSync(newId);
        if (onSessionStart) onSessionStart(newId);
        return newId;
    };

    const ensureEditSessionId = (): number => {
        if (editSessionIdRef.current !== null && editSessionIdRef.current > 0) return editSessionIdRef.current;
        throw new Error('편집 세션이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    };

    const updateSearchMessage = (targetId: string, content: string) => {
        setSearchMessages((prev) => prev.map((m) => (m.id === targetId ? { ...m, content } : m)));
    };

    const appendSearchMessage = (role: ChatRole, content: string): string => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setSearchMessages((prev) => [...prev, { id, role, content }]);
        return id;
    };

    const appendEditMessage = (role: ChatRole, content: string): string => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setEditMessages((prev) => [...prev, { id, role, content }]);
        return id;
    };

    const isFolderOrganizeIntent = (text: string) => {
        const n = text.trim().toLocaleLowerCase();
        return [
            '폴더', '분류', '정리', '묶', '모아', '앨범', '그룹', '카테고리',
            'folder', 'organize', 'group', 'categorize', 'cluster', 'create folder'
        ].some((k) => n.includes(k));
    };

    const isDemoStreamInput = (text: string) => {
        const n = text.trim().toLocaleLowerCase();
        return n === '/stream-test' || n.includes('스트리밍 테스트');
    };

    const streamDemoAssistantMessage = async (targetId: string) => {
        const chunks = ['따뜻한 ', '노을이 ', '비친 ', '바다 ', '사진을 ', '찾았어요. ', '마음에 ', '드는 ', '분위기를 ', '골라서 ', '알려주시면 ', '더 ', '정확히 ', '추천해드릴게요.'];
        let streamed = '';
        for (const chunk of chunks) {
            streamed += chunk;
            updateSearchMessage(targetId, streamed);
            await new Promise<void>((resolve) => { window.setTimeout(resolve, 70); });
        }
    };

    // URL에서 photoId 추출 (/photos/20/xxx → 20)
    const extractPhotoIdFromUrl = (url: string): number | null => {
        const match = url.match(/\/photos\/(\d+)\//);
        return match ? Number(match[1]) : null;
    };

    const startEditSessionFromUrl = (photoId: number) => {
        if (editSessionIdRef.current !== null || isEditSessionLoading) return;
        setIsEditSessionLoading(true);
        editSessionPhotoIdRef.current = photoId;

        const resolveTargetId = async () => {
            try {
                const detail = await getPhotoDetail(photoId);
                return detail.postId ?? photoId;
            } catch {
                return photoId;
            }
        };

        resolveTargetId()
            .then((targetId) => startEditSession(targetId))
            .then((res) => {
                setEditSessionIdSync(res.editSessionId);
                appendEditMessage('assistant', '편집 세션이 준비되었습니다. 편집 명령을 입력해주세요.');
            })
            .catch((error: unknown) => {
                editSessionPhotoIdRef.current = null;
                setErrorMessage(error instanceof Error ? error.message : '편집 세션을 시작할 수 없습니다.');
            })
            .finally(() => setIsEditSessionLoading(false));
    };

    const buildSearchCandidates = (query: string): string[] => {
        const normalized = query.replace(/\s+/g, ' ').trim();
        const simplified = normalized
            .replace(/검색해줘|검색해 줘|검색|찾아줘|찾아 줘|찾아|보여줘|보여 줘|추천해줘|추천해 줘|추천|해줘|해 줘/gi, ' ')
            .replace(/[!?.,]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const composed = simplified
            .replace(/\b와\b|\b과\b|\b및\b|\b랑\b|\b하고\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return Array.from(new Set([normalized, composed, simplified].filter((v) => v.length > 1)));
    };

    const mapSearchItemsToPhotos = (items: SearchResultItem[], trimmed: string): ChatFolderPreviewPhoto[] => {
        const toNumber = (value: unknown): number => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string' && value.trim()) {
                const parsed = Number(value);
                if (Number.isFinite(parsed)) return parsed;
            }
            return 0;
        };
        const toText = (value: unknown): string => {
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            return '';
        };
        const normalize = (value: string): string => value.toLocaleLowerCase().trim();
        const compact = (value: string): string => normalize(value).replace(/\s+/g, '');
        const expandToken = (token: string): string[] => {
            const base = compact(token);
            if (!base) return [];
            const expanded = new Set<string>([base]);
            if (base.length >= 4) {
                for (let i = 0; i <= base.length - 2; i += 1) {
                    expanded.add(base.slice(i, i + 2));
                }
            }
            return Array.from(expanded);
        };

        const queryTokens = normalize(trimmed)
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length > 1)
            .filter((token) => !['사진', '검색', '찾아', '찾기', '해줘', '보여줘'].includes(token));
        const expandedQueryTokens = Array.from(new Set(queryTokens.flatMap((token) => expandToken(token))));

        const scoreByQuery = (item: SearchResultItem): number => {
            const itemRecord = item as Record<string, unknown>;
            const serverScoreRaw =
                itemRecord.score ?? itemRecord.similarity ?? itemRecord.similarityScore ?? itemRecord.relevanceScore;
            const serverScore = toNumber(serverScoreRaw);
            const bag = [
                item.title,
                itemRecord.description, itemRecord.caption, itemRecord.prompt,
                itemRecord.style, itemRecord.tags, itemRecord.category
            ]
                .map((v) => Array.isArray(v) ? v.join(' ') : toText(v))
                .join(' ')
                .toLocaleLowerCase();
            const compactBag = compact(bag);
            const compactFullQuery = compact(trimmed);

            if (!bag) {
                return compactFullQuery.length > 1 &&
                    compact(toText(itemRecord.previewUrl) || toText(itemRecord.thumbnailUrl) || toText(itemRecord.imageUrl)).includes(compactFullQuery)
                    ? 50 : 0;
            }

            let score = serverScore > 0 ? serverScore * 20 : 0;
            const fullQuery = normalize(trimmed);
            if (fullQuery.length > 1 && bag.includes(fullQuery)) score += 10;
            if (compact(fullQuery).length > 1 && compactBag.includes(compact(fullQuery))) score += 14;
            for (const token of queryTokens) { if (bag.includes(token)) score += 4; }
            for (const token of expandedQueryTokens) { if (compactBag.includes(token)) score += token.length >= 4 ? 4 : 1; }
            return score;
        };

        return items
            .map((item, index) => {
                const score = scoreByQuery(item);
                return {
                    index,
                    score,
                    matched: score >= 10,
                    photo: {
                        photoId: toNumber(item.photoId) || toNumber(item.postId),
                        previewUrl: toText(item.previewUrl) || toText(item.thumbnailUrl) || toText(item.imageUrl),
                        shotAt: toText(item.shotAt)
                    }
                };
            })
            .sort((a, b) => {
                if (a.matched !== b.matched) return a.matched ? -1 : 1;
                if (b.score !== a.score) return b.score - a.score;
                return a.index - b.index;
            })
            .map((entry) => entry.photo)
            .filter((item) => item.photoId > 0 && !!item.previewUrl);
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isSending) return;

        setErrorMessage('');
        setInput('');
        setIsSending(true);

        try {
            if (activeTab === 'search') {
                appendSearchMessage('user', trimmed);

                if (isGuestChatMode) {
                    const id = appendSearchMessage('assistant', '');
                    await streamDemoAssistantMessage(id);
                    return;
                }
                if (!isLoggedIn) {
                    appendSearchMessage('assistant', '로그인 후 검색 챗봇을 사용할 수 있습니다.');
                    return;
                }

                const currentSessionId = await ensureSessionId();

                const shouldOrganize =
                    searchMode === 'organize' ||
                    (searchMode === 'auto' && isFolderOrganizeIntent(trimmed));

                if (shouldOrganize) {
                    const preview = await previewAutoFolder({ chatSessionId: currentSessionId, userText: trimmed, topK: 20 });
                    const photoIds = preview.photos.map((p) => p.photoId).filter((id) => id > 0);
                    setFolderPreview({
                        folderName: preview.suggestedFolderName || 'AI 추천 폴더',
                        photoIds,
                        status: 'pending',
                        folderType: 'PERSONAL',
                        photos: preview.photos,
                        selectedPhotoIds: photoIds
                    });
                    setFolderPreviewType('PERSONAL');
                    appendSearchMessage('assistant',
                        `추천 폴더명: ${preview.suggestedFolderName || 'AI 추천 폴더'}\n분류 후보 사진: ${preview.photos.length}장\n아래에서 포함할 사진을 선택하고 생성해주세요.`
                    );
                    return;
                }

                const assistantMessageId = appendSearchMessage('assistant', '');
                let streamedText = '';

                if (isDemoStreamInput(trimmed)) {
                    await streamDemoAssistantMessage(assistantMessageId);
                    return;
                }

                const handleDelta = (delta: string) => {
                    streamedText += delta;
                    updateSearchMessage(assistantMessageId, streamedText);
                };

                if (searchMode === 'search' || searchMode === 'auto') {
                    const searchCandidates = buildSearchCandidates(trimmed);
                    let hasResultItems = false;
                    try {
                        await streamSearchChat({
                            sessionId: currentSessionId,
                            message: searchCandidates[0] ?? trimmed,
                            onDelta: handleDelta,
                            onResults: (items) => {
                                const mapped = mapSearchItemsToPhotos(items, trimmed);
                                hasResultItems = mapped.length > 0;
                                onSearchResults?.({ query: trimmed, photos: mapped });
                            }
                        });

                        if (!hasResultItems) {
                            for (const candidate of searchCandidates) {
                                try {
                                    const preview = await previewAutoFolder({
                                        chatSessionId: currentSessionId,
                                        userText: candidate,
                                        topK: 24
                                    });
                                    if (preview.photos.length > 0) {
                                        hasResultItems = true;
                                        onSearchResults?.({ query: trimmed, photos: preview.photos });
                                        break;
                                    }
                                } catch {
                                    // fallback 후보를 순차 시도
                                }
                            }
                        }

                        if (!hasResultItems && streamedText.trim().length === 0) {
                            await streamTextChat({
                                sessionId: currentSessionId,
                                message: trimmed,
                                onDelta: handleDelta,
                                onError: (code) => { setErrorMessage(`스트리밍 오류: ${code}`); }
                            });
                        }
                    } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : '';
                        if (streamedText.trim().length > 0) return;
                        const isProtocolError =
                            message.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
                            message.includes('TypeError: Failed to fetch') ||
                            message.includes('NetworkError');
                        if (!isProtocolError) throw error;
                        await streamTextChat({
                            sessionId: currentSessionId,
                            message: trimmed,
                            onDelta: handleDelta,
                            onError: (code) => { setErrorMessage(`스트리밍 오류: ${code}`); }
                        });
                    }
                } else {
                    await streamTextChat({
                        sessionId: currentSessionId,
                        message: trimmed,
                        onDelta: handleDelta,
                        onError: (code) => { setErrorMessage(`스트리밍 오류: ${code}`); }
                    });
                }

                if (!streamedText) updateSearchMessage(assistantMessageId, '응답이 비어 있습니다.');

            } else {
                appendEditMessage('user', trimmed);

                if (isGuestChatMode) {
                    appendEditMessage('assistant', '편집 챗봇은 로그인 연결 후 사용할 수 있습니다.');
                    return;
                }
                if (!isLoggedIn) {
                    appendEditMessage('assistant', '로그인 후 편집 챗봇을 사용할 수 있습니다.');
                    return;
                }
                if (editSessionIdRef.current === null) {
                    appendEditMessage('assistant', '편집할 사진을 갤러리에서 선택하거나 드래그해서 올려주세요.');
                    return;
                }

                const currentSessionId = await ensureSessionId();
                const currentEditSessionId = ensureEditSessionId();

                const reply = await sendEditChat(currentSessionId, currentEditSessionId, trimmed);

                const nextText = reply.assistantContent || '편집 응답이 비어 있습니다.';
                appendEditMessage('assistant', nextText);
                if (reply.editedUrl) setEditedImageUrl(reply.editedUrl);
            }
        } catch (error: unknown) {
            setErrorMessage(error instanceof Error ? error.message : '메시지 전송 중 오류가 발생했습니다.');
        } finally {
            setIsSending(false);
        }
    };

    const handleUndo = async () => {
        if (isSending || editSessionIdRef.current === null) return;
        setIsSending(true);
        try {
            const res = await undoEdit(editSessionIdRef.current);
            setEditedImageUrl(res.imageUrl);
            appendEditMessage('assistant', `이전 단계로 되돌렸습니다. (v${res.versionIndex})`);
            setErrorMessage('');
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '되돌리기 실패');
        } finally {
            setIsSending(false);
        }
    };

    const handleRedo = async () => {
        if (isSending || editSessionIdRef.current === null) return;
        setIsSending(true);
        try {
            const res = await redoEdit(editSessionIdRef.current);
            setEditedImageUrl(res.imageUrl);
            appendEditMessage('assistant', `다음 단계로 이동했습니다. (v${res.versionIndex})`);
            setErrorMessage('');
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '다시 실행 실패');
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveAndExit = async () => {
        if (!editedImageUrl || isSaving || editSessionIdRef.current === null) return;
        setIsSaving(true);
        try {
            const finalUrl = await finalizeEdit(editSessionIdRef.current);
            setEditedImageUrl(finalUrl);
            appendEditMessage('assistant', '최종 저장이 완료되었습니다. 갤러리에서 확인하세요!');
            setTimeout(() => onClose(), 1500);
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoToggle = (photoId: number) => {
        if (!folderPreview) return;
        setFolderPreview((prev) => {
            if (!prev) return prev;
            const newSelected = prev.selectedPhotoIds.includes(photoId)
                ? prev.selectedPhotoIds.filter((id) => id !== photoId)
                : [...prev.selectedPhotoIds, photoId];
            return { ...prev, selectedPhotoIds: newSelected };
        });
    };

    const handleFolderConfirm = async (accepted: boolean, folderType: 'PERSONAL' | 'SHARED' = folderPreviewType) => {
        if (!folderPreview || folderPreview.status !== 'pending') return;
        setIsSending(true);
        setErrorMessage('');
        try {
            const currentSessionId = sessionIdRef.current || await ensureSessionId();
            await confirmAutoFolder({
                chatSessionId: currentSessionId,
                accepted,
                folderName: folderPreview.folderName,
                photoIds: folderPreview.selectedPhotoIds,
                folderType
            });
            setFolderPreview((prev) => prev ? { ...prev, status: accepted ? 'accepted' : 'rejected' } : prev);
            if (accepted && folderPreview) {
                onFolderCreated?.(folderPreview.folderName, folderType, [...folderPreview.selectedPhotoIds]);
            }
            appendSearchMessage('assistant', accepted ? '폴더가 생성되었습니다.' : '폴더 생성을 취소했습니다.');
        } catch (error: unknown) {
            setErrorMessage(error instanceof Error ? error.message : '폴더 생성 확정 중 오류가 발생했습니다.');
        } finally {
            setIsSending(false);
        }
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') { event.preventDefault(); void handleSend(); }
    };

    const isLikelyImageUrl = (value: string) => {
        const t = value.trim();
        if (!t) return false;
        if (t.startsWith('blob:') || t.startsWith('data:image/')) return true;
        if (t.includes('cloudfront.net') || t.includes('amazonaws.com')) return true;
        return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(t);
    };

    const applyDroppedEditImage = (file: File) => {
        if (!file.type.startsWith('image/')) { setErrorMessage('이미지 파일만 드롭할 수 있습니다.'); return; }
        resetEditState();
        const objectUrl = URL.createObjectURL(file);
        localEditPreviewUrlRef.current = objectUrl;
        setEditedImageUrl(objectUrl);
        appendEditMessage('assistant', '새 이미지가 적용되었습니다. 편집 명령을 입력해주세요.');
        setErrorMessage('');
    };

    const applyDroppedEditUrl = (url: string) => {
        const t = url.trim();
        if (!t || !isLikelyImageUrl(t)) { setErrorMessage('이미지 URL만 드롭할 수 있습니다.'); return; }
        resetEditState();
        setEditedImageUrl(t);
        setErrorMessage('');
        const photoId = extractPhotoIdFromUrl(t);
        if (photoId) {
            appendEditMessage('assistant', '이미지를 인식했습니다. 편집 세션을 시작하는 중...');
            startEditSessionFromUrl(photoId);
        } else {
            appendEditMessage('assistant', '드롭한 이미지가 적용되었습니다. (외부 이미지는 AI 편집이 제한될 수 있습니다.)');
        }
    };

    const handleEditDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditDragOver(false);

        const files = Array.from(event.dataTransfer.files);
        const imageFile = files.find((f) => f.type.startsWith('image/'));
        if (imageFile) { applyDroppedEditImage(imageFile); return; }

        const fromItems = Array.from(event.dataTransfer.items || [])
            .map((i) => i.getAsFile())
            .find((f): f is File => !!f && f.type.startsWith('image/'));
        if (fromItems) { applyDroppedEditImage(fromItems); return; }

        const uriList = event.dataTransfer.getData('text/uri-list');
        if (uriList) {
            const firstUrl = uriList.split(/\r?\n/).map((l) => l.trim()).find((l) => !!l && !l.startsWith('#'));
            if (firstUrl) { applyDroppedEditUrl(firstUrl); return; }
        }

        const plainText = event.dataTransfer.getData('text/plain');
        if (plainText) { applyDroppedEditUrl(plainText); return; }

        setErrorMessage('드롭된 파일을 읽지 못했습니다.');
    };

    const handleEditDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isEditDragOver) setIsEditDragOver(true);
    };

    const handleEditDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditDragOver(true);
    };

    const handleEditDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const related = event.relatedTarget as HTMLElement | null;
        if (related && event.currentTarget.contains(related)) return;
        setIsEditDragOver(false);
    };

    if (!isOpen) {
        return (
            <button className="chatbot-open-trigger" onClick={onOpen}>
                챗봇 열기
            </button>
        );
    }

    const isEditReady = editSessionIdRef.current !== null && !isEditSessionLoading;

    return (
        <aside className="chatbot-container">
            <div className="chatbot-window">

                {/* 헤더 */}
                <div className="chatbot-header">
                    <div className="tabs">
                        <button
                            className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
                            onClick={() => handleTabChange('search')}
                        >
                            검색
                        </button>
                        <button
                            className={`tab-btn edit ${activeTab === 'edit' ? 'active' : ''}`}
                            onClick={() => handleTabChange('edit')}
                        >
                            편집
                        </button>
                    </div>
                    <button className="panel-close-btn" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* 바디 */}
                <div className="chatbot-body" ref={activeTab === 'search' ? bodyRef : undefined}>
                    {activeTab === 'search' ? (
                        // ── 검색 탭
                        <div className="chat-view scroll-hide">
                            {searchMessages.map((m) => (
                                <div
                                    key={m.id}
                                    className={m.role === 'assistant' ? 'msg-bubble-bot' : 'msg-bubble-user'}
                                >
                                    {m.content || '...'}
                                </div>
                            ))}
                            {folderPreview && folderPreview.status === 'pending' && (
                                <div>
                                    <div className="folder-preview-grid">
                                        {folderPreview.photos.map((photo) => (
                                            <div
                                                key={photo.photoId}
                                                className={`folder-preview-photo ${folderPreview.selectedPhotoIds.includes(photo.photoId) ? 'selected' : ''}`}
                                                onClick={() => handlePhotoToggle(photo.photoId)}
                                            >
                                                {photo.previewUrl ? (
                                                    <img src={photo.previewUrl} alt="preview" />
                                                ) : (
                                                    <div className="folder-preview-photo-empty">사진 {photo.photoId}</div>
                                                )}
                                                {folderPreview.selectedPhotoIds.includes(photo.photoId) && (
                                                    <div className="photo-selected-badge">✓</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="folder-preview-count">
                                        선택된 사진: {folderPreview.selectedPhotoIds.length}장
                                    </div>
                                    <div className="folder-preview-actions">
                                        <div className="folder-type-selector">
                                            <button
                                                className={`folder-type-btn ${folderPreviewType === 'PERSONAL' ? 'active' : ''}`}
                                                onClick={() => setFolderPreviewType('PERSONAL')}
                                                disabled={isSending}
                                            >
                                                📁 폴더
                                            </button>
                                            <button
                                                className={`folder-type-btn ${folderPreviewType === 'SHARED' ? 'active' : ''}`}
                                                onClick={() => setFolderPreviewType('SHARED')}
                                                disabled={isSending}
                                            >
                                                🔗 공유폴더
                                            </button>
                                        </div>
                                        <div className="folder-action-buttons">
                                            <button
                                                className="folder-preview-btn accept"
                                                onClick={() => void handleFolderConfirm(true)}
                                                disabled={isSending}
                                            >
                                                생성
                                            </button>
                                            <button
                                                className="folder-preview-btn reject"
                                                onClick={() => void handleFolderConfirm(false)}
                                                disabled={isSending}
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {errorMessage && <div className="chat-error-text">{errorMessage}</div>}
                        </div>
                    ) : (
                        // ── 편집 탭
                        <div className="edit-view">
                            {/* 이미지 프리뷰 */}
                            <div
                                className={`edit-preview-area ${isEditDragOver ? 'drag-over' : ''}`}
                                onDragOver={handleEditDragOver}
                                onDragEnter={handleEditDragEnter}
                                onDragLeave={handleEditDragLeave}
                                onDrop={handleEditDrop}
                            >
                                {isEditSessionLoading ? (
                                    <p className="preview-placeholder">편집 세션 준비 중...</p>
                                ) : editedImageUrl ? (
                                    <img src={editedImageUrl} alt="편집 결과" className="edit-preview-image" />
                                ) : !selectedPhotoId ? (
                                    <p className="preview-placeholder">편집할 사진을 선택해주세요.</p>
                                ) : (
                                    <p className="preview-placeholder">편집할 이미지를 여기에 드래그해서 놓아주세요.</p>
                                )}
                            </div>

                            {/* 대화창 — 스크롤 가능 */}
                            <div className="edit-chat-view" ref={editChatRef}>
                                {editMessages.map((m) => (
                                    <div
                                        key={m.id}
                                        className={m.role === 'assistant' ? 'msg-bubble-bot' : 'msg-bubble-user'}
                                    >
                                        {m.content || '...'}
                                    </div>
                                ))}
                            </div>

                            {errorMessage && <div className="chat-error-text">{errorMessage}</div>}

                            {/* 하단 고정: Undo/Redo + 직접편집 + 저장및종료 */}
                            <div className="edit-bottom">
                                <div className="edit-toolbar">
                                    <button
                                        className="tool-btn"
                                        onClick={() => void handleUndo()}
                                        disabled={isSending || !isEditReady}
                                        title="실행 취소"
                                    >
                                        <Undo size={16} />
                                    </button>
                                    <button
                                        className="tool-btn"
                                        onClick={() => void handleRedo()}
                                        disabled={isSending || !isEditReady}
                                        title="다시 실행"
                                    >
                                        <Redo size={16} />
                                    </button>
                                    <button
                                        className="tool-btn direct-edit"
                                        disabled={!editedImageUrl || !isEditReady}
                                        title="직접 편집"
                                    >
                                        <Edit3 size={14} /> 직접 편집
                                    </button>
                                </div>
                                <button
                                    className="save-finish-btn"
                                    onClick={() => void handleSaveAndExit()}
                                    disabled={!editedImageUrl || isSaving || !isEditReady}
                                >
                                    <Save size={16} />
                                    {isSaving ? '저장 중...' : '저장 및 종료'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 푸터 입력창 */}
                <div className="chatbot-footer">
                    {activeTab === 'search' ? (
                        <div className="search-mode-row" role="group" aria-label="검색 모드 선택">
                            <button
                                type="button"
                                className={`search-mode-chip ${searchMode === 'auto' ? 'active' : ''}`}
                                onClick={() => setSearchMode('auto')}
                            >
                                자동
                            </button>
                            <button
                                type="button"
                                className={`search-mode-chip ${searchMode === 'search' ? 'active' : ''}`}
                                onClick={() => setSearchMode('search')}
                            >
                                검색
                            </button>
                            <button
                                type="button"
                                className={`search-mode-chip ${searchMode === 'organize' ? 'active' : ''}`}
                                onClick={() => setSearchMode('organize')}
                            >
                                폴더 생성
                            </button>
                        </div>
                    ) : null}
                    <div className="input-field-pill">
                        <input
                            type="text"
                            className="chat-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            disabled={isSending || (activeTab === 'edit' && isEditSessionLoading)}
                            placeholder={
                                isEditSessionLoading
                                    ? '편집 세션 준비 중...'
                                    : isSending
                                        ? '응답 생성 중...'
                                        : activeTab === 'edit'
                                            ? 'AI에게 편집 명령을 입력하세요...'
                                            : isGuestChatMode
                                                ? '게스트 모드: 메시지를 입력하세요...'
                                                : searchMode === 'organize'
                                                    ? '예: 여행 사진을 폴더로 묶어줘'
                                                    : '메시지를 입력하세요...'
                            }
                        />
                        <button
                            className="chat-send-btn"
                            onClick={() => void handleSend()}
                            disabled={isSending || (activeTab === 'edit' && isEditSessionLoading)}
                        >
                            {isSending ? '전송중' : '전송'}
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
