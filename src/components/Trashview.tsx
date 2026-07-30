import React, { useEffect, useRef, useState } from 'react';
import PhotoCard from './Photocard';
import ActionModal from './Actionmodal';
import { Photo } from '../types';
import { getAccessToken } from '../api/auth';
import { getTrashLatest, purgePhoto, restorePhoto } from '../api/photo';
import '../styles/Trashview.css';

type TrashViewProps = {
    isLoggedIn: boolean;
    onChanged?: () => void;
    onUnauthorized?: () => void;
};

export default function TrashView({ isLoggedIn, onChanged, onUnauthorized }: TrashViewProps) {
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const isDragSelectingRef = useRef(false);
    const dragSelectActionRef = useRef<'add' | 'remove'>('add');
    const dragProcessedIdsRef = useRef<Set<string>>(new Set());

    const applyDragSelect = (photoId: string) => {
        if (!isDragSelectingRef.current) return;
        if (dragProcessedIdsRef.current.has(photoId)) return;
        dragProcessedIdsRef.current.add(photoId);
        setSelectedIds((prev) =>
            dragSelectActionRef.current === 'add'
                ? prev.includes(photoId) ? prev : [...prev, photoId]
                : prev.filter((id) => id !== photoId)
        );
    };

    const startDragSelect = (photoId: string, currentlySelected: boolean) => {
        const action = currentlySelected ? 'remove' : 'add';
        dragSelectActionRef.current = action;
        dragProcessedIdsRef.current = new Set([photoId]);
        isDragSelectingRef.current = true;
        setSelectedIds((prev) =>
            action === 'add'
                ? prev.includes(photoId) ? prev : [...prev, photoId]
                : prev.filter((id) => id !== photoId)
        );
        const stop = () => {
            isDragSelectingRef.current = false;
            dragProcessedIdsRef.current = new Set();
            document.removeEventListener('pointerup', stop);
        };
        document.addEventListener('pointerup', stop);
    };

    useEffect(() => {
        const onTouchMove = (e: TouchEvent) => {
            if (!isDragSelectingRef.current) return;
            const touch = e.touches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const card = el?.closest('[data-photo-id]') as HTMLElement | null;
            if (card?.dataset.photoId) applyDragSelect(card.dataset.photoId);
        };
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        return () => document.removeEventListener('touchmove', onTouchMove);
    }, []);
    const [modalConfig, setModalConfig] = useState<{type: 'restore' | 'delete_confirm' | 'alert', message: string} | null>(null);
    const [trashPhotos, setTrashPhotos] = useState<Photo[]>([]);

    const isUnauthorizedError = (error: unknown): boolean => {
        if (!(error instanceof Error)) return false;
        const message = error.message.toLowerCase();
        return message.includes('401') || message.includes('unauthorized');
    };

    const errorMessageOf = (error: unknown, fallback: string): string => {
        return error instanceof Error ? error.message : fallback;
    };

    const formatFailedIds = (ids: string[]): string => {
        if (ids.length === 0) return '-';
        const preview = ids.slice(0, 8).join(', ');
        return ids.length > 8 ? `${preview} 외 ${ids.length - 8}건` : preview;
    };

    const loadTrash = async () => {
        if (!isLoggedIn) {
            setTrashPhotos([]);
            return;
        }

        try {
            const items = await getTrashLatest({ size: 60 });
            setTrashPhotos(items.map((item) => ({
                id: String(item.photoId),
                thumbnailUrl: item.thumbnailUrl || item.previewUrl,
                previewUrl: item.previewUrl,
                shotAt: item.shotAt,
                likeCount: 0
            })));
        } catch (error: unknown) {
            if (isUnauthorizedError(error)) {
                if (onUnauthorized && !getAccessToken()) onUnauthorized();
                const message = error instanceof Error ? error.message : '휴지통을 불러오지 못했습니다.';
                window.alert(message);
                return;
            }
            const message = error instanceof Error ? error.message : '휴지통을 불러오지 못했습니다.';
            window.alert(message);
        }
    };

    useEffect(() => {
        void loadTrash();
    }, [isLoggedIn]);

    useEffect(() => {
        setSelectedIds((prev) => {
            if (prev.length === 0) return prev;
            const existingIds = new Set(trashPhotos.map((photo) => photo.id));
            return prev.filter((id) => existingIds.has(id));
        });
    }, [trashPhotos]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleAction = (actionType: 'restore' | 'delete') => {
        if (selectedIds.length === 0) return;
        if (actionType === 'restore') {
            setModalConfig({ type: 'restore', message: '선택한 사진을 복구하시겠습니까?' });
        } else {
            setModalConfig({ type: 'delete_confirm', message: '삭제하시겠습니까?' });
        }
    };

    const allSelected = trashPhotos.length > 0 && selectedIds.length === trashPhotos.length;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([]);
            return;
        }

        setSelectedIds(trashPhotos.map((photo) => photo.id));
    };

    const executeRestore = async () => {
        let successCount = 0;
        let firstFailureMessage = '';
        const failedIds: string[] = [];

        for (const id of selectedIds) {
            const photoId = Number(id);
            if (!Number.isFinite(photoId) || photoId <= 0) continue;
            try {
                await restorePhoto(photoId);
                successCount += 1;
            } catch (error: unknown) {
                failedIds.push(id);
                if (!firstFailureMessage) {
                    firstFailureMessage = errorMessageOf(error, '사진 복구에 실패했습니다.');
                }
                if (isUnauthorizedError(error) && onUnauthorized && !getAccessToken()) {
                    onUnauthorized();
                    return;
                }
            }
        }

        const failedCount = selectedIds.length - successCount;
        const resultMessage = failedCount > 0
            ? `복구 ${successCount}건, 실패 ${failedCount}건\n실패 ID: ${formatFailedIds(failedIds)}\n${firstFailureMessage}`
            : '복구되었습니다.';

        setModalConfig({ type: 'alert', message: resultMessage });
        setIsSelectMode(failedCount > 0);
        setSelectedIds(failedIds);
        await loadTrash();
        if (onChanged) onChanged();
    };

    const executePurge = async () => {
        let successCount = 0;
        let firstFailureMessage = '';
        const failedIds: string[] = [];

        for (const id of selectedIds) {
            const photoId = Number(id);
            if (!Number.isFinite(photoId) || photoId <= 0) continue;
            try {
                await purgePhoto(photoId);
                successCount += 1;
            } catch (error: unknown) {
                failedIds.push(id);
                if (!firstFailureMessage) {
                    firstFailureMessage = errorMessageOf(error, '사진 완전 삭제에 실패했습니다.');
                }
                if (isUnauthorizedError(error) && onUnauthorized && !getAccessToken()) {
                    onUnauthorized();
                    return;
                }
            }
        }

        const failedCount = selectedIds.length - successCount;
        const resultMessage = failedCount > 0
            ? `삭제 ${successCount}건, 실패 ${failedCount}건\n실패 ID: ${formatFailedIds(failedIds)}\n${firstFailureMessage}`
            : '삭제되었습니다.';

        setModalConfig({ type: 'alert', message: resultMessage });
        setIsSelectMode(failedCount > 0);
        setSelectedIds(failedIds);
        await loadTrash();
        if (onChanged) onChanged();
    };

    const COL = 4;
    const cols: Photo[][] = Array.from({ length: COL }, () => []);
    trashPhotos.forEach((photo, i) => cols[i % COL].push(photo));

    return (
        <div className="trash-view-container">
            <div className="photo-masonry">
                {cols.map((col, ci) => (
                    <div key={ci} className="photo-masonry-col">
                        {col.map((photo) => (
                            <PhotoCard
                                key={photo.id}
                                photo={photo}
                                isSelectMode={isSelectMode}
                                isSelected={selectedIds.includes(photo.id)}
                                onSelect={() => toggleSelect(photo.id)}
                                onLongPress={() => {
                                    if (!isSelectMode) setIsSelectMode(true);
                                    startDragSelect(photo.id, selectedIds.includes(photo.id));
                                }}
                                onDragSelectEnter={() => applyDragSelect(photo.id)}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* 하단 플로팅 액션 바: PHOMATE 스타일 적용 */}
            <div className="trash-bottom-controls">
                {!isSelectMode ? (
                    <button className="trash-select-btn" onClick={() => setIsSelectMode(true)}>선택</button>
                ) : (
                    <div className="trash-action-group">
                        <span className="trash-count">{selectedIds.length}개 선택</span>
                        <button className="trash-btn select-all" onClick={toggleSelectAll} disabled={trashPhotos.length === 0}>
                            {allSelected ? '전체 해제' : '전체 선택'}
                        </button>
                        <button className="trash-btn restore" onClick={() => handleAction('restore')}>복구</button>
                        <button className="trash-btn delete" onClick={() => handleAction('delete')}>삭제</button>
                        <button className="trash-btn cancel" onClick={() => {setIsSelectMode(false); setSelectedIds([]);}}>취소</button>
                    </div>
                )}
            </div>

            {modalConfig && (
                <ActionModal 
                    config={modalConfig} 
                    onClose={() => setModalConfig(null)}
                    onConfirm={() => {
                        const run = async () => {
                            if (modalConfig.type === 'restore') {
                                await executeRestore();
                                return;
                            }

                            if (modalConfig.type === 'delete_confirm') {
                                await executePurge();
                                return;
                            }

                            setModalConfig(null);
                        };

                        void run().catch((error: unknown) => {
                            if (isUnauthorizedError(error)) {
                                if (onUnauthorized && !getAccessToken()) onUnauthorized();
                                const message = error instanceof Error ? error.message : '요청 처리에 실패했습니다.';
                                window.alert(message);
                                setModalConfig(null);
                                return;
                            }
                            const message = error instanceof Error ? error.message : '요청 처리에 실패했습니다.';
                            window.alert(message);
                            setModalConfig(null);
                        });
                    }}
                />
            )}
        </div>
    );
}