import React from 'react';
import { Check } from 'lucide-react';
import '../styles/PhotoCard.css';

export default function PhotoCard({ photo, onClick, isSelectMode, isSelected, onSelect }: any) {
    const hasTitle = typeof photo.title === 'string' && photo.title.trim().length > 0;

    return (
        <div className={`photo-card ${isSelected ? 'selected' : ''}`} onClick={isSelectMode ? onSelect : onClick}>
            <div className="photo-card-image">
                <img src={photo.thumbnailUrl} alt={photo.title} />
                {isSelectMode && (
                    <div className={`select-overlay ${isSelected ? 'active' : ''}`}>
                        <div className="check-circle">
                            {isSelected && <Check size={14} color="white" strokeWidth={4} />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}