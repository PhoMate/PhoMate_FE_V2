import React, { useEffect, useRef, useState } from 'react';
import { X, Edit3, Undo, Redo, Save, Search, Wand2, Plus } from 'lucide-react';
import {
    type ChatFolderPreviewPhoto,
    type SearchResultItem,
    startChatSession,
    streamAgentRun,
    getFolderById
} from '../api/chat';
import {
    startEditSession,
    getCurrentEditVersion,
    undoEdit,
    redoEdit,
    finalizeEdit
} from '../api/edit';
import { getPhotoDetail, getAlbumLatest, createPhoto, getFolderPhotos } from '../api/photo';
import '../styles/Chatbot.css';

type ChatTab = 'search' | 'edit';
type ChatRole = 'assistant' | 'user';

type ChatMessage = {
    id: string;
    role: ChatRole;
    content: string;
    imageUrl?: string;
};

type FolderPreviewState = {
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
    onPhotoSaved?: (newPhotoId?: number) => void;
};

const INITIAL_SEARCH_MESSAGES: ChatMessage[] = [
    { id: 'initial-assistant', role: 'assistant', content: '사진을 설명하거나, 사진을 드래그해서 올려보세요. 드래그한 사진으로 사진 검색 또는 AI 편집을 시작합니다.' }
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
    onFolderCreated,
    onPhotoSaved
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
const [isDragOver, setIsDragOver] = useState(false);
    const [dragSide, setDragSide] = useState<'search' | 'edit'>('search');

    // 직접 편집 패널 상태
    const [isDirectEditOpen, setIsDirectEditOpen] = useState(false);
    const [deFilters, setDeFilters] = useState({ brightness: 100, contrast: 100, saturation: 100 });
    const [deRotation, setDeRotation] = useState(0);   // 누적값 (-360, -270, ..., 90, 180, ...)
    const [deFlipH, setDeFlipH] = useState(false);
    const [cropMode, setCropMode] = useState(false);
    const [cropAspect, setCropAspect] = useState<'3:4' | '16:9' | 'free' | null>(null);
    const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const cropDragRef = useRef<{ sx: number; sy: number } | null>(null);

    const [isUploading, setIsUploading] = useState(false);

    const bodyRef = useRef<HTMLDivElement | null>(null);
    const editChatRef = useRef<HTMLDivElement | null>(null);
    const localEditPreviewUrlRef = useRef<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        if (tab === 'search') resetEditState();
        setActiveTab(tab);
        setErrorMessage('');
    };

    // selectedPhotoId가 주어지면 자동으로 편집 모드로 전환
    useEffect(() => {
        if (selectedPhotoId) {
            handleTabChange('edit');
        }
    }, [selectedPhotoId]);

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

    const appendSearchMessageWithImage = (role: ChatRole, content: string, imageUrl: string): string => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setSearchMessages((prev) => [...prev, { id, role, content, imageUrl }]);
        return id;
    };

    const appendEditMessage = (role: ChatRole, content: string): string => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setEditMessages((prev) => [...prev, { id, role, content }]);
        return id;
    };

    const updateEditMessage = (targetId: string, content: string) => {
        setEditMessages((prev) => prev.map((m) => (m.id === targetId ? { ...m, content } : m)));
    };

    const mapAgentResultsToPhotos = (items: SearchResultItem[]): ChatFolderPreviewPhoto[] =>
        items
            .map((item) => ({
                photoId: (item.photoId ?? 0) || (item.postId ?? 0),
                previewUrl: item.previewUrl ?? item.thumbnailUrl ?? item.imageUrl ?? '',
                shotAt: item.shotAt ?? ''
            }))
            .filter((p) => p.photoId > 0 && !!p.previewUrl);

    const isFolderOrganizeIntent = (text: string) => {
        const n = text.trim().toLocaleLowerCase();
        return ['폴더', '분류', '정리', '묶', '모아', '앨범', '그룹', 'folder', 'organize', 'group'].some((k) => n.includes(k));
    };

    const isSearchIntent = (text: string) => {
        const n = text.trim();
        return ['검색', '찾아줘', '찾아봐', '찾아', '보여줘', '보여줄', '알려줘', '있어', '있을까', '어디', '뭐가', 'search', 'find', 'show me'].some((k) => n.includes(k));
    };

    const handlePhotoToggle = (photoId: number) => {
        setFolderPreview((prev) => {
            if (!prev) return prev;
            const selected = prev.selectedPhotoIds.includes(photoId)
                ? prev.selectedPhotoIds.filter((id) => id !== photoId)
                : [...prev.selectedPhotoIds, photoId];
            return { ...prev, selectedPhotoIds: selected };
        });
    };

    const handleFolderAction = async (confirm: boolean) => {
        if (!folderPreview) return;
        setIsSending(true);
        const selectedIds = folderPreview.selectedPhotoIds;
        setFolderPreview(null);
        try {
            const currentSessionId = await ensureSessionId();
            const assistantId = appendSearchMessage('assistant', '');
            let streamedText = '';
            await streamAgentRun({
                chatSessionId: currentSessionId,
                editSessionId: null,
                userText: confirm ? '응' : '아니',
                selectedPhotoIds: confirm ? selectedIds : undefined,
                onDelta: (delta) => { streamedText += delta; updateSearchMessage(assistantId, streamedText); },
                onFolderCreated: (data) => {
                    const d = data as { folderId?: number };
                    const folderId = d.folderId ?? 0;
                    if (folderId) {
                        void Promise.all([getFolderById(folderId), getFolderPhotos(folderId)]).then(([folder, photos]) => {
                            if (folder) onFolderCreated?.(folder.folderName, folder.folderType, photos.map((p) => p.photoId));
                        });
                    }
                },
                onError: (code) => { setErrorMessage(`오류: ${code}`); }
            });
            if (!streamedText) updateSearchMessage(assistantId, confirm ? '폴더를 만들었습니다.' : '폴더 생성을 취소했습니다.');
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setIsSending(false);
        }
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

    const handleFileSelectedForUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setErrorMessage('이미지 파일만 선택할 수 있습니다.');
            return;
        }
        setIsUploading(true);
        setErrorMessage('');
        try {
            await createPhoto(file);
            onPhotoSaved?.();

            const latest = await getAlbumLatest({ size: 1 });
            const latestPhoto = latest[0];
            if (!latestPhoto) throw new Error('업로드된 사진을 찾을 수 없습니다.');

            if (activeTab === 'search') {
                handleImageSearch(latestPhoto.previewUrl);
            } else {
                resetEditState();
                setEditedImageUrl(latestPhoto.previewUrl);
                startEditSessionFromUrl(latestPhoto.photoId);
            }
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '업로드에 실패했습니다.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
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
                const assistantId = appendSearchMessage('assistant', '');
                let streamedText = '';
                const isFolderIntent = isFolderOrganizeIntent(trimmed);

                await streamAgentRun({
                    chatSessionId: currentSessionId,
                    editSessionId: null,
                    userText: trimmed,
                    onDelta: (delta) => {
                        streamedText += delta;
                        updateSearchMessage(assistantId, streamedText);
                    },
                    onResults: (items) => {
                        const mapped = mapAgentResultsToPhotos(items);
                        if (mapped.length > 0) {
                            onSearchResults?.({ query: trimmed, photos: mapped });
                            if (isFolderIntent) {
                                setFolderPreview({
                                    photos: mapped,
                                    selectedPhotoIds: mapped.map((p) => p.photoId)
                                });
                            }
                        }
                    },
                    onFolderCreated: (data) => {
                        const d = data as { folderId?: number };
                        const folderId = d.folderId ?? 0;
                        if (folderId) {
                            void getFolderById(folderId).then((folder) => {
                                if (folder) onFolderCreated?.(folder.folderName, folder.folderType, []);
                            });
                        }
                        setFolderPreview(null);
                    },
                    onError: (code) => { setErrorMessage(`오류: ${code}`); }
                });

                if (!streamedText) updateSearchMessage(assistantId, '응답이 비어 있습니다.');

            } else {
                // 편집 모드에서 검색 의도 감지 → 검색 모드로 자동 전환
                if (isSearchIntent(trimmed)) {
                    resetEditState();
                    setActiveTab('search');
                    setErrorMessage('');
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
                    const assistantId = appendSearchMessage('assistant', '');
                    let streamedText = '';
                    const isFolderIntent = isFolderOrganizeIntent(trimmed);

                    await streamAgentRun({
                        chatSessionId: currentSessionId,
                        editSessionId: null,
                        userText: trimmed,
                        onDelta: (delta) => { streamedText += delta; updateSearchMessage(assistantId, streamedText); },
                        onResults: (items) => {
                            const mapped = mapAgentResultsToPhotos(items);
                            if (mapped.length > 0) {
                                onSearchResults?.({ query: trimmed, photos: mapped });
                                if (isFolderIntent) {
                                    setFolderPreview({ photos: mapped, selectedPhotoIds: mapped.map((p) => p.photoId) });
                                }
                            }
                        },
                        onFolderCreated: (data) => {
                            const d = data as { folderId?: number };
                            const folderId = d.folderId ?? 0;
                            if (folderId) {
                                void getFolderById(folderId).then((folder) => {
                                    if (folder) onFolderCreated?.(folder.folderName, folder.folderType, []);
                                });
                            }
                            setFolderPreview(null);
                        },
                        onError: (code) => { setErrorMessage(`오류: ${code}`); }
                    });

                    if (!streamedText) updateSearchMessage(assistantId, '응답이 비어 있습니다.');
                    return;
                }

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
                const editAssistantId = appendEditMessage('assistant', '');
                let editStreamedText = '';

                await streamAgentRun({
                    chatSessionId: currentSessionId,
                    editSessionId: editSessionIdRef.current,
                    userText: trimmed,
                    onDelta: (delta) => {
                        editStreamedText += delta;
                        updateEditMessage(editAssistantId, editStreamedText);
                    },
                    onEditedUrl: (url) => { setEditedImageUrl(url); },
                    onError: (code) => { setErrorMessage(`편집 오류: ${code}`); }
                });

                if (!editStreamedText) updateEditMessage(editAssistantId, '편집 응답이 비어 있습니다.');
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

    const resetDirectEdit = () => {
        setDeFilters({ brightness: 100, contrast: 100, saturation: 100 });
        setDeRotation(0);
        setDeFlipH(false);
        setCropMode(false);
        setCropAspect(null);
        setCropRect(null);
        cropDragRef.current = null;
    };

    // cropAspect 버튼 토글: 같은 버튼 다시 누르면 비활성화
    const toggleCropAspect = (aspect: '3:4' | '16:9' | 'free') => {
        if (cropAspect === aspect) {
            setCropAspect(null);
            setCropMode(false);
            setCropRect(null);
        } else {
            setCropAspect(aspect);
            setCropMode(true);
            setCropRect(null);
        }
    };

    const openDirectEdit = () => {
        resetDirectEdit();
        setIsDirectEditOpen(true);
    };

    const closeDirectEdit = () => {
        setIsDirectEditOpen(false);
        resetDirectEdit();
    };

    const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!cropMode) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        const sx = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
        const sy = Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100));
        cropDragRef.current = { sx, sy };
        setCropRect({ x: sx, y: sy, w: 0, h: 0 });
    };

    const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!cropMode || !cropDragRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
        const cy = Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100));
        const { sx, sy } = cropDragRef.current;
        let w = Math.abs(cx - sx);
        let h = Math.abs(cy - sy);

        // 컨테이너 aspect-ratio = 1.2 (W/H)
        // pixel 비율 보정: h% = w% * (targetRatio) * (containerH/containerW) = w% * targetRatio / 1.2
        if (cropAspect === '3:4') {
            h = w * (4 / 3) / 1.2;
        } else if (cropAspect === '16:9') {
            h = w * (9 / 16) / 1.2;
        }
        w = Math.min(w, 100);
        h = Math.min(h, 100);

        setCropRect({
            x: Math.max(0, cx >= sx ? sx : sx - w),
            y: Math.max(0, cy >= sy ? sy : sy - h),
            w,
            h,
        });
    };

    const handleCropPointerUp = () => { cropDragRef.current = null; };

    const applyDirectEdit = async () => {
        if (!editedImageUrl) return;
        setIsSaving(true);
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('이미지 로드 실패'));
                img.src = editedImageUrl;
            });

            // 누적값을 0/90/180/270으로 정규화
            const normRot = ((deRotation % 360) + 360) % 360;
            const rad = (normRot * Math.PI) / 180;
            const isRotated90 = normRot === 90 || normRot === 270;

            const canvas1 = document.createElement('canvas');
            canvas1.width = isRotated90 ? img.height : img.width;
            canvas1.height = isRotated90 ? img.width : img.height;
            const ctx1 = canvas1.getContext('2d');
            if (!ctx1) throw new Error('Canvas 컨텍스트를 가져올 수 없습니다.');

            ctx1.filter = `brightness(${deFilters.brightness}%) contrast(${deFilters.contrast}%) saturate(${deFilters.saturation}%)`;
            ctx1.translate(canvas1.width / 2, canvas1.height / 2);
            ctx1.rotate(rad);
            if (deFlipH) ctx1.scale(-1, 1);
            ctx1.drawImage(img, -img.width / 2, -img.height / 2);

            // 자르기 적용 (crop rect는 canvas1 기준 퍼센트)
            let finalCanvas: HTMLCanvasElement = canvas1;
            if (cropRect && cropRect.w > 1 && cropRect.h > 1) {
                const sx = Math.round(canvas1.width * cropRect.x / 100);
                const sy = Math.round(canvas1.height * cropRect.y / 100);
                const sw = Math.round(canvas1.width * cropRect.w / 100);
                const sh = Math.round(canvas1.height * cropRect.h / 100);
                const canvas2 = document.createElement('canvas');
                canvas2.width = sw;
                canvas2.height = sh;
                const ctx2 = canvas2.getContext('2d');
                if (!ctx2) throw new Error('Canvas 컨텍스트를 가져올 수 없습니다.');
                ctx2.drawImage(canvas1, sx, sy, sw, sh, 0, 0, sw, sh);
                finalCanvas = canvas2;
            }

            await new Promise<void>((resolve, reject) => {
                finalCanvas.toBlob((blob) => {
                    if (!blob) { reject(new Error('이미지 변환 실패')); return; }
                    const url = URL.createObjectURL(blob);
                    if (localEditPreviewUrlRef.current) URL.revokeObjectURL(localEditPreviewUrlRef.current);
                    localEditPreviewUrlRef.current = url;
                    setEditedImageUrl(url);
                    resolve();
                }, 'image/jpeg', 0.92);
            });

            appendEditMessage('assistant', '직접 편집이 적용되었습니다.');
            setIsDirectEditOpen(false);
            resetDirectEdit();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '직접 편집 적용 실패');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async (saveAsNew: boolean) => {
        if (!editedImageUrl || isSaving) return;
        if (editSessionIdRef.current === null) {
            setErrorMessage('편집 세션이 아직 준비 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        setIsSaving(true);
        try {
            const finalUrl = await finalizeEdit(editSessionIdRef.current, saveAsNew);
            editSessionIdRef.current = null;
            setEditSessionId(null);
            setEditedImageUrl(finalUrl);

            if (saveAsNew) {
                const newPhotoId = extractPhotoIdFromUrl(finalUrl) ?? undefined;
                appendEditMessage('assistant', '새로운 사진으로 저장되었습니다. 갤러리에서 확인하세요!');
                onPhotoSaved?.(newPhotoId);
                if (newPhotoId) {
                    editSessionPhotoIdRef.current = null;
                    startEditSessionFromUrl(newPhotoId);
                }
            } else {
                appendEditMessage('assistant', '편집된 사진으로 저장되었습니다.');
                onPhotoSaved?.();
            }
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : '저장 실패');
        } finally {
            setIsSaving(false);
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
            startEditSessionFromUrl(photoId);
        } else {
            appendEditMessage('assistant', '드롭한 이미지가 적용되었습니다. (외부 이미지는 AI 편집이 제한될 수 있습니다.)');
        }
    };

    const handleImageSearch = (url: string) => {
        setActiveTab('search');
        appendSearchMessageWithImage('user', '이 사진으로 검색', url);

        if (isGuestChatMode) {
            const id = appendSearchMessage('assistant', '');
            void streamDemoAssistantMessage(id);
            return;
        }
        if (!isLoggedIn) {
            appendSearchMessage('assistant', '로그인 후 이미지 검색을 사용할 수 있습니다.');
            return;
        }

        const assistantId = appendSearchMessage('assistant', '');
        setIsSending(true);
        void (async () => {
            try {
                const currentSessionId = await ensureSessionId();
                let streamedText = '';
                await streamAgentRun({
                    chatSessionId: currentSessionId,
                    editSessionId: null,
                    userText: `이 이미지와 비슷한 사진을 찾아줘: ${url}`,
                    onDelta: (delta) => { streamedText += delta; updateSearchMessage(assistantId, streamedText); },
                    onResults: (items) => {
                        const mapped = mapAgentResultsToPhotos(items);
                        if (mapped.length > 0) onSearchResults?.({ query: '이미지 검색', photos: mapped });
                    },
                    onError: (code) => { updateSearchMessage(assistantId, `이미지 검색 오류: ${code}`); }
                });
                if (!streamedText.trim()) updateSearchMessage(assistantId, '이미지 기반 검색 결과를 불러오지 못했습니다.');
            } catch {
                updateSearchMessage(assistantId, '이미지 검색 중 오류가 발생했습니다.');
            } finally {
                setIsSending(false);
            }
        })();
    };

    const handleBodyDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!isDragOver) setIsDragOver(true);
        const rect = event.currentTarget.getBoundingClientRect();
        const newSide: 'search' | 'edit' = event.clientY < rect.top + rect.height / 2 ? 'search' : 'edit';
        if (newSide !== dragSide) setDragSide(newSide);
    };

    const handleBodyDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        const related = event.relatedTarget as HTMLElement | null;
        if (related && event.currentTarget.contains(related)) return;
        setIsDragOver(false);
    };

    const handleBodyDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);

        const rect = event.currentTarget.getBoundingClientRect();
        const side: 'search' | 'edit' = event.clientY < rect.top + rect.height / 2 ? 'search' : 'edit';

        // 파일 드롭은 편집으로
        const imageFile = Array.from(event.dataTransfer.files).find((f) => f.type.startsWith('image/'));
        if (imageFile) {
            setActiveTab('edit');
            applyDroppedEditImage(imageFile);
            return;
        }

        // URL 추출
        const phomateData = event.dataTransfer.getData('application/x-phomate-photo');
        let url = '';
        if (phomateData) {
            try { url = (JSON.parse(phomateData) as { url: string }).url; } catch { /* ignore */ }
        }
        if (!url) {
            const uriList = event.dataTransfer.getData('text/uri-list');
            if (uriList) url = uriList.split(/\r?\n/).map((l) => l.trim()).find((l) => !!l && !l.startsWith('#')) ?? '';
        }
        if (!url) url = event.dataTransfer.getData('text/plain').trim();
        if (!url) return;

        if (side === 'edit') {
            setActiveTab('edit');
            applyDroppedEditUrl(url);
        } else {
            handleImageSearch(url);
        }
    };

    if (!isOpen) {
        return (
            <button className="chatbot-open-trigger" onClick={onOpen}>
                챗봇 열기
            </button>
        );
    }

    const isEditReady = editSessionIdRef.current !== null;

    return (
        <aside className="chatbot-container">
            <div className="chatbot-window">

                {/* 헤더 */}
                <div className="chatbot-header">
                    <div className="chatbot-header-left">
                        <img src="/favicon.png" alt="PhoMate" className="chatbot-logo-icon" />
                        <span className="chatbot-title"> AI Phomo</span>
                    </div>
                    <div className="chatbot-header-right">
                        <button className="panel-close-btn" onClick={handleClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* 바디 */}
                <div
                    className="chatbot-body"
                    ref={activeTab === 'search' ? bodyRef : editChatRef}
                    onDragOver={handleBodyDragOver}
                    onDragLeave={handleBodyDragLeave}
                    onDrop={handleBodyDrop}
                >

                    {/* 직접 편집 패널 */}
                    {activeTab === 'edit' && isDirectEditOpen && (
                        <div className="direct-edit-panel">
                            <div
                                className={`de-preview-wrap${cropMode ? ' crop-mode' : ''}`}
                                onPointerDown={handleCropPointerDown}
                                onPointerMove={handleCropPointerMove}
                                onPointerUp={handleCropPointerUp}
                            >
                                <img
                                    src={editedImageUrl}
                                    alt="편집 미리보기"
                                    className="de-preview-img"
                                    style={{
                                        filter: `brightness(${deFilters.brightness}%) contrast(${deFilters.contrast}%) saturate(${deFilters.saturation}%)`,
                                        transform: `rotate(${deRotation}deg) scaleX(${deFlipH ? -1 : 1})`,
                                    }}
                                />
                                {cropMode && cropRect && cropRect.w > 0.5 && cropRect.h > 0.5 && (
                                    <div
                                        className="de-crop-overlay"
                                        style={{
                                            left: `${cropRect.x}%`,
                                            top: `${cropRect.y}%`,
                                            width: `${cropRect.w}%`,
                                            height: `${cropRect.h}%`,
                                        }}
                                    />
                                )}
                            </div>

                            <div className="de-section-label">밝기 / 대비 / 채도</div>
                            <div className="de-sliders">
                                {([
                                    { key: 'brightness', label: '밝기', min: 0, max: 200 },
                                    { key: 'contrast',   label: '대비', min: 0, max: 200 },
                                    { key: 'saturation', label: '채도', min: 0, max: 200 },
                                ] as const).map(({ key, label, min, max }) => (
                                    <div className="de-slider-row" key={key}>
                                        <span className="de-slider-label">{label}</span>
                                        <input
                                            type="range" min={min} max={max}
                                            value={deFilters[key]}
                                            onChange={(e) => setDeFilters((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                                            className="de-slider"
                                        />
                                        <span className="de-slider-value">{deFilters[key]}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="de-section-label">회전 / 반전</div>
                            <div className="de-transform-row">
                                <button className="de-icon-btn" onClick={() => setDeRotation((r) => r - 90)} title="왼쪽 90°">↺</button>
                                <button className="de-icon-btn" onClick={() => setDeRotation((r) => r + 90)} title="오른쪽 90°">↻</button>
                                <button className={`de-icon-btn${deFlipH ? ' active' : ''}`} onClick={() => setDeFlipH((v) => !v)} title="좌우 반전">⇔</button>
                                <button className="de-icon-btn reset" onClick={resetDirectEdit} title="초기화">초기화</button>
                            </div>

                            <div className="de-section-label">자르기</div>
                            <div className="de-transform-row">
                                <button className={`de-icon-btn${cropAspect === '3:4' ? ' active' : ''}`} onClick={() => toggleCropAspect('3:4')}>3:4</button>
                                <button className={`de-icon-btn${cropAspect === '16:9' ? ' active' : ''}`} onClick={() => toggleCropAspect('16:9')}>16:9</button>
                                <button className={`de-icon-btn${cropAspect === 'free' ? ' active' : ''}`} onClick={() => toggleCropAspect('free')}>직접 자르기</button>
                            </div>
                            {cropMode && (
                                <p className="de-crop-hint">
                                    {cropRect && cropRect.w > 0.5 ? '드래그로 영역을 조정하세요' : '미리보기 위에서 드래그해 영역을 선택하세요'}
                                </p>
                            )}

                            <div className="de-actions">
                                <button className="de-cancel-btn" onClick={closeDirectEdit} disabled={isSaving}>취소</button>
                                <button className="de-apply-btn" onClick={() => void applyDirectEdit()} disabled={isSaving}>
                                    {isSaving ? '적용 중...' : '적용'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 편집 모드일 때 이미지 프리뷰 */}
                    {activeTab === 'edit' && !isDirectEditOpen && (
                        <div className="edit-preview-area">
                            {isEditSessionLoading ? (
                                <p className="preview-placeholder">편집 세션 준비 중...</p>
                            ) : editedImageUrl ? (
                                <img src={editedImageUrl} alt="편집 결과" className="edit-preview-image" />
                            ) : !selectedPhotoId ? (
                                <p className="preview-placeholder">편집할 사진을 선택해주세요.</p>
                            ) : (
                                <p className="preview-placeholder">이미지를 드래그해서 놓아주세요.</p>
                            )}
                        </div>
                    )}

                    {/* 메시지 스트림 */}
                    {(activeTab === 'search' ? searchMessages : editMessages).map((m) => (
                        <div
                            key={m.id}
                            className={m.role === 'assistant' ? 'msg-bubble-bot' : 'msg-bubble-user'}
                        >
                            {m.imageUrl && (
                                <img src={m.imageUrl} className="chat-msg-photo" alt="검색 사진" />
                            )}
                            {m.content || null}
                        </div>
                    ))}

                    {/* 편집중 인디케이터 — 메시지 바로 아래 */}
                    {activeTab === 'edit' && isSending && (
                        <div className="chat-sending-bar">
                            <img src="/favicon.png" className="chat-sending-favicon" alt="" />
                            <span>편집중...</span>
                        </div>
                    )}

                    {/* 편집 툴바 (편집 모드) */}
                    {activeTab === 'edit' && (
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
                                    onClick={openDirectEdit}
                                >
                                    <Edit3 size={14} /> 직접 편집
                                </button>
                            </div>
                            <div className="edit-action-row">
                                <button
                                    className="edit-cancel-btn"
                                    onClick={() => handleTabChange('search')}
                                    disabled={isSaving}
                                >
                                    편집 취소
                                </button>
                                <div className="save-btn-group">
                                    <button
                                        className="save-new-btn"
                                        onClick={() => void handleSave(true)}
                                        disabled={!editedImageUrl || isSaving || !isEditReady}
                                        title="원본을 유지하고 새 사진으로 저장"
                                    >
                                        <Save size={14} />
                                        {isSaving ? '저장 중...' : '새 사진으로'}
                                    </button>
                                    <button
                                        className="save-overwrite-btn"
                                        onClick={() => void handleSave(false)}
                                        disabled={!editedImageUrl || isSaving || !isEditReady}
                                        title="원본을 편집된 사진으로 대체"
                                    >
                                        <Save size={14} />
                                        {isSaving ? '저장 중...' : '편집본으로'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 검색중 인디케이터 */}
                    {activeTab === 'search' && isSending && (
                        <div className="chat-sending-bar">
                            <img src="/favicon.png" className="chat-sending-favicon" alt="" />
                            <span>검색중...</span>
                        </div>
                    )}

                    {/* 폴더 미리보기 — 검색 탭에서 폴더 의도 감지 시 */}
                    {activeTab === 'search' && folderPreview && (
                        <div className="folder-preview-container">
                            <div className="folder-preview-grid">
                                {folderPreview.photos.map((photo) => {
                                    const isSelected = folderPreview.selectedPhotoIds.includes(photo.photoId);
                                    return (
                                        <div
                                            key={photo.photoId}
                                            className={`folder-preview-photo${isSelected ? ' selected' : ''}`}
                                            onClick={() => handlePhotoToggle(photo.photoId)}
                                        >
                                            <img src={photo.previewUrl} alt="preview" />
                                            {isSelected && <div className="photo-selected-badge">✓</div>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="folder-preview-count">
                                선택된 사진: {folderPreview.selectedPhotoIds.length}장
                            </div>
                            <div className="folder-preview-actions">
                                <button
                                    className="folder-preview-btn accept"
                                    onClick={() => void handleFolderAction(true)}
                                    disabled={isSending || folderPreview.selectedPhotoIds.length === 0}
                                >
                                    폴더 만들기
                                </button>
                                <button
                                    className="folder-preview-btn reject"
                                    onClick={() => void handleFolderAction(false)}
                                    disabled={isSending}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    )}

                    {errorMessage && <div className="chat-error-text">{errorMessage}</div>}
                </div>

                {/* 푸터 입력창 */}
                <div className="chatbot-footer">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleFileSelectedForUpload(file);
                        }}
                    />
                    <div className="input-field-pill">
                        <button
                            className="chat-plus-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || isSending}
                            title={activeTab === 'edit' ? '사진 업로드 후 편집' : '사진 업로드 후 검색'}
                        >
                            {isUploading
                                ? <span className="chat-plus-spinner" />
                                : <Plus size={16} strokeWidth={2.5} />
                            }
                        </button>
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

                {/* 드래그 선택 오버레이 — chatbot-window 기준 absolute (스크롤 영향 없음) */}
                {isDragOver && (
                    <div className="drag-choice-overlay">
                        <div className={`drag-zone drag-zone-search${dragSide === 'search' ? ' active' : ''}`}>
                            <Search size={32} strokeWidth={2.2} />
                            <span className="drag-zone-label">이미지로 검색</span>
                            <span className="drag-zone-sub">비슷한 사진을 찾아드립니다</span>
                        </div>
                        <div className="drag-zone-divider" />
                        <div className={`drag-zone drag-zone-edit${dragSide === 'edit' ? ' active' : ''}`}>
                            <Wand2 size={32} strokeWidth={2.2} />
                            <span className="drag-zone-label">AI 편집</span>
                            <span className="drag-zone-sub">사진을 AI로 수정합니다</span>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
