import React from 'react';
import '../styles/Folderview.css';

interface FolderViewProps {
    sectionTitle: string;
    folders: string[];
    onFolderClick: (name: string) => void;
}

export default function FolderView({ sectionTitle, folders, onFolderClick }: FolderViewProps) {
    return (
        <div className="folder-view-container">
            <h3 className="folder-section-title">{sectionTitle}</h3>
            <div className="folder-grid">
                {folders.map((name, index) => (
                    <div 
                        key={index} 
                        className="folder-item"
                        onClick={() => onFolderClick(name)}
                    >
                        <div className="folder-icon-wrapper">
                            <svg viewBox="0 0 24 24" className="folder-svg-icon">
                                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                            </svg>
                        </div>
                        <span className="folder-name">{name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}