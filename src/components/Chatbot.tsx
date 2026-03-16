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
    onSearchResults?: (payload: { query: string; photos: ChatFolderPreviewPhoto[] }) => void;
};

export default function Chatbot({ isOpen, onClose, onOpen, isLoggedIn, onSearchResults }: ChatbotProps) {
    const isGuestChatMode = import.meta.env.VITE_CHAT_GUEST_MODE === 'true';
    const [activeTab, setActiveTab] = useState<'search' | 'edit'>('search');
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [editSessionId] = useState<number>(1);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 'initial-assistant', role: 'assistant', content: '사진에 대한 설명을 적어주세요.' }
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

    useEffect(() => {
        if (!isOpen || sessionId) return;
        if (!isGuestChatMode && !isLoggedIn) {
            setErrorMessage('로그인 후 챗봇을 사용할 수 있습니다.');
            return;
        }

        let mounted = true;
        startChatSession()
            .then((id) => {
                if (mounted) setSessionId(id);
            })
            .catch((error: unknown) => {
                if (!mounted) return;
                const message = error instanceof Error ? error.message : '세션을 시작할 수 없습니다.';
                setErrorMessage(message);
            });

        return () => {
            mounted = false;
        };
    }, [isGuestChatMode, isLoggedIn, isOpen, sessionId]);

    useEffect(() => {
        if (isLoggedIn && errorMessage.includes('로그인 후')) {
            setErrorMessage('');
        }
    }, [errorMessage, isLoggedIn]);

    useEffect(() => {
        if (!bodyRef.current) return;
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [messages, errorMessage]);

    useEffect(() => {
        return () => {
            if (!localEditPreviewUrlRef.current) return;
            URL.revokeObjectURL(localEditPreviewUrlRef.current);
            localEditPreviewUrlRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!isOpen || activeTab !== 'edit') return;

        const blockDefaultDrop = (event: DragEvent) => {
            event.preventDefault();
        };

        window.addEventListener('dragover', blockDefaultDrop);
        window.addEventListener('drop', blockDefaultDrop);

        return () => {
            window.removeEventListener('dragover', blockDefaultDrop);
            window.removeEventListener('drop', blockDefaultDrop);
        };
    }, [activeTab, isOpen]);

    const ensureSessionId = async (): Promise<number> => {
        if (sessionId !== null) return sessionId;
        const newSessionId = await startChatSession();
        setSessionId(newSessionId);
        return newSessionId;
    };

    const appendMessage = (role: ChatRole, content: string): string => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setMessages((prev) => [...prev, { id, role, content }]);
        return id;
    };

    const updateMessage = (targetId: string, content: string) => {
        setMessages((prev) => prev.map((message) => (
            message.id === targetId ? { ...message, content } : message
        )));
    };

    const isSearchIntent = (text: string): boolean => {
        const normalized = text.trim().toLocaleLowerCase();
        if (!normalized) return false;

        const searchKeywords = ['검색', '찾아', '사진', '이미지', 'show me', 'find'];
        return searchKeywords.some((keyword) => normalized.includes(keyword));
    };

    const isFolderOrganizeIntent = (text: string): boolean => {
        const normalized = text.trim().toLocaleLowerCase();
        if (!normalized) return false;

        const folderKeywords = ['폴더', '분류', '정리', 'folder', 'organize', 'group'];
        return folderKeywords.some((keyword) => normalized.includes(keyword));
    };

    const isDemoStreamInput = (text: string): boolean => {
        const normalized = text.trim().toLocaleLowerCase();
        return normalized === '/stream-test' || normalized.includes('스트리밍 테스트');
    };

    const streamDemoAssistantMessage = async (assistantMessageId: string): Promise<void> => {
        const chunks = [
            '따뜻한 ',
            '노을이 ',
            '비친 ',
            '바다 ',
            '사진을 ',
            '찾았어요. ',
            '마음에 ',
            '드는 ',
            '분위기를 ',
            '골라서 ',
            '알려주시면 ',
            '더 ',
            '정확히 ',
            '추천해드릴게요.'
        ];

        let streamed = '';
        for (const chunk of chunks) {
            streamed += chunk;
            updateMessage(assistantMessageId, streamed);
            await new Promise<void>((resolve) => {
                window.setTimeout(() => resolve(), 70);
            });
        }
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isSending) return;

        setErrorMessage('');
        setInput('');
        appendMessage('user', trimmed);
        setIsSending(true);

        try {
            if (activeTab === 'search') {
                if (isGuestChatMode) {
                    const assistantMessageId = appendMessage('assistant', '');
                    await streamDemoAssistantMessage(assistantMessageId);
                    return;
                }

                if (!isLoggedIn) {
                    appendMessage('assistant', '로그인 후 검색 챗봇을 사용할 수 있습니다.');
                    return;
                }

                const currentSessionId = await ensureSessionId();

                if (isFolderOrganizeIntent(trimmed)) {
                    const preview = await previewAutoFolder({
                        chatSessionId: currentSessionId,
                        userText: trimmed,
                        topK: 20
                    });

                    const photoCount = preview.photos.length;
                    const photoIds = preview.photos.map((photo) => photo.photoId).filter((id) => id > 0);
                    setFolderPreview({
                        folderName: preview.suggestedFolderName || 'AI 추천 폴더',
                        photoIds,
                        status: 'pending'
                    });

                    appendMessage(
                        'assistant',
                        `추천 폴더명: ${preview.suggestedFolderName || 'AI 추천 폴더'}\n` +
                        `분류 후보 사진: ${photoCount}장\n` +
                        '아래 버튼으로 생성 여부를 선택해주세요.'
                    );
                    return;
                }

                const assistantMessageId = appendMessage('assistant', '');
                let streamedText = '';

                if (isDemoStreamInput(trimmed)) {
                    await streamDemoAssistantMessage(assistantMessageId);
                    return;
                }

                const useSearchStream = isSearchIntent(trimmed);

                const handleDelta = (delta: string) => {
                    streamedText += delta;
                    updateMessage(assistantMessageId, streamedText);
                };

                if (useSearchStream) {
                    onSearchResults?.({ query: trimmed, photos: [] });

                    try {
                        const preview = await previewAutoFolder({
                            chatSessionId: currentSessionId,
                            userText: trimmed,
                            topK: 24
                        });
                        onSearchResults?.({ query: trimmed, photos: preview.photos });
                    } catch {
                        // Keep text search working even if photo preview lookup fails.
                    }

                    try {
                        await streamSearchChat({
                            sessionId: currentSessionId,
                            message: trimmed,
                            onDelta: handleDelta
                        });
                    } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : '';

                        // Some servers close SSE over HTTP/2 with protocol errors after partial output.
                        if (streamedText.trim().length > 0) {
                            return;
                        }

                        const isProtocolError =
                            message.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
                            message.includes('TypeError: Failed to fetch') ||
                            message.includes('NetworkError');

                        if (!isProtocolError) {
                            throw error;
                        }

                        await streamTextChat({
                            sessionId: currentSessionId,
                            message: trimmed,
                            onDelta: handleDelta,
                            onError: (code) => {
                                setErrorMessage(`스트리밍 오류: ${code}`);
                            }
                        });
                    }
                } else {
                    await streamTextChat({
                        sessionId: currentSessionId,
                        message: trimmed,
                        onDelta: handleDelta,
                        onError: (code) => {
                            setErrorMessage(`스트리밍 오류: ${code}`);
                        }
                    });
                }

                if (!streamedText) {
                    updateMessage(assistantMessageId, '응답이 비어 있습니다.');
                }
            } else {
                if (isGuestChatMode) {
                    appendMessage('assistant', '편집 챗봇은 로그인 연결 후 사용할 수 있습니다.');
                    return;
                }

                if (!isLoggedIn) {
                    appendMessage('assistant', '로그인 후 편집 챗봇을 사용할 수 있습니다.');
                    return;
                }

                const currentSessionId = await ensureSessionId();

                const reply = await sendEditChat({
                    chatSessionId: currentSessionId,
                    editSessionId,
                    userText: trimmed
                });
                const nextText = reply.assistantContent || '편집 응답이 비어 있습니다.';
                appendMessage('assistant', nextText);
                setEditAssistantContent(nextText);
                if (reply.editedUrl) {
                    setEditedImageUrl(reply.editedUrl);
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '메시지 전송 중 오류가 발생했습니다.';
            setErrorMessage(message);
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

            setFolderPreview((prev) => {
                if (!prev) return prev;
                return { ...prev, status: accepted ? 'accepted' : 'rejected' };
            });

            if (accepted) {
                appendMessage(
                    'assistant',
                    response.folderId
                        ? `폴더가 생성되었습니다. (folderId: ${response.folderId})`
                        : '폴더 생성이 완료되었습니다.'
                );
            } else {
                appendMessage('assistant', '폴더 생성을 취소했습니다.');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '폴더 생성 확정 중 오류가 발생했습니다.';
            setErrorMessage(message);
        } finally {
            setIsSending(false);
        }
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void handleSend();
        }
    };

    const applyDroppedEditImage = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setErrorMessage('이미지 파일만 드롭할 수 있습니다.');
            return;
        }

        if (localEditPreviewUrlRef.current) {
            URL.revokeObjectURL(localEditPreviewUrlRef.current);
            localEditPreviewUrlRef.current = null;
        }

        const objectUrl = URL.createObjectURL(file);
        localEditPreviewUrlRef.current = objectUrl;
        setEditedImageUrl(objectUrl);
        setEditAssistantContent('드롭한 이미지가 편집 미리보기에 적용되었습니다.');
        setErrorMessage('');
    };

    const isLikelyImageUrl = (value: string): boolean => {
        const trimmed = value.trim();
        if (!trimmed) return false;
        if (trimmed.startsWith('blob:') || trimmed.startsWith('data:image/')) return true;
        return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(trimmed);
    };

    const applyDroppedEditUrl = (url: string) => {
        const trimmed = url.trim();
        if (!trimmed || !isLikelyImageUrl(trimmed)) {
            setErrorMessage('이미지 URL만 드롭할 수 있습니다.');
            return;
        }

        if (localEditPreviewUrlRef.current) {
            URL.revokeObjectURL(localEditPreviewUrlRef.current);
            localEditPreviewUrlRef.current = null;
        }

        setEditedImageUrl(trimmed);
        setEditAssistantContent('드롭한 이미지가 편집 미리보기에 적용되었습니다.');
        setErrorMessage('');
    };

    const handleEditDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditDragOver(false);

        const directFile = event.dataTransfer.files?.[0];
        if (directFile) {
            applyDroppedEditImage(directFile);
            return;
        }

        const fromItems = Array.from(event.dataTransfer.items || [])
            .map((item) => item.getAsFile())
            .find((file): file is File => !!file);

        if (fromItems) {
            applyDroppedEditImage(fromItems);
            return;
        }

        const uriList = event.dataTransfer.getData('text/uri-list');
        if (uriList) {
            const firstUrl = uriList
                .split(/\r?\n/)
                .map((line) => line.trim())
                .find((line) => !!line && !line.startsWith('#'));
            if (firstUrl) {
                applyDroppedEditUrl(firstUrl);
                return;
            }
        }

        const plainText = event.dataTransfer.getData('text/plain');
        if (plainText) {
            applyDroppedEditUrl(plainText);
            return;
        }

        setErrorMessage('드롭된 파일을 읽지 못했습니다.');
    };

    const handleEditDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isEditDragOver) {
            setIsEditDragOver(true);
        }
    };

    const handleEditDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditDragOver(false);
    };

    if (!isOpen) {
        return (
            <button className="chatbot-open-trigger" onClick={onOpen}>
                챗봇 열기
            </button>
        );
    }

    return (
        <aside className="chatbot-container">
            <div className="chatbot-window">
                {/* 1. 상단 탭 헤더 */}
                <div className="chatbot-header">
                    <div className="tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('search')}
                        >
                            검색
                        </button>
                        <button 
                            className={`tab-btn edit ${activeTab === 'edit' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('edit')}
                        >
                            편집
                        </button>
                    </div>
                    <button className="panel-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* 2. 메인 바디 */}
                <div className="chatbot-body" ref={bodyRef}>
                    {activeTab === 'search' ? (
                        <div className="chat-view scroll-hide">
                            {messages.map((message) => (
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
                            {errorMessage ? (
                                <div className="chat-error-text">{errorMessage}</div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="edit-view">
                            <div
                                className={`edit-preview-area ${isEditDragOver ? 'drag-over' : ''}`}
                                onDragOver={handleEditDragOver}
                                onDragEnter={handleEditDragOver}
                                onDragLeave={handleEditDragLeave}
                                onDrop={handleEditDrop}
                            >
                                {editedImageUrl ? (
                                    <img src={editedImageUrl} alt="편집 결과" className="edit-preview-image" />
                                ) : (
                                    <p className="preview-placeholder">편집할 이미지를 여기에 드래그해서 놓아주세요.</p>
                                )}
                            </div>
                            {editAssistantContent ? (
                                <div className="edit-result-text">{editAssistantContent}</div>
                            ) : null}
                            {/* 편집 툴바 */}
                            <div className="edit-toolbar">
                                <button className="tool-btn"><Undo size={16} /></button>
                                <button className="tool-btn"><Redo size={16} /></button>
                                <button className="tool-btn direct-edit">
                                    <Edit3 size={14} /> 직접 편집
                                </button>
                            </div>
                            <button className="save-finish-btn">
                                <Save size={16} /> 저장 및 종료
                            </button>
                        </div>
                    )}
                </div>

                {/* 3. 하단 입력창 */}
                <div className="chatbot-footer">
                    <div className="input-field-pill">
                        <input
                            type="text"
                            placeholder={isSending ? '응답 생성 중...' : (isGuestChatMode ? '게스트 모드: 메시지를 입력하세요...' : '메시지를 입력하세요...')}
                            className="chat-input"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={handleInputKeyDown}
                            disabled={isSending}
                        />
                        <button className="chat-send-btn" onClick={() => void handleSend()} disabled={isSending}>
                            {isSending ? '전송중' : '전송'}
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}