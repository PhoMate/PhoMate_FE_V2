import React, { useState } from 'react';
import PhotoCard from './Photocard';
import ActionModal from './Actionmodal';
import { Photo } from '../types';
import '../styles/TrashView.css';

export default function TrashView() {
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [modalConfig, setModalConfig] = useState<{type: 'restore' | 'delete_confirm' | 'alert', message: string} | null>(null);

    // 휴지통 더미 데이터
    const trashPhotos: Photo[] = Array.from({ length: 6 }, (_, i) => ({
        id: `trash-${i}`,
        thumbnailUrl: `https://picsum.photos/400/500?random=${i + 50}`,
        likeCount: 0,
    }));

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleAction = (actionType: 'restore' | 'delete') => {
        if (selectedIds.length === 0) return;
        if (actionType === 'restore') {
            setModalConfig({ type: 'alert', message: '복구되었습니다.' });
            setIsSelectMode(false);
            setSelectedIds([]);
        } else {
            setModalConfig({ type: 'delete_confirm', message: '삭제하시겠습니까?' });
        }
    };

    return (
        <div className="trash-view-container">
            <div className="photo-grid">
                {trashPhotos.map((photo) => (
                    <PhotoCard 
                        key={photo.id} 
                        photo={photo} 
                        isSelectMode={isSelectMode}
                        isSelected={selectedIds.includes(photo.id)}
                        onSelect={() => toggleSelect(photo.id)}
                    />
                ))}
            </div>

            {/* 하단 플로팅 액션 바: PHOMATE 스타일 적용 */}
            <div className="trash-bottom-controls">
                {!isSelectMode ? (
                    <button className="trash-select-btn" onClick={() => setIsSelectMode(true)}>선택</button>
                ) : (
                    <div className="trash-action-group">
                        <span className="trash-count">{selectedIds.length}개 선택</span>
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
                        if(modalConfig.type === 'delete_confirm') {
                            setModalConfig({type: 'alert', message: '삭제되었습니다.'});
                            setIsSelectMode(false);
                            setSelectedIds([]);
                        } else {
                            setModalConfig(null);
                        }
                    }}
                />
            )}
        </div>
    );
}