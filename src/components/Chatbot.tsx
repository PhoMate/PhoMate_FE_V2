import React, { useEffect, useRef, useState } from 'react';
import { X, Edit3, Undo, Redo, Save } from 'lucide-react';
import {
    type ChatFolderPreviewPhoto,
    confirmAutoFolder,
    previewAutoFolder,
    sendEditChat,
    startChatSession,
    streamSearchChat,
    streamTextChat
} from '../api/chat';
import {
    startEditSession,
    getCurrentEditVersion,
    undoEdit,
    redoEdit,
    finalizeEdit
} from '../api/edit';
import '../styles/Chatbot.css';

type ChatTab = 'search' | 'edit';
type ChatRole = 'assistant' | 'user';

type ChatMessage = {
    id: string;
    role: ChatRole;
    content: string;
};

type FolderPreviewState = {
    folderName: string;
    photoIds: number[];
    status: 'pending' | 'accepted' | 'rejected';
};

type ChatbotProps = {
    isOpen: boolean;
    onClose: () => void;
    onOpen: () => void;
    isLoggedIn: boolean;
    selectedPhotoId?: number | null;
    onSearchResults?: (payload: { query: string; photos: ChatFolderPreviewPhoto[] }) => void;
};

export default function Chatbot({ isOpen, onClose, onOpen, isLoggedIn, selectedPhotoId, onSearchResults }: ChatbotProps) {
    const isGuestChatMode = import.meta.env.VITE_CHAT_GUEST_MODE === 'true';
    const [activeTab, setActiveTab] = useState<ChatTab>('search');

    const [sessionId, setSessionId] = useState<number | null>(null);
    const sessionIdRef = useRef<number | null>(null);

    const [editSessionId, setEditSessionId] = useState<number | null>(null);
    const editSessionIdRef = useRef<number | null>(null);
    const [isEditSessionLoading, setIsEditSessionLoading] = useState(false);
    const editSessionPhotoIdRef = useRef<number | null>(null);

    const [searchMessages, setSearchMessages] = useState<ChatMessage[]>([
        { id: 'initial-assistant', role: 'assistant', content: '사진에 대한 설명을 적어주세요.' }
    ]);
    const [editMessages, setEditMessages] = useState<ChatMessage[]>([
        { id: 'initial-edit-assistant', role: 'assistant', content: '편집할 사진을 선택하거나 이미지를 드래그해서 올려주세요.' }
    ]);

    const [editAssistantContent, setEditAssistantContent] = useState('');
    const [editedImageUrl, setEditedImageUrl] = useState('');
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [folderPreview, setFolderPreview] = useState<FolderPreviewState | null>(null);
    const [isEditDragOver, setIsEditDragOver] = useState(false);
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const localEditPreviewUrlRef = useRef<string | null>(null);

    const setSessionIdSync = (id: number) => {
        sessionIdRef.current = id;
        setSessionId(id);
    };

    const setEditSessionIdSync = (id: number) => {
        editSessionIdRef.current = id;
        setEditSessionId(id);
    };

    const handleTabChange = (tab: ChatTab) => {
        setActiveTab(tab);
        setErrorMessage('');
    };

    useEffect(() => {
        if (!isOpen || sessionIdRef.current !== null) return;
        if (!isGuestChatMode && !isLoggedIn) {
            setErrorMessage('로그인 후 챗봇을 사용할 수 있습니다.');
            return;
        }
        let mounted = true;
        startChatSession()
            .then((id) => { if (mounted) setSessionIdSync(id); })
            .catch((error: unknown) => {
                if (!mounted) return;
                setErrorMessage(error instanceof Error ? error.message : '세션을 시작할 수 없습니다.');
            });
        return () => { mounted = false; };
    }, [isGuestChatMode, isLoggedIn, isOpen]);

    // selectedPhotoId로 편집 세션 시작
    useEffect(() => {
        if (!isOpen || activeTab !== 'edit') return;
        if (!isLoggedIn) return;
        if (!selectedPhotoId) return;
        if (editSessionPhotoIdRef.current === selectedPhotoId && editSessionIdRef.current !== null) return;
        if (isEditSessionLoading) return;

        setIsEditSessionLoading(true);
        setErrorMessage('');
        editSessionPhotoIdRef.current = selectedPhotoId;

        startEditSession(selectedPhotoId)
            .then((res) => {
                const confirmedId = res.editSessionId;
                setEditSessionIdSync(confirmedId);
                return getCurrentEditVersion(confirmedId);
            })
            .then((ver) => {
                if (ver.imageUrl && !editedImageUrl) {
                    setEditedImageUrl(ver.imageUrl);
                }
                setEditAssistantContent('원본 이미지를 불러왔습니다. 편집 명령을 입력해주세요.');
            })
            .catch((error: unknown) => {
                editSessionPhotoIdRef.current = null;
                setErrorMessage(error instanceof Error ? error.message : '편집 세션을 시작할 수 없습니다.');
            })
            .finally(() => {
                setIsEditSessionLoading(false);
            });
    }, [isOpen, activeTab, isLoggedIn, selectedPhotoId, isEditSessionLoading]);

    useEffect(() => {
        if (isLoggedIn && errorMessage.includes('로그인 후')) {
            setErrorMessage('');
        }
    }, [errorMessage, isLoggedIn]);

    useEffect(() => {
        if (!bodyRef.current) return;
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [searchMessages, editMessages, errorMessage]);

    useEffect(() => {
        return () => {
            if (!localEditPreviewUrlRef.current) return;
            URL.revokeObjectURL(localEditPreviewUrlRef.current);
            localEditPreviewUrlRef.current = null;
        };
    }, []);

    const ensureSessionId = async (): Promise<number> => {
        if (sessionIdRef.current !== null && sessionIdRef.current > 0) return sessionIdRef.current;
        const newSessionId = await startChatSession();
        setSessionIdSync(newSessionId);
        return newSessionId;
    };

    const ensureEditSessionId = (): number => {
        if (editSessionIdRef.current !== null && editSessionIdRef.current > 0) return editSessionIdRef.current;
        throw new Error('편집 세션이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    };

    const appendSearchMessage = (role: ChatRole, content: string): string => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setSearchMessages((prev) => [...prev, { id, role, content }]);
        return id;
    };

    const updateSearchMessage = (targetId: string, content: string) => {
        setSearchMessages((prev) => prev.map((m) => m.id === targetId ? { ...m, content } : m));
    };

    const appendEditMessage = (role: ChatRole, content: string): string => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setEditMessages((prev) => [...prev, { id, role, content }]);
        return id;
    };

    const isSearchIntent = (text: string) => {
        const n = text.trim().toLocaleLowerCase();
        return ['검색', '찾아', '사진', '이미지', 'show me', 'find'].some((k) => n.includes(k));
    };

    const isFolderOrganizeIntent = (text: string) => {
        const n = text.trim().toLocaleLowerCase();
        return ['폴더', '분류', '정리', 'folder', 'organize', 'group'].some((k) => n.includes(k));
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

    // 드롭된 URL로 편집 세션 자동 시작
    const startEditSessionFromUrl = (photoId: number) => {
        if (editSessionIdRef.current !== null || isEditSessionLoading) return;

        setIsEditSessionLoading(true);
        editSessionPhotoIdRef.current = photoId;

        startEditSession(photoId)
            .then((res) => {
                const confirmedId = res.editSessionId;
                setEditSessionIdSync(confirmedId);
                setEditAssistantContent('편집 세션이 준비되었습니다. 편집 명령을 입력해주세요.');
                appendEditMessage('assistant', '편집 세션이 준비되었습니다. 편집 명령을 입력해주세요.');
            })
            .catch((error: unknown) => {
                editSessionPhotoIdRef.current = null;
                setErrorMessage(error instanceof Error ? error.message : '편집 세션을 시작할 수 없습니다.');
            })
            .finally(() => {
                setIsEditSessionLoading(false);
            });
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

                if (isFolderOrganizeIntent(trimmed)) {
                    const preview = await previewAutoFolder({ chatSessionId: currentSessionId, userText: trimmed, topK: 20 });
                    const photoIds = preview.photos.map((p) => p.photoId).filter((id) => id > 0);
                    setFolderPreview({ folderName: preview.suggestedFolderName || 'AI 추천 폴더', photoIds, status: 'pending' });
                    appendSearchMessage('assistant',
                        `추천 폴더명: ${preview.suggestedFolderName || 'AI 추천 폴더'}\n분류 후보 사진: ${preview.photos.length}장\n아래 버튼으로 생성 여부를 선택해주세요.`
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

                if (isSearchIntent(trimmed)) {
                    onSearchResults?.({ query: trimmed, photos: [] });
                    try {
                        const preview = await previewAutoFolder({ chatSessionId: currentSessionId, userText: trimmed, topK: 24 });
                        onSearchResults?.({ query: trimmed, photos: preview.photos });
                    } catch { }
                    try {
                        await streamSearchChat({ sessionId: currentSessionId, message: trimmed, onDelta: handleDelta });
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

                const reply = await sendEditChat({
                    chatSessionId: currentSessionId,
                    editSessionId: currentEditSessionId,
                    userText: trimmed
                });

                const nextText = reply.assistantContent || '편집 응답이 비어 있습니다.';
                appendEditMessage('assistant', nextText);
                setEditAssistantContent(nextText);
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
            setEditAssistantContent(`이전 단계로 되돌렸습니다. (v${res.versionIndex})`);
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
            setEditAssistantContent(`다음 단계로 이동했습니다. (v${res.versionIndex})`);
            setErrorMessage('');
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '다시 실행 실패');
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveAndExit = async () => {
        if (!editedImageUrl || isSending || editSessionIdRef.current === null) return;
        setIsSending(true);
        try {
            const finalUrl = await finalizeEdit(editSessionIdRef.current);
            setEditedImageUrl(finalUrl);
            setEditAssistantContent('최종 저장이 완료되었습니다. 갤러리에서 확인하세요!');
            setTimeout(() => onClose(), 1500);
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '저장 실패');
        } finally {
            setIsSending(false);
        }
    };

    const handleFolderConfirm = async (accepted: boolean) => {
        if (!folderPreview || folderPreview.status !== 'pending') return;
        setIsSending(true);
        setErrorMessage('');
        try {
            const response = await confirmAutoFolder({
                accepted,
                folderName: folderPreview.folderName,
                photoIds: folderPreview.photoIds
            });
            setFolderPreview((prev) => prev ? { ...prev, status: accepted ? 'accepted' : 'rejected' } : prev);
            appendSearchMessage('assistant', accepted
                ? response.folderId ? `폴더가 생성되었습니다. (folderId: ${response.folderId})` : '폴더 생성이 완료되었습니다.'
                : '폴더 생성을 취소했습니다.'
            );
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
        if (localEditPreviewUrlRef.current) { URL.revokeObjectURL(localEditPreviewUrlRef.current); localEditPreviewUrlRef.current = null; }
        const objectUrl = URL.createObjectURL(file);
        localEditPreviewUrlRef.current = objectUrl;
        setEditedImageUrl(objectUrl);
        setEditAssistantContent('드롭한 이미지가 적용되었습니다. (로컬 파일은 AI 편집이 제한될 수 있습니다.)');
        setErrorMessage('');
    };

    const applyDroppedEditUrl = (url: string) => {
        const t = url.trim();
        if (!t || !isLikelyImageUrl(t)) {
            setErrorMessage('이미지 URL만 드롭할 수 있습니다.');
            return;
        }
        if (localEditPreviewUrlRef.current) {
            URL.revokeObjectURL(localEditPreviewUrlRef.current);
            localEditPreviewUrlRef.current = null;
        }

        setEditedImageUrl(t);
        setErrorMessage('');

        // URL에서 photoId 추출 후 편집 세션 자동 시작
        const photoId = extractPhotoIdFromUrl(t);
        if (photoId) {
            setEditAssistantContent('이미지를 인식했습니다. 편집 세션을 시작하는 중...');
            startEditSessionFromUrl(photoId);
        } else {
            setEditAssistantContent('드롭한 이미지가 적용되었습니다. (외부 이미지는 AI 편집이 제한될 수 있습니다.)');
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
        return <button className="chatbot-open-trigger" onClick={onOpen}>챗봇 열기</button>;
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
                    <button className="panel-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* 바디 */}
                <div className="chatbot-body" ref={bodyRef}>
                    {activeTab === 'search' ? (
                        <div className="chat-view scroll-hide">
                            {searchMessages.map((message) => (
                                <div
                                    key={message.id}
                                    className={message.role === 'assistant' ? 'msg-bubble-bot' : 'msg-bubble-user'}
                                >
                                    {message.content || '...'}
                                </div>
                            ))}
                            {folderPreview && folderPreview.status === 'pending' ? (
                                <div className="folder-preview-actions">
                                    <button
                                        className="folder-preview-btn accept"
                                        onClick={() => void handleFolderConfirm(true)}
                                        disabled={isSending}
                                    >
                                        수락
                                    </button>
                                    <button
                                        className="folder-preview-btn reject"
                                        onClick={() => void handleFolderConfirm(false)}
                                        disabled={isSending}
                                    >
                                        거절
                                    </button>
                                </div>
                            ) : null}
                            {errorMessage ? <div className="chat-error-text">{errorMessage}</div> : null}
                        </div>
                    ) : (
                        <div className="edit-view">
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

                            {/* 편집 탭 전용 채팅 메시지 */}
                            <div className="chat-view scroll-hide" style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
                                {editMessages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={message.role === 'assistant' ? 'msg-bubble-bot' : 'msg-bubble-user'}
                                    >
                                        {message.content || '...'}
                                    </div>
                                ))}
                            </div>

                            {errorMessage ? (
                                <div className="chat-error-text">{errorMessage}</div>
                            ) : null}
                            <div className="edit-toolbar">
                                <button
                                    className="tool-btn"
                                    onClick={() => void handleUndo()}
                                    disabled={isSending || !isEditReady}
                                >
                                    <Undo size={16} />
                                </button>
                                <button
                                    className="tool-btn"
                                    onClick={() => void handleRedo()}
                                    disabled={isSending || !isEditReady}
                                >
                                    <Redo size={16} />
                                </button>
                                <button
                                    className="tool-btn direct-edit"
                                    disabled={!editedImageUrl || !isEditReady}
                                >
                                    <Edit3 size={14} /> 직접 편집
                                </button>
                            </div>
                            <button
                                className="save-finish-btn"
                                onClick={() => void handleSaveAndExit()}
                                disabled={!editedImageUrl || isSending || !isEditReady}
                            >
                                <Save size={16} /> {isSending ? '처리 중...' : '저장 및 종료'}
                            </button>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="chatbot-footer">
                    <div className="input-field-pill">
                        <input
                            type="text"
                            placeholder={
                                isEditSessionLoading
                                    ? '편집 세션 준비 중...'
                                    : isSending
                                        ? '응답 생성 중...'
                                        : activeTab === 'edit'
                                            ? 'AI에게 편집 명령을 입력하세요...'
                                            : isGuestChatMode
                                                ? '게스트 모드: 메시지를 입력하세요...'
                                                : '메시지를 입력하세요...'
                            }
                            className="chat-input"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={handleInputKeyDown}
                            disabled={isSending || (activeTab === 'edit' && isEditSessionLoading)}
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