import React, { useRef } from 'react';
import { Check } from 'lucide-react';
import '../styles/Photocard.css';

const LONG_PRESS_MS = 500;

interface PhotoCardProps {
    photo: { id: string; thumbnailUrl: string; previewUrl?: string; title?: string };
    onClick?: () => void;
    isSelectMode?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    onLongPress?: () => void;
    onDragSelectEnter?: () => void;
    isLiked?: boolean;
    onLikeToggle?: () => void;
}

export default function PhotoCard({ photo, onClick, isSelectMode, isSelected, onSelect, onLongPress, onDragSelectEnter, isLiked, onLikeToggle }: PhotoCardProps) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPressRef = useRef(false);

    const startPress = () => {
        didLongPressRef.current = false;
        timerRef.current = setTimeout(() => {
            didLongPressRef.current = true;
            onLongPress?.();
        }, LONG_PRESS_MS);
    };

    const cancelPress = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleClick = () => {
        if (didLongPressRef.current) return;
        if (isSelectMode) onSelect?.();
        else onClick?.();
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (isSelectMode) { e.preventDefault(); return; }
        const url = photo.previewUrl || photo.thumbnailUrl;
        e.dataTransfer.setData('text/plain', url);
        e.dataTransfer.setData('text/uri-list', url);
        e.dataTransfer.setData('application/x-phomate-photo', JSON.stringify({ id: photo.id, url }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div
            className={`photo-card ${isSelected ? 'selected' : ''}`}
            data-photo-id={photo.id}
            onClick={handleClick}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onMouseEnter={onDragSelectEnter}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchMove={cancelPress}
            draggable={!isSelectMode}
            onDragStart={handleDragStart}
        >
            <div className="photo-card-image">
                <img src={photo.thumbnailUrl} alt={photo.title} draggable={false} />

                {isSelectMode ? (
                    <div className={`select-overlay ${isSelected ? 'active' : ''}`}>
                        <div className="check-circle">
                            {isSelected && <Check size={14} color="white" strokeWidth={4} />}
                        </div>
                    </div>
                ) : (
                    <button
                        className={`photo-like-btn ${isLiked ? 'liked' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onLikeToggle?.(); }}
                        title={isLiked ? '좋아요 취소' : '좋아요'}
                    >
                        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
