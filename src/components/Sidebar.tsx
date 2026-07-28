import React, { useState } from 'react';
import '../styles/Sidebar.css';

type SidebarProps = {
    isOpen: boolean;
    onToggle: () => void;
    activeNav?: string;
    folders: string[];
    sharedFolders: string[];
    folderPhotoCounts?: Record<string, number>;
    sharedFolderPhotoCounts?: Record<string, number>;
    folderIconsByName?: Record<string, string>;
    sharedFolderIconsByName?: Record<string, string>;
    onNavClick: (type: string, target?: string) => void;
    onPlusClick: () => void;
    onLinkClick: () => void;
    onFolderSettingsClick: (name: string) => void;
    onSharedFolderSettingsClick: (name: string) => void;
};

export default function Sidebar({
    isOpen,
    onToggle,
    activeNav,
    folders,
    sharedFolders,
    folderPhotoCounts = {},
    sharedFolderPhotoCounts = {},
    folderIconsByName = {},
    sharedFolderIconsByName = {},
    onNavClick,
    onPlusClick,
    onLinkClick,
    onFolderSettingsClick,
    onSharedFolderSettingsClick,
}: SidebarProps) {
    const [isFolderSectionOpen, setIsFolderSectionOpen] = useState(true);
    const [isSharedSectionOpen, setIsSharedSectionOpen] = useState(true);

    if (!isOpen) return (
        <div className="sidebar-minimized" onClick={onToggle}>
            <span className="toggle-icon">»</span>
        </div>
    );

    return (
        <aside className="sidebar">
            {/* 브랜드 */}
            <div className="sidebar-brand">
                <div className="sidebar-brand-icon">P</div>
                <span className="sidebar-brand-name">Phomate</span>
                <button className="sidebar-close-btn" onClick={onToggle}>«</button>
            </div>

            {/* 홈 */}
            <div
                className={`nav-home-text ${activeNav === 'home' ? 'active' : ''}`}
                onClick={() => onNavClick('home')}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                홈
            </div>

            {/* 즐겨찾기 */}
            <div
                className={`nav-home-text ${activeNav === 'favorites' ? 'active' : ''}`}
                onClick={() => onNavClick('favorites')}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                즐겨찾기
            </div>

            {/* 최근 업로드 */}
            <div
                className={`nav-home-text ${activeNav === 'recent' ? 'active' : ''}`}
                onClick={() => onNavClick('recent')}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
                최근 업로드
            </div>

            {/* 내 폴더 섹션 */}
            <div className="sidebar-section">
                <div className="section-header">
                    <div className="section-title-box">
                        <button
                            type="button"
                            className="section-toggle-btn"
                            onClick={() => setIsFolderSectionOpen((prev) => !prev)}
                        >
                            {isFolderSectionOpen ? '▾' : '▸'}
                        </button>
                        <span className="section-title" onClick={() => onNavClick('folder_parent')}>
                            내 폴더
                        </span>
                    </div>
                    <div className="icon-btn-box" onClick={(e) => { e.stopPropagation(); onPlusClick(); }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            <line x1="12" y1="11" x2="12" y2="17" />
                            <line x1="9" y1="14" x2="15" y2="14" />
                        </svg>
                    </div>
                </div>
                {isFolderSectionOpen && folders.map((folderName) => {
                    const count = folderPhotoCounts[folderName] ?? 0;
                    const isActive = activeNav === `folder_child:${folderName}`;
                    return (
                        <div key={folderName} className="sub-item-row">
                            <div
                                className={`sub-item ${isActive ? 'active' : ''}`}
                                onClick={() => onNavClick('folder_child', folderName)}
                            >
                                <div className="folder-thumb-placeholder">{folderIconsByName[folderName] ?? '📁'}</div>
                                <span className="folder-name">{folderName}</span>
                                {count > 0 && <span className="folder-count">{count}</span>}
                            </div>
                            <button
                                className="sub-item-setting-btn"
                                onClick={(e) => { e.stopPropagation(); onFolderSettingsClick(folderName); }}
                                title="폴더 설정"
                            >
                                ⚙
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 공유 보관함 섹션 */}
            <div className="sidebar-section">
                <div className="section-header">
                    <div className="section-title-box">
                        <button
                            type="button"
                            className="section-toggle-btn"
                            onClick={() => setIsSharedSectionOpen((prev) => !prev)}
                        >
                            {isSharedSectionOpen ? '▾' : '▸'}
                        </button>
                        <span className="section-title" onClick={() => onNavClick('shared_parent')}>
                            공유 보관함
                        </span>
                    </div>
                    <div className="icon-btn-box" onClick={(e) => { e.stopPropagation(); onLinkClick(); }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                    </div>
                </div>
                {isSharedSectionOpen && sharedFolders.map((folderName) => {
                    const count = sharedFolderPhotoCounts[folderName] ?? 0;
                    const isActive = activeNav === `shared_child:${folderName}`;
                    return (
                        <div key={folderName} className="sub-item-row">
                            <div
                                className={`sub-item ${isActive ? 'active' : ''}`}
                                onClick={() => onNavClick('shared_child', folderName)}
                            >
                                <div className="folder-thumb-placeholder">{sharedFolderIconsByName[folderName] ?? '👥'}</div>
                                <span className="folder-name">{folderName}</span>
                                {count > 0 && <span className="folder-count">{count}</span>}
                            </div>
                            <button
                                className="sub-item-setting-btn"
                                onClick={(e) => { e.stopPropagation(); onSharedFolderSettingsClick(folderName); }}
                                title="공유 폴더 설정"
                            >
                                ⚙
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 푸터 */}
            <div className="sidebar-footer">
                {/* 휴지통 */}
                <div
                    className={`sidebar-extra-item ${activeNav === 'trash' ? 'active' : ''}`}
                    onClick={() => onNavClick('trash')}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    휴지통
                </div>

            </div>
        </aside>
    );
}
