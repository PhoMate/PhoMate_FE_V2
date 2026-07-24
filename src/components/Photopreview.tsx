import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Heart, Trash2, X } from 'lucide-react';
import { Photo } from '../types';
import '../styles/Photopreview.css';

interface PreviewProps {
    photo: Photo;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onDelete: () => void;
    onDownload: () => void;
    isLiked?: boolean;
    onLikeToggle?: () => void;
    photoSizeBytes?: number;
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes > 0) return `${bytes} B`;
    return '';
}

function formatShotAt(raw: string | undefined): string {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PhotoPreview({
    photo,
    onClose,
    onPrev,
    onNext,
    onDelete,
    onDownload,
    isLiked = false,
    onLikeToggle,
    photoSizeBytes = 0,
}: PreviewProps) {
    const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
    };

    const shotDate = formatShotAt(photo.shotAt);
    const sizeText = formatBytes(photoSizeBytes);

    return (
        <div className="preview-overlay" onClick={onClose}>
            <div className="preview-shell" onClick={(e) => e.stopPropagation()}>

                {/* 상단 바 */}
                <div className="preview-topbar">
                    <div className="preview-topbar-left">
                        {photo.title && <span className="preview-filename">{photo.title}</span>}
                    </div>
                    <div className="preview-topbar-right">
                        <button
                            className={`preview-icon-btn ${isLiked ? 'liked' : ''}`}
                            onClick={onLikeToggle}
                            title={isLiked ? '좋아요 취소' : '좋아요'}
                        >
                            <Heart size={22} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} />
                        </button>
                        <button className="preview-icon-btn" onClick={onDownload} title="다운로드">
                            <Download size={22} />
                        </button>
                        <button className="preview-icon-btn danger" onClick={onDelete} title="삭제">
                            <Trash2 size={22} />
                        </button>
                        <div className="preview-topbar-divider" />
                        <button className="preview-icon-btn" onClick={onClose} title="닫기">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* 이미지 영역 */}
                <div className="preview-stage">
                    <button className="preview-nav left" onClick={onPrev} title="이전">
                        <ChevronLeft size={28} />
                    </button>

                    <div className="preview-img-wrap">
                        <img
                            className="preview-img"
                            src={photo.originalUrl || photo.previewUrl || photo.thumbnailUrl}
                            alt={photo.title ?? '사진'}
                            onLoad={handleImageLoad}
                        />
                    </div>

                    <button className="preview-nav right" onClick={onNext} title="다음">
                        <ChevronRight size={28} />
                    </button>
                </div>

                {/* 하단 정보 바 */}
                {(shotDate || naturalSize.w > 0 || sizeText || photo.likeCount > 0) && (
                    <div className="preview-infobar">
                        {shotDate && (
                            <div className="preview-info-item">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                {shotDate}
                            </div>
                        )}
                        {naturalSize.w > 0 && (
                            <div className="preview-info-item">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                                    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                                </svg>
                                {naturalSize.w} × {naturalSize.h}
                            </div>
                        )}
                        {sizeText && (
                            <div className="preview-info-item">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                {sizeText}
                            </div>
                        )}
                        {photo.likeCount > 0 && (
                            <div className="preview-info-item">
                                <Heart size={13} fill="#ef4444" color="#ef4444" />
                                {photo.likeCount.toLocaleString()}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
