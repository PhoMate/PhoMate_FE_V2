import React, { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Chatbot from '../components/Chatbot';
import PhotoCard from '../components/Photocard';
import PhotoPreview from '../components/Photopreview';
import FolderView from '../components/Folderview';
import FolderModal from '../components/Foldermodal';
import SharedFolderModal from '../components/Sharedfoldermodal';
import AddPhotosModal from '../components/AddPhotosModal';
import NotificationPanel, { type AppNotificationItem } from '../components/Notificationpanel';
import InviteModal from '../components/Invitemodal';
import TrashView from '../components/Trashview';
import ActionModal from '../components/Actionmodal';
import UploadModal from '../components/Uploadmodal';
import UploadStatusPanel from '../components/Uploadstatuspanel';
import StorageUsageModal from '../components/StorageUsageModal';
import { Photo } from '../types';
import {
    beginGoogleLogin,
    clearAuthTokens,
    completeGoogleLoginIfNeeded,
    isAuthenticated
} from '../api/auth';
import { createPhoto, getAlbumLatest, movePhotoToTrash } from '../api/photo';
import { type ChatFolderPreviewPhoto } from '../api/chat';
import { commitPhotoUpload, initPhotoUpload, putFileToPresignedUrl } from '../api/upload';
import { getMyMember, type MemberProfile } from '../api/member';
import '../styles/Home.css';

type ViewType = 'home' | 'folder_list' | 'folder_detail' | 'shared_list' | 'shared_detail' | 'trash';
type UploadTaskStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error';

type UploadTask = {
    id: string;
    file: File;
    filename: string;
    progress: number;
    status: UploadTaskStatus;
    photoId?: number;
    originalKey?: string;
    uploadUrl?: string;
    etag?: string;
    previewUrl?: string;
    errorMessage?: string;
};

type UploadContext = {
    view: ViewType;
    selectedFolder: string | null;
};

type SharedFolderPhoto = {
    photo: Photo;
    addedByMe: boolean;
};

type AddPhotosConfirmState = {
    folderName: string;
    selectedPhotoIds: string[];
    isSharedFolder: boolean;
};

type NotificationTargetView = 'folder_detail' | 'shared_detail';

type HomeNotification = AppNotificationItem & {
    targetFolder?: string;
    targetView?: NotificationTargetView;
    albumName?: string;
};

const STORAGE_SIZE_KEY = 'photoSizeBytes';
const FOLDER_DATA_KEY = 'folderData';
const PAGE_SIZE = 30;

const loadPhotoSizesFromStorage = (): Record<string, number> => {
    try {
        const raw = localStorage.getItem(STORAGE_SIZE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

// 사진 다운로드 처리 함수
const downloadImage = async (url: string, filename: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename; // 다운로드될 파일명
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('다운로드 중 오류 발생:', error);
        alert('이미지를 다운로드할 수 없습니다.');
    }
};

const savePhotoSizesToStorage = (sizes: Record<string, number>) => {
    try {
        localStorage.setItem(STORAGE_SIZE_KEY, JSON.stringify(sizes));
    } catch { }
};

const loadFolderDataFromStorage = () => {
    try {
        const raw = localStorage.getItem(FOLDER_DATA_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const saveFolderDataToStorage = (data: object) => {
    try {
        localStorage.setItem(FOLDER_DATA_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('저장 실패:', e);
    }
};

const savedFolderData = loadFolderDataFromStorage();

export default function Home() {
    const preferPhotoControllerUpload = true;

    const formatDateText = (raw: string): string => {
        if (!raw) return '-';
        if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw;
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return raw;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}.${m}.${d}`;
    };

    const todayDateText = formatDateText(new Date().toISOString());

    const formatBytesToStorageText = (bytes: number): string => {
        if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
        if (bytes >= 1) return `${Math.round(bytes)} B`;
        return '0 B';
    };

    // 저장된 값이 일반적인 사진 크기(1~1024MB)인 경우만 변환
    const ensureBytesValue = (value: number): number => {
        // 1 ~ 100: MB 단위로 저장된 값으로 가정 (일반 사진 1MB ~ 100MB)
        if (value > 0 && value <= 100) {
            return value * 1024 * 1024; // MB를 바이트로 변환
        }
        // 그 이상은 이미 바이트 단위
        return value;
    };

    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated());
    const [view, setView] = useState<ViewType>('home');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folders, setFolders] = useState<string[]>(savedFolderData?.folders ?? ['폴더 1']);
    const [folderStorageByName, setFolderStorageByName] = useState<Record<string, string>>({ '폴더 1': '0 MB' });
    const [folderCreatedAtByName, setFolderCreatedAtByName] = useState<Record<string, string>>(
        savedFolderData?.folderCreatedAtByName ?? { '폴더 1': todayDateText }
    );
    const [sharedFolders, setSharedFolders] = useState<string[]>(savedFolderData?.sharedFolders ?? ['공유 폴더 1']);
    const [sharedFolderStorageByName, setSharedFolderStorageByName] = useState<Record<string, string>>({ '공유 폴더 1': '0 MB' });
    const [sharedFolderCreatedAtByName, setSharedFolderCreatedAtByName] = useState<Record<string, string>>(
        savedFolderData?.sharedFolderCreatedAtByName ?? { '공유 폴더 1': todayDateText }
    );
    const [folderPhotoIdsByName, setFolderPhotoIdsByName] = useState<Record<string, string[]>>(
        savedFolderData?.folderPhotoIdsByName ?? { '폴더 1': [] }
    );
    const [sharedFolderPhotosByName, setSharedFolderPhotosByName] = useState<Record<string, SharedFolderPhoto[]>>(
        savedFolderData?.sharedFolderPhotosByName ?? { '공유 폴더 1': [] }
    );
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [folderModalMode, setFolderModalMode] = useState<'create' | 'settings'>('create');
    const [selectedFolderForSettings, setSelectedFolderForSettings] = useState('새 폴더');
    const [isSharedModalOpen, setIsSharedModalOpen] = useState(false);
    const [sharedModalMode, setSharedModalMode] = useState<'create' | 'settings'>('settings');
    const [selectedSharedFolderForSettings, setSelectedSharedFolderForSettings] = useState('공유 폴더 1');
    const [isNotiOpen, setIsNotiOpen] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadItems, setUploadItems] = useState<UploadTask[]>([]);
    const [isAddPhotosModalOpen, setIsAddPhotosModalOpen] = useState(false);
    const [selectedPhotoIdsForAdd, setSelectedPhotoIdsForAdd] = useState<string[]>([]);
    const [addPhotosConfirm, setAddPhotosConfirm] = useState<AddPhotosConfirmState | null>(null);
    const [notifications, setNotifications] = useState<HomeNotification[]>([]);
    const [modalConfig, setModalConfig] = useState<{ type: 'restore' | 'delete_confirm' | 'alert'; message: string } | null>(null);
    const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
    const [myPhotos, setMyPhotos] = useState<Photo[]>([]);
    const [chatSearchResultPhotos, setChatSearchResultPhotos] = useState<Photo[] | null>(null);
    const [chatSearchQuery, setChatSearchQuery] = useState('');
    const [photoSizeBytesById, setPhotoSizeBytesById] = useState<Record<string, number>>(loadPhotoSizesFromStorage);
    const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);

    // ✅ 무한 스크롤 state
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const cursorRef = useRef<{ cursorShotAt?: string; cursorId?: number } | null>(null);
    const observerTargetRef = useRef<HTMLDivElement | null>(null);

    const uploadNotificationStatusRef = useRef<Record<string, UploadTaskStatus>>({});
    const authExpiryAlertShownRef = useRef(false);

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
    const isDraggingRef = useRef(false); // 드래그 중 여부

    useEffect(() => {
        savePhotoSizesToStorage(photoSizeBytesById);
    }, [photoSizeBytesById]);

    useEffect(() => {
        saveFolderDataToStorage({
            folders,
            folderCreatedAtByName,
            folderPhotoIdsByName,
            sharedFolders,
            sharedFolderCreatedAtByName,
            sharedFolderPhotosByName
        });
    }, [folders, folderCreatedAtByName, folderPhotoIdsByName, sharedFolders, sharedFolderCreatedAtByName, sharedFolderPhotosByName]);

    const toggleSelectPhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        if (next.has(photoId)) next.delete(photoId);
        else next.add(photoId);
        return next;
    });
};

const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedPhotoIds(new Set());
};

const handleSelectAll = () => {
    setSelectedPhotoIds(new Set(currentViewPhotos.map((p) => p.id)));
};

const handleDeleteSelected = async () => {
    if (selectedPhotoIds.size === 0) return;
    const confirmed = window.confirm(`선택한 ${selectedPhotoIds.size}장을 휴지통으로 이동하시겠습니까?`);
    if (!confirmed) return;

    for (const id of [...selectedPhotoIds]) {
        const photoId = Number(id);
        if (!Number.isFinite(photoId) || photoId <= 0) continue;
        try {
            await movePhotoToTrash(photoId);
            setMyPhotos((prev) => prev.filter((p) => p.id !== id));
            setPhotoSizeBytesById((prev) => { const next = { ...prev }; delete next[id]; return next; });
        } catch {
            console.warn('삭제 실패:', id);
        }
    }
    exitSelectMode();
};

// ✅ 드래그 선택 핸들러
const handleMouseDown = (photoId: string) => {
    if (!isSelectMode) return;
    isDraggingRef.current = true;
    // 드래그 시작한 사진 선택 (이미 선택된 경우도 유지)
    setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        next.add(photoId);
        return next;
    });
};

const handleMouseEnterDrag = (photoId: string) => {
    if (!isSelectMode || !isDraggingRef.current) return;
    setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        next.add(photoId);
        return next;
    });
};

// ✅ 마우스 뗄 때 드래그 종료
useEffect(() => {
    const onMouseUp = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
}, []);

    const isUnauthorizedError = (error: unknown): boolean => {
        if (!(error instanceof Error)) return false;
        const message = error.message.toLowerCase();
        return message.includes('401') || message.includes('unauthorized');
    };

    const handleUnauthorizedError = () => {
        clearAuthTokens();
        setIsLoggedIn(false);
        setMemberProfile(null);
        if (authExpiryAlertShownRef.current) return;
        authExpiryAlertShownRef.current = true;
        window.alert('세션이 만료되었습니다. 다시 로그인해주세요.');
    };

    useEffect(() => {
        let mounted = true;
        completeGoogleLoginIfNeeded()
            .then((handled) => {
                if (!mounted) return;
                if (handled) {
                    authExpiryAlertShownRef.current = false;
                    setIsLoggedIn(true);
                }
            })
            .catch((error: unknown) => {
                if (!mounted) return;
                const message = error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했습니다.';
                window.alert(message);
            });
        return () => { mounted = false; };
    }, []);

    const handleLogin = async () => {
        try {
            authExpiryAlertShownRef.current = false;
            await beginGoogleLogin();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '로그인을 시작할 수 없습니다.';
            window.alert(message);
        }
    };

    const handleLogout = () => {
        clearAuthTokens();
        authExpiryAlertShownRef.current = false;
        setIsLoggedIn(false);
        setMemberProfile(null);
        setMyPhotos([]);
        setChatSearchResultPhotos(null);
        setChatSearchQuery('');
        setNotifications([]);
        uploadNotificationStatusRef.current = {};
        cursorRef.current = null;
        setHasMore(true);
        window.alert('로그아웃되었습니다.');
    };

    const handleChatSearchResults = (payload: { query: string; photos: ChatFolderPreviewPhoto[] }) => {
        const mapped = payload.photos
            .filter((photo) => photo.photoId > 0 && photo.previewUrl)
            .map((photo) => ({
                id: String(photo.photoId),
                thumbnailUrl: photo.previewUrl,
                previewUrl: photo.previewUrl,
                shotAt: photo.shotAt,
                likeCount: 0
            }));
        setChatSearchQuery(payload.query);
        setChatSearchResultPhotos(mapped);
        setView('home');
        setSelectedFolder(null);
        setPreviewIndex(null);
    };

    const pushNotification = (notification: Omit<HomeNotification, 'id' | 'createdAt' | 'read'>) => {
        if (notification.kind === 'upload' || notification.kind === 'folder') return;
        setNotifications((prev) => [
            {
                ...notification,
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: Date.now(),
                read: false
            },
            ...prev
        ].slice(0, 30));
    };

    const loadMyProfile = async (): Promise<MemberProfile | null> => {
        if (!isAuthenticated()) return null;
        try {
            const profile = await getMyMember();
            setMemberProfile(profile);
            return profile;
        } catch (error: unknown) {
            setMemberProfile(null);
            if (isUnauthorizedError(error)) {
                handleUnauthorizedError();
                return null;
            }
            const message = error instanceof Error ? error.message : '내 정보 조회에 실패했습니다.';
            window.alert(message);
            return null;
        }
    };

    // ✅ cursor 파라미터 추가 — 초기 로드 vs 추가 로드 분기
    const loadAlbum = async (cursor?: { cursorShotAt?: string; cursorId?: number }): Promise<Photo[]> => {
        if (!isAuthenticated()) return [];
        try {
            const items = await getAlbumLatest({ size: PAGE_SIZE, ...cursor });
            const normalized = items.map((item) => ({
                id: String(item.photoId),
                thumbnailUrl: item.thumbnailUrl || item.previewUrl,
                previewUrl: item.previewUrl,
                shotAt: item.shotAt,
                likeCount: 0
            }));

            if (cursor) {
                // 추가 로드 — 기존 사진에 이어붙임 (중복 제거)
                setMyPhotos((prev) => {
                    const existingIds = new Set(prev.map((p) => p.id));
                    return [...prev, ...normalized.filter((p) => !existingIds.has(p.id))];
                });
            } else {
                // 초기 로드 — 전체 교체
                setMyPhotos(normalized);
            }

            // 다음 커서 저장 (마지막 항목 기준)
            const last = items[items.length - 1];
            if (last && items.length === PAGE_SIZE) {
                cursorRef.current = { cursorShotAt: last.shotAt, cursorId: last.photoId };
                setHasMore(true);
            } else {
                cursorRef.current = null;
                setHasMore(false);
            }

            setPhotoSizeBytesById((prev) => {
                const next: Record<string, number> = { ...prev };
                items.forEach((item) => {
                    const id = String(item.photoId);
                    if (item.sizeBytes && item.sizeBytes > 0) next[id] = item.sizeBytes;
                    if (!(id in next)) next[id] = 0;
                });
                return next;
            });

            return normalized;
        } catch (error: unknown) {
            if (isUnauthorizedError(error)) {
                handleUnauthorizedError();
                return [];
            }
            const message = error instanceof Error ? error.message : '앨범을 불러오지 못했습니다.';
            window.alert(message);
            return [];
        }
    };

    const appendUploadedPhotosToCurrentLocation = (uploadedPhotos: Photo[], context: UploadContext) => {
        if (!uploadedPhotos.length) return;

        if (context.view === 'folder_detail' && context.selectedFolder) {
            const folderName = context.selectedFolder;
            const uploadedIds = uploadedPhotos.map((photo) => photo.id);
            setFolderPhotoIdsByName((prev) => ({
                ...prev,
                [folderName]: Array.from(new Set([...uploadedIds, ...(prev[folderName] ?? [])]))
            }));
            return;
        }

        if (context.view === 'shared_detail' && context.selectedFolder) {
            const folderName = context.selectedFolder;
            const uploadedIds = new Set(uploadedPhotos.map((photo) => photo.id));
            setSharedFolderPhotosByName((prev) => ({
                ...prev,
                [folderName]: [
                    ...uploadedPhotos.map((photo) => ({ photo, addedByMe: true })),
                    ...(prev[folderName] ?? []).filter((entry) => !uploadedIds.has(entry.photo.id))
                ]
            }));
        }
    };

    useEffect(() => {
        if (!isLoggedIn) return;
        let mounted = true;
        void (async () => {
            const profile = await loadMyProfile();
            if (!mounted || !profile) return;
            await loadAlbum(); // 초기 로드 (cursor 없음)
        })();
        return () => { mounted = false; };
    }, [isLoggedIn]);

    // ✅ 무한 스크롤 IntersectionObserver
    useEffect(() => {
        const target = observerTargetRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (!first.isIntersecting) return;
                if (!hasMore || isLoadingMore || !isLoggedIn) return;
                if (view !== 'home') return;

                void (async () => {
                    setIsLoadingMore(true);
                    try {
                        await loadAlbum(cursorRef.current ?? undefined);
                    } finally {
                        setIsLoadingMore(false);
                    }
                })();
            },
            { threshold: 0.1 }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, isLoggedIn, view]);

    useEffect(() => {
        uploadItems.forEach((task) => {
            const previousStatus = uploadNotificationStatusRef.current[task.id];
            const shouldNotify = (task.status === 'done' || task.status === 'error') && previousStatus !== task.status;
            if (shouldNotify && task.status === 'error') {
                console.warn('업로드 실패:', task.filename, task.errorMessage);
            }
            uploadNotificationStatusRef.current[task.id] = task.status;
        });
    }, [uploadItems]);

    useEffect(() => {
        setFolderStorageByName((prev) => {
            const next: Record<string, string> = {};
            folders.forEach((folderName) => {
                const photoIds = folderPhotoIdsByName[folderName] ?? [];
                const totalBytes = photoIds.reduce((sum, photoId) => {
                    const sizeValue = photoSizeBytesById[photoId] ?? 0;
                    return sum + ensureBytesValue(sizeValue);
                }, 0);
                next[folderName] = formatBytesToStorageText(totalBytes);
            });
            return { ...prev, ...next };
        });
    }, [folders, folderPhotoIdsByName, photoSizeBytesById]);

    useEffect(() => {
        setSharedFolderStorageByName((prev) => {
            const next: Record<string, string> = {};
            sharedFolders.forEach((folderName) => {
                const photos = sharedFolderPhotosByName[folderName] ?? [];
                const totalBytes = photos.reduce((sum, entry) => {
                    const sizeValue = photoSizeBytesById[entry.photo.id] ?? 0;
                    return sum + ensureBytesValue(sizeValue);
                }, 0);
                next[folderName] = formatBytesToStorageText(totalBytes);
            });
            return { ...prev, ...next };
        });
    }, [sharedFolders, sharedFolderPhotosByName, photoSizeBytesById]);

    const updateUploadTask = (id: string, patch: Partial<UploadTask>) => {
        setUploadItems((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    };

    const startUpload = async (files: File[]) => {
        if (files.length === 0) return;

        if (!isAuthenticated()) {
            window.alert('업로드는 로그인 후 사용할 수 있습니다.');
            setIsUploadModalOpen(false);
            return;
        }

        setIsUploadModalOpen(false);

        const initialTasks: UploadTask[] = files.map((file, index) => ({
            id: `${Date.now()}-${index}`,
            file,
            filename: file.name,
            progress: 0,
            status: 'queued'
        }));

        setUploadItems(initialTasks);
        setIsUploading(true);

        setPhotoSizeBytesById((prev) => {
            const next = { ...prev };
            initialTasks.forEach((task) => { next[task.id] = task.file.size; });
            return next;
        });

        const uploadContext: UploadContext = { view, selectedFolder };
        const beforeMyPhotoIds = new Set(myPhotos.map((photo) => photo.id));

        const isUnauthorizedUploadError = (error: unknown): boolean => {
            if (!(error instanceof Error)) return false;
            return error.message.includes('401') || error.message.includes('Unauthorized');
        };

        const uploadViaPhotoController = async (): Promise<void> => {
            const succeededTasks: UploadTask[] = [];

            for (const task of initialTasks) {
                try {
                    updateUploadTask(task.id, { status: 'uploading', progress: 35, errorMessage: undefined });
                    await createPhoto(task.file, task.file.lastModified);
                    updateUploadTask(task.id, { status: 'processing', progress: 80 });
                    updateUploadTask(task.id, { status: 'done', progress: 100 });
                    succeededTasks.push(task);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : '사진 업로드에 실패했습니다.';
                    updateUploadTask(task.id, { status: 'error', errorMessage: message, progress: 0 });
                    setPhotoSizeBytesById((prev) => {
                        const next = { ...prev };
                        delete next[task.id];
                        return next;
                    });
                }
            }

            // ✅ 업로드 후엔 커서 초기화하고 처음부터 다시 로드
            cursorRef.current = null;
            const refreshed = await loadAlbum();
            const uploadedPhotos = refreshed.filter((photo) => !beforeMyPhotoIds.has(photo.id));

            setPhotoSizeBytesById((prev) => {
                const next = { ...prev };
                initialTasks.forEach((task) => { delete next[task.id]; });
                const reversedSucceeded = [...succeededTasks].reverse();
                uploadedPhotos.forEach((photo, index) => {
                    const matchedTask = reversedSucceeded[index];
                    if (matchedTask) next[photo.id] = matchedTask.file.size;
                });
                return next;
            });

            appendUploadedPhotosToCurrentLocation(uploadedPhotos, uploadContext);
        };

        if (preferPhotoControllerUpload) {
            try {
                await uploadViaPhotoController();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : '사진 업로드에 실패했습니다.';
                setUploadItems((prev) => prev.map((task) => ({ ...task, status: 'error', errorMessage: message })));
                setPhotoSizeBytesById((prev) => {
                    const next = { ...prev };
                    initialTasks.forEach((task) => { delete next[task.id]; });
                    return next;
                });
            } finally {
                window.setTimeout(() => { setIsUploading(false); }, 1500);
            }
            return;
        }

        try {
            const initItems = files.map((file) => ({
                originalFilename: file.name,
                contentType: file.type || 'application/octet-stream',
                size: file.size,
                clientLastModifiedMs: file.lastModified
            }));

            let initResults: Awaited<ReturnType<typeof initPhotoUpload>> = [];
            try {
                initResults = await initPhotoUpload(initItems);
            } catch (error: unknown) {
                if (isUnauthorizedUploadError(error)) {
                    await uploadViaPhotoController();
                    return;
                }
                throw error;
            }

            const preparedTasks = initialTasks.map((task, index) => {
                const init = initResults[index];
                if (!init || !Number.isFinite(init.photoId) || init.photoId <= 0 || !init.originalKey || !init.uploadUrl) {
                    return { ...task, status: 'error' as const, errorMessage: '업로드 URL 발급에 실패했습니다.' };
                }
                return { ...task, photoId: init.photoId, originalKey: init.originalKey, uploadUrl: init.uploadUrl };
            });

            setUploadItems(preparedTasks);

            setPhotoSizeBytesById((prev) => {
                const next = { ...prev };
                preparedTasks.forEach((task) => {
                    delete next[task.id];
                    if (task.photoId) next[String(task.photoId)] = task.file.size;
                });
                return next;
            });

            const readyTasks = preparedTasks.filter((task) => task.uploadUrl && task.photoId !== undefined && task.originalKey);
            const commitCandidates: { id: string; photoId: number; originalKey: string; etag: string; clientLastModifiedMs: number }[] = [];
            const maxConcurrent = Math.min(3, readyTasks.length);
            let cursor = 0;

            const worker = async () => {
                while (true) {
                    const currentIndex = cursor;
                    cursor += 1;
                    if (currentIndex >= readyTasks.length) return;

                    const task = readyTasks[currentIndex];
                    const uploadUrl = task.uploadUrl as string;

                    try {
                        updateUploadTask(task.id, { status: 'uploading', progress: 0, errorMessage: undefined });
                        const etag = await putFileToPresignedUrl(uploadUrl, task.file, (percent) => {
                            updateUploadTask(task.id, { status: 'uploading', progress: percent });
                        });
                        updateUploadTask(task.id, { status: 'processing', progress: 100, etag });
                        commitCandidates.push({
                            id: task.id,
                            photoId: task.photoId as number,
                            originalKey: task.originalKey as string,
                            etag,
                            clientLastModifiedMs: task.file.lastModified
                        });
                    } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : '파일 업로드에 실패했습니다.';
                        updateUploadTask(task.id, { status: 'error', errorMessage: message });
                        if (task.photoId) {
                            setPhotoSizeBytesById((prev) => {
                                const next = { ...prev };
                                delete next[String(task.photoId)];
                                return next;
                            });
                        }
                    }
                }
            };

            if (maxConcurrent > 0) {
                await Promise.all(Array.from({ length: maxConcurrent }, () => worker()));
            }

            const allPutSucceeded = readyTasks.length > 0 && commitCandidates.length === readyTasks.length;

            if (!allPutSucceeded && commitCandidates.length > 0) {
                setUploadItems((prev) => prev.map((task) => (
                    task.status === 'processing'
                        ? { ...task, status: 'error', errorMessage: '일부 파일 PUT 업로드 실패로 완료 처리를 진행하지 않았습니다.' }
                        : task
                )));
            }

            if (allPutSucceeded) {
                try {
                    const commitResults = await commitPhotoUpload(
                        commitCandidates.map((candidate) => ({
                            photoId: candidate.photoId,
                            originalKey: candidate.originalKey,
                            etag: candidate.etag,
                            clientLastModifiedMs: candidate.clientLastModifiedMs
                        }))
                    );

                    const previewByPhotoId = new Map(
                        commitResults
                            .filter((item) => item.photoId && item.previewUrl)
                            .map((item) => [item.photoId, item.previewUrl])
                    );

                    setUploadItems((prev) => prev.map((task) => {
                        if (task.status !== 'processing') return task;
                        const previewUrl = task.photoId ? previewByPhotoId.get(task.photoId) : undefined;
                        if (!previewUrl) return { ...task, status: 'error', errorMessage: '서버 후처리에 실패했습니다.' };
                        return { ...task, status: 'done', previewUrl, progress: 100 };
                    }));

                    if (commitResults.length > 0) {
                        cursorRef.current = null;
                        const refreshed = await loadAlbum();
                        const uploadedPhotos = refreshed.filter((photo) => !beforeMyPhotoIds.has(photo.id));
                        appendUploadedPhotosToCurrentLocation(uploadedPhotos, uploadContext);
                    }
                } catch {
                    setUploadItems((prev) => prev.map((task) => (
                        task.status === 'processing'
                            ? { ...task, status: 'error', errorMessage: '업로드 후처리 요청이 실패했습니다.' }
                            : task
                    )));
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '업로드를 시작할 수 없습니다.';
            setUploadItems((prev) => prev.map((task) => ({ ...task, status: 'error', errorMessage: message })));
            setPhotoSizeBytesById((prev) => {
                const next = { ...prev };
                initialTasks.forEach((task) => { delete next[task.id]; });
                return next;
            });
        } finally {
            window.setTimeout(() => { setIsUploading(false); }, 1500);
        }
    };

    const handleNavigate = (type: string, target?: string) => {
        if (type === 'home') { setView('home'); setSelectedFolder(null); }
        else if (type === 'trash') { setView('trash'); setSelectedFolder(null); }
        else if (type === 'folder_parent') { setView('folder_list'); setSelectedFolder(null); }
        else if (type === 'folder_child') { setView('folder_detail'); setSelectedFolder(target || null); }
        else if (type === 'shared_parent') { setView('shared_list'); setSelectedFolder(null); }
        else if (type === 'shared_child') { setView('shared_detail'); setSelectedFolder(target || null); }
    };

    const handleSaveFolder = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return false;

        if (folderModalMode === 'create') {
            const isDuplicate = folders.some((f) => f.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase());
            if (isDuplicate) { setModalConfig({ type: 'alert', message: '이미 존재하는 폴더 이름입니다.' }); return false; }
            setFolders((prev) => [...prev, trimmed]);
            setFolderStorageByName((prev) => ({ ...prev, [trimmed]: '0 MB' }));
            setFolderCreatedAtByName((prev) => ({ ...prev, [trimmed]: todayDateText }));
            setFolderPhotoIdsByName((prev) => ({ ...prev, [trimmed]: [] }));
            setSelectedFolder(trimmed);
            setView('folder_detail');
            return true;
        }

        const sourceName = selectedFolderForSettings;
        if (sourceName === trimmed) return true;

        setFolders((prev) => prev.map((f) => f === sourceName ? trimmed : f));
        setFolderStorageByName((prev) => { const next = { ...prev }; next[trimmed] = next[sourceName] ?? '0 MB'; delete next[sourceName]; return next; });
        setFolderPhotoIdsByName((prev) => { const next = { ...prev }; next[trimmed] = next[sourceName] ?? []; delete next[sourceName]; return next; });
        setFolderCreatedAtByName((prev) => { const next = { ...prev }; next[trimmed] = next[sourceName] ?? todayDateText; delete next[sourceName]; return next; });
        if (selectedFolder === sourceName) setSelectedFolder(trimmed);
        setSelectedFolderForSettings(trimmed);
        return true;
    };

    const handleDeleteFolder = () => {
        const target = selectedFolderForSettings;
        setFolders((prev) => prev.filter((f) => f !== target));
        setFolderStorageByName((prev) => { const next = { ...prev }; delete next[target]; return next; });
        setFolderPhotoIdsByName((prev) => { const next = { ...prev }; delete next[target]; return next; });
        setFolderCreatedAtByName((prev) => { const next = { ...prev }; delete next[target]; return next; });
        if (selectedFolder === target) { setSelectedFolder(null); setView('folder_list'); }
    };

    const handleSaveSharedFolder = (nextName: string) => {
        const trimmed = nextName.trim();
        if (!trimmed) return false;

        if (sharedModalMode === 'create') {
            const isDuplicate = sharedFolders.some((f) => f.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase());
            if (isDuplicate) { setModalConfig({ type: 'alert', message: '이미 존재하는 공유 폴더 이름입니다.' }); return false; }
            setSharedFolders((prev) => [...prev, trimmed]);
            setSharedFolderStorageByName((prev) => ({ ...prev, [trimmed]: '0 MB' }));
            setSharedFolderCreatedAtByName((prev) => ({ ...prev, [trimmed]: todayDateText }));
            setSharedFolderPhotosByName((prev) => ({ ...prev, [trimmed]: [] }));
            setSelectedFolder(trimmed);
            setView('shared_detail');
            setSelectedSharedFolderForSettings(trimmed);
            pushNotification({ kind: 'shared_folder', title: '공유 폴더 생성됨', message: `'${trimmed}' 공유 폴더가 생성되었습니다.`, targetFolder: trimmed, targetView: 'shared_detail' });
            return true;
        }

        const sourceName = selectedSharedFolderForSettings;
        if (sourceName === trimmed) return true;

        setSharedFolders((prev) => prev.map((f) => f === sourceName ? trimmed : f));
        setSharedFolderStorageByName((prev) => { const next = { ...prev }; next[trimmed] = next[sourceName] ?? '0 MB'; delete next[sourceName]; return next; });
        setSharedFolderPhotosByName((prev) => { const next = { ...prev }; next[trimmed] = next[sourceName] ?? []; delete next[sourceName]; return next; });
        setSharedFolderCreatedAtByName((prev) => { const next = { ...prev }; next[trimmed] = next[sourceName] ?? todayDateText; delete next[sourceName]; return next; });
        if (selectedFolder === sourceName) setSelectedFolder(trimmed);
        setSelectedSharedFolderForSettings(trimmed);
        return true;
    };

    const handleLeaveSharedFolder = () => {
        const target = selectedSharedFolderForSettings;
        setSharedFolders((prev) => prev.filter((f) => f !== target));
        setSharedFolderStorageByName((prev) => { const next = { ...prev }; delete next[target]; return next; });
        setSharedFolderPhotosByName((prev) => { const next = { ...prev }; delete next[target]; return next; });
        setSharedFolderCreatedAtByName((prev) => { const next = { ...prev }; delete next[target]; return next; });
        if (selectedFolder === target) { setSelectedFolder(null); setView('shared_list'); }
    };

    const activeNavKey =
        view === 'home' ? 'home' :
        view === 'trash' ? 'trash' :
        view === 'folder_list' ? 'folder_parent' :
        view === 'folder_detail' ? `folder_child:${selectedFolder || ''}` :
        view === 'shared_list' ? 'shared_parent' :
        `shared_child:${selectedFolder || ''}`;

    const notificationCount = notifications.filter((item) => !item.read).length;
    const myPhotoMap = new Map(myPhotos.map((photo) => [photo.id, photo]));

    const folderPhotos = selectedFolder
        ? (folderPhotoIdsByName[selectedFolder] ?? []).map((id) => myPhotoMap.get(id)).filter((p): p is Photo => !!p)
        : [];
    const sharedPhotos = selectedFolder
        ? (sharedFolderPhotosByName[selectedFolder] ?? []).map((entry) => entry.photo)
        : [];

    const currentViewPhotos =
        view === 'home' ? (chatSearchResultPhotos ?? myPhotos) :
        view === 'folder_detail' ? folderPhotos :
        view === 'shared_detail' ? sharedPhotos :
        [];

    const isChatSearchView = view === 'home' && chatSearchResultPhotos !== null;
    const TOTAL_STORAGE_BYTES = 50 * 1024 * 1024 * 1024;
    const totalUsedStorageBytes = Object.values(photoSizeBytesById).reduce((sum, size) => sum + ensureBytesValue(size), 0);
    const remainingStorageBytes = Math.max(TOTAL_STORAGE_BYTES - totalUsedStorageBytes, 0);
    const storagePercent = Math.min((totalUsedStorageBytes / TOTAL_STORAGE_BYTES) * 100, 100);
    const usedStorageText = formatBytesToStorageText(totalUsedStorageBytes);
    const remainingStorageText = formatBytesToStorageText(remainingStorageBytes);
    const totalStorageText = formatBytesToStorageText(TOTAL_STORAGE_BYTES);

    const isFolderDetailView = view === 'folder_detail' && !!selectedFolder;
    const isSharedDetailView = view === 'shared_detail' && !!selectedFolder;
    const canOpenAddPhotos = isFolderDetailView || isSharedDetailView;

    const existingPhotoIdsForCurrentTarget = new Set<string>(
        isFolderDetailView
            ? (folderPhotoIdsByName[selectedFolder as string] ?? [])
            : isSharedDetailView
                ? (sharedFolderPhotosByName[selectedFolder as string] ?? []).map((entry) => entry.photo.id)
                : []
    );

    const openAddPhotosModal = () => {
        if (!canOpenAddPhotos) return;
        setSelectedPhotoIdsForAdd([]);
        setIsAddPhotosModalOpen(true);
    };

    const togglePhotoSelectionForAdd = (photoId: string) => {
        setSelectedPhotoIdsForAdd((prev) =>
            prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
        );
    };

    const requestAddSelectedPhotos = () => {
        if (!selectedFolder || selectedPhotoIdsForAdd.length === 0) return;
        setIsAddPhotosModalOpen(false);
        setAddPhotosConfirm({ folderName: selectedFolder, selectedPhotoIds: selectedPhotoIdsForAdd, isSharedFolder: view === 'shared_detail' });
    };

    const handleConfirmAddSelectedPhotos = () => {
        if (!addPhotosConfirm) return;
        const selectedIds = addPhotosConfirm.selectedPhotoIds;

        if (addPhotosConfirm.isSharedFolder) {
            setSharedFolderPhotosByName((prev) => {
                const current = prev[addPhotosConfirm.folderName] ?? [];
                const existingIds = new Set(current.map((entry) => entry.photo.id));
                const additions: SharedFolderPhoto[] = selectedIds
                    .map((photoId) => myPhotoMap.get(photoId))
                    .filter((photo): photo is Photo => !!photo)
                    .filter((photo) => !existingIds.has(photo.id))
                    .map((photo) => ({ photo, addedByMe: true }));
                return { ...prev, [addPhotosConfirm.folderName]: [...additions, ...current] };
            });
            pushNotification({ kind: 'shared_folder', title: '공유 폴더 사진 추가', message: `${selectedIds.length}장의 사진이 '${addPhotosConfirm.folderName}'에 추가되었습니다.`, targetFolder: addPhotosConfirm.folderName, targetView: 'shared_detail' });
        } else {
            setFolderPhotoIdsByName((prev) => ({
                ...prev,
                [addPhotosConfirm.folderName]: Array.from(new Set([...selectedIds, ...(prev[addPhotosConfirm.folderName] ?? [])]))
            }));
        }

        setSelectedPhotoIdsForAdd([]);
        setAddPhotosConfirm(null);
        setModalConfig({ type: 'alert', message: `${selectedIds.length}장의 사진을 추가했습니다.` });
    };

    const handleNotificationToggle = () => {
        setIsNotiOpen((prev) => {
            const next = !prev;
            if (!prev) setNotifications((current) => current.map((item) => item.read ? item : { ...item, read: true }));
            return next;
        });
    };

    const handleNotificationClick = (item: HomeNotification) => {
        setIsNotiOpen(false);
        if (item.kind === 'invite' && item.albumName) { setShowInviteModal(true); return; }
        if (item.targetView && item.targetFolder) { setView(item.targetView); setSelectedFolder(item.targetFolder); }
    };

    const handleDeleteCurrentPhoto = async () => {
        if (previewIndex === null) return;
        const target = currentViewPhotos[previewIndex];
        if (!target) return;
        const photoId = Number(target.id);
        if (!Number.isFinite(photoId) || photoId <= 0) { window.alert('유효하지 않은 사진 ID입니다.'); return; }

        try {
            await movePhotoToTrash(photoId);
            setMyPhotos((prev) => prev.filter((photo) => photo.id !== target.id));
            setPhotoSizeBytesById((prev) => {
                const next = { ...prev };
                delete next[target.id];
                return next;
            });
            setPreviewIndex(null);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '사진 삭제에 실패했습니다.';
            window.alert(message);
        }
    };

    return (
        <div className="home-container">
            <Navbar
                onNotiClick={handleNotificationToggle}
                onUploadClick={() => setIsUploadModalOpen(true)}
                onLogoClick={() => handleNavigate('home')}
                notificationCount={notificationCount}
                isLoggedIn={isLoggedIn}
                memberNickname={memberProfile?.nickname}
                memberProfileImageUrl={memberProfile?.profileImageUrl}
                onLoginClick={() => void handleLogin()}
                onLogoutClick={handleLogout}
            />

            <div className="main-layout">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    activeNav={activeNavKey}
                    folders={folders}
                    sharedFolders={sharedFolders}
                    onNavClick={handleNavigate}
                    onPlusClick={() => { setFolderModalMode('create'); setSelectedFolderForSettings('새 폴더'); setIsFolderModalOpen(true); }}
                    onLinkClick={() => { setSharedModalMode('create'); setSelectedSharedFolderForSettings(`공유 폴더 ${sharedFolders.length + 1}`); setIsSharedModalOpen(true); }}
                    remainingStorageText={remainingStorageText}
                    totalStorageText={totalStorageText}
                    storagePercent={storagePercent}
                    onStorageClick={() => setIsStorageModalOpen(true)}
                    onLogoutClick={handleLogout}
                    isLoggedIn={isLoggedIn}
                    onLoginClick={() => void handleLogin()}
                    onFolderSettingsClick={(name) => { setFolderModalMode('settings'); setSelectedFolderForSettings(name); setIsFolderModalOpen(true); }}
                    onSharedFolderSettingsClick={(name) => { setSharedModalMode('settings'); setSelectedSharedFolderForSettings(name); setIsSharedModalOpen(true); }}
                />

                <main className={`photo-area ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${isChatOpen ? 'chat-open' : 'chat-closed'}`}>
                    {selectedFolder && (isFolderDetailView || isSharedDetailView) ? (
                        <div className="folder-title-row">
                            <h2 className="folder-title">{selectedFolder}</h2>
                            <button className="folder-add-photo-btn" onClick={openAddPhotosModal}>사진 추가</button>
                        </div>
                    ) : selectedFolder ? (
                        <h2 className="folder-title">{selectedFolder}</h2>
                    ) : null}

                    {isChatSearchView ? (
                        <div className="search-result-banner">
                            <div className="search-result-meta">
                                <strong>검색 결과</strong>
                                <span>"{chatSearchQuery}"</span>
                            </div>
                            <button className="search-result-clear-btn" onClick={() => { setChatSearchResultPhotos(null); setChatSearchQuery(''); setPreviewIndex(null); }}>
                                결과 해제
                            </button>
                        </div>
                    ) : null}

                    {view === 'trash' ? (
                        <TrashView
                            isLoggedIn={isLoggedIn}
                            onChanged={() => void loadAlbum()}
                            onUnauthorized={handleUnauthorizedError}
                        />
                    ) : (view === 'home' || view === 'folder_detail' || view === 'shared_detail') ? (
                        <>
                            <div className="photo-grid">
                                {currentViewPhotos.map((photo, index) => (
                                    <PhotoCard
                                        key={photo.id}
                                        photo={photo}
                                        onClick={() => { if (!isChatSearchView) setPreviewIndex(index); }}
                                    />
                                ))}
                            </div>
                            {/* ✅ 무한 스크롤 감지 타겟 — home 뷰에서만 */}
                            {view === 'home' && !isChatSearchView && (
                                <div
                                    ref={observerTargetRef}
                                    style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    {isLoadingMore && (
                                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>불러오는 중...</span>
                                    )}
                                    {!hasMore && myPhotos.length > 0 && !isLoadingMore && (
                                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>모든 사진을 불러왔습니다.</span>
                                    )}
                                </div>
                            )}

                        </>
                    ) : view === 'folder_list' ? (
                        <FolderView sectionTitle="폴더" folders={folders} onFolderClick={(name) => handleNavigate('folder_child', name)} />
                    ) : (
                        <FolderView sectionTitle="공유 폴더" folders={sharedFolders} onFolderClick={(name) => handleNavigate('shared_child', name)} />
                    )}

                    {isNotiOpen && (
                        <NotificationPanel onClose={() => setIsNotiOpen(false)} onItemClick={handleNotificationClick} notifications={notifications} />
                    )}

                    {isUploading && (
                        <UploadStatusPanel
                            items={uploadItems.map((item) => ({
                                id: item.id,
                                filename: item.filename,
                                progress: item.progress,
                                status: item.status,
                                errorMessage: item.errorMessage
                            }))}
                        />
                    )}
                </main>

                <Chatbot
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    onOpen={() => setIsChatOpen(true)}
                    isLoggedIn={isLoggedIn}
                    onSearchResults={handleChatSearchResults}
                    onFolderCreated={(folderName, folderType, photoIds) => {
                        const photoIdStrings = photoIds.map((id) => String(id)).filter((id) => id.length > 0);
                        const photoIdSet = new Set(photoIdStrings);

                        if (folderType === 'SHARED') {
                            setSharedFolders((prev) => (prev.includes(folderName) ? prev : [...prev, folderName]));
                            setSharedFolderStorageByName((prev) => ({ ...prev, [folderName]: '0 MB' }));
                            setSharedFolderCreatedAtByName((prev) => ({ ...prev, [folderName]: prev[folderName] ?? todayDateText }));
                            setSharedFolderPhotosByName((prev) => ({
                                ...prev,
                                [folderName]: myPhotos
                                    .filter((photo) => photoIdSet.has(photo.id))
                                    .map((photo) => ({ photo, addedByMe: true }))
                            }));
                        } else {
                            setFolders((prev) => (prev.includes(folderName) ? prev : [...prev, folderName]));
                            setFolderStorageByName((prev) => ({ ...prev, [folderName]: '0 MB' }));
                            setFolderCreatedAtByName((prev) => ({ ...prev, [folderName]: prev[folderName] ?? todayDateText }));
                            setFolderPhotoIdsByName((prev) => ({ ...prev, [folderName]: photoIdStrings }));
                        }
                    }}
                />
            </div>

            {previewIndex !== null && currentViewPhotos[previewIndex] && (
                <PhotoPreview
                    photo={currentViewPhotos[previewIndex]}
                    onClose={() => setPreviewIndex(null)}
                    onPrev={() => setPreviewIndex((previewIndex - 1 + currentViewPhotos.length) % currentViewPhotos.length)}
                    onNext={() => setPreviewIndex((previewIndex + 1) % currentViewPhotos.length)}
                    onDelete={() => void handleDeleteCurrentPhoto()}
                    onDownload={() => {
                        const currentPhoto = currentViewPhotos[previewIndex];
                        const url = currentPhoto.previewUrl || currentPhoto.thumbnailUrl;
                        // 파일명은 사진 ID나 shotAt(촬영일)을 활용해 지정합니다.
                        const fileName = `phomate_${currentPhoto.id}_${currentPhoto.shotAt || 'image'}.jpg`;
            
                        void downloadImage(url, fileName);}}
                />
            )}

            {isFolderModalOpen && (
                <FolderModal
                    mode={folderModalMode}
                    folderName={selectedFolderForSettings}
                    photoCount={(folderPhotoIdsByName[selectedFolderForSettings] ?? []).length}
                    createdAt={folderCreatedAtByName[selectedFolderForSettings] ?? todayDateText}
                    usedStorage={folderStorageByName[selectedFolderForSettings] ?? '0 MB'}
                    onSave={handleSaveFolder}
                    onDelete={handleDeleteFolder}
                    onClose={() => setIsFolderModalOpen(false)}
                />
            )}

            {isSharedModalOpen && (
                <SharedFolderModal
                    mode={sharedModalMode}
                    folderName={selectedSharedFolderForSettings}
                    photoCount={(sharedFolderPhotosByName[selectedSharedFolderForSettings] ?? []).length}
                    createdAt={sharedFolderCreatedAtByName[selectedSharedFolderForSettings] ?? todayDateText}
                    usedStorage={sharedFolderStorageByName[selectedSharedFolderForSettings] ?? '0 MB'}
                    onSave={handleSaveSharedFolder}
                    onLeave={handleLeaveSharedFolder}
                    onClose={() => setIsSharedModalOpen(false)}
                />
            )}

            {showInviteModal && (
                <InviteModal
                    albumName="공유 앨범 3"
                    onClose={() => setShowInviteModal(false)}
                    onAccept={() => setShowInviteModal(false)}
                    onReject={() => setShowInviteModal(false)}
                />
            )}

            {isUploadModalOpen && (
                <UploadModal onClose={() => setIsUploadModalOpen(false)} onStart={startUpload} />
            )}

            {isAddPhotosModalOpen && selectedFolder && (
                <AddPhotosModal
                    folderName={selectedFolder}
                    photos={myPhotos}
                    selectedPhotoIds={selectedPhotoIdsForAdd}
                    existingPhotoIds={existingPhotoIdsForCurrentTarget}
                    onToggle={togglePhotoSelectionForAdd}
                    onClose={() => { setIsAddPhotosModalOpen(false); setSelectedPhotoIdsForAdd([]); }}
                    onSubmit={requestAddSelectedPhotos}
                />
            )}

            {addPhotosConfirm && (
                <ActionModal
                    config={{ type: 'delete_confirm', message: `${addPhotosConfirm.selectedPhotoIds.length}장의 사진을 '${addPhotosConfirm.folderName}'에 추가하시겠습니까?` }}
                    onClose={() => setAddPhotosConfirm(null)}
                    onConfirm={handleConfirmAddSelectedPhotos}
                />
            )}

            {modalConfig && (
                <ActionModal
                    config={modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={() => {
                        if (modalConfig.type === 'delete_confirm') setModalConfig({ type: 'alert', message: '삭제되었습니다.' });
                        else setModalConfig(null);
                    }}
                />
            )}

            {isStorageModalOpen && (
                <StorageUsageModal
                    totalStorageText={totalStorageText}
                    usedStorageText={usedStorageText}
                    remainingStorageText={remainingStorageText}
                    storagePercent={storagePercent}
                    folderUsages={folders.map((name) => ({ name, storage: folderStorageByName[name] ?? '0 MB' }))}
                    sharedFolderUsages={sharedFolders.map((name) => ({ name, storage: sharedFolderStorageByName[name] ?? '0 MB' }))}
                    onClose={() => setIsStorageModalOpen(false)}
                />
            )}
        </div>
    );
}