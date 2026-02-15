import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Photo } from '../types';
import '../styles/PhotoPreview.css';

interface PreviewProps {
    photo: Photo;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    onDelete: () => void;
    onDownload: () => void;
}

export default function PhotoPreview({ 
    photo, 
    onClose, 
    onPrev, 
    onNext, 
    onDelete, 
    onDownload 
}: PreviewProps) {
    return (
        <div className="preview-overlay" onClick={onClose}>
            <div className="preview-content" onClick={(e) => e.stopPropagation()}>
                {/* 상단 액션 바: 삭제, 다운로드, 닫기 */}
                <div className="preview-header">
                    <button className="preview-btn" onClick={onDelete}>삭제</button>
                    <span className="preview-divider">|</span>
                    <button className="preview-btn" onClick={onDownload}>다운로드</button>
                    <button className="preview-close-btn" onClick={onClose}>
                        <X size={28} />
                    </button>
                </div>

                {/* 중앙 메인 바디 */}
                <div className="preview-body">
                    <button className="nav-arrow left" onClick={onPrev}>
                        <ChevronLeft size={40} />
                    </button>
                    
                    <div className="preview-image-container">
                        <img 
                            src={photo.thumbnailUrl} 
                            alt={photo.title} 
                        />
                    </div>

                    <button className="nav-arrow right" onClick={onNext}>
                        <ChevronRight size={40} />
                    </button>
                </div>
            </div>
        </div>
    );
}