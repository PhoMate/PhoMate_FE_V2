import React, { useState } from 'react';
import '../styles/Sidebar.css';

type SidebarProps = {
    isOpen: boolean;
    onToggle: () => void;
    activeNav?: string;
    remainingStorageText?: string;
    totalStorageText?: string;
    storagePercent?: number;
    folders: string[];
    sharedFolders: string[];
    onNavClick: (type: string, target?: string) => void;
    onPlusClick: () => void;
    onLinkClick: () => void;
    onStorageClick: () => void;
    onLoginClick?: () => void;
    isLoggedIn?: boolean;
    onLogoutClick?: () => void;
    onFolderSettingsClick: (name: string) => void;
    onSharedFolderSettingsClick: (name: string) => void;
};

export default function Sidebar({
    isOpen,
    onToggle,
    activeNav,
    remainingStorageText = '50.0 GB',
    totalStorageText = '50.0 GB',
    storagePercent = 0,
    folders,
    sharedFolders,
    onNavClick,
    onPlusClick,
    onLinkClick,
    onStorageClick,
    onLogoutClick,
    onLoginClick,
    isLoggedIn = false,
    onFolderSettingsClick,
    onSharedFolderSettingsClick,
}: SidebarProps) {
    const [isFolderSectionOpen, setIsFolderSectionOpen] = useState(true);
    const [isSharedSectionOpen, setIsSharedSectionOpen] = useState(true);

    if (!isOpen) return <div className="sidebar-minimized" onClick={onToggle}><span className="toggle-icon">»</span></div>;

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div
                    className={`nav-home-text ${activeNav === 'home' ? 'active' : ''}`}
                    onClick={() => onNavClick('home')}
                >홈
                </div>
                <span className="sidebar-close-btn" onClick={onToggle}>«</span>
            </div>

            {/* 일반 폴더 섹션 */}
            <div className="sidebar-section">
                <div className="section-header">
                    <div className="section-title-box">
                        <button
                            type="button"
                            className="section-toggle-btn"
                            onClick={() => setIsFolderSectionOpen((prev) => !prev)}
                            aria-label={isFolderSectionOpen ? '폴더 목록 접기' : '폴더 목록 펼치기'}
                        >
                            {isFolderSectionOpen ? '▾' : '▸'}
                        </button>
                        <span className="section-title" onClick={() => onNavClick('folder_parent')}>폴더</span>
                    </div>
                    <div className="icon-btn-box" onClick={(e) => { e.stopPropagation(); onPlusClick(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
                    </div>
                </div>
                {isFolderSectionOpen && folders.map((folderName) => (
                    <div key={folderName} className="sub-item-row">
                        <div
                            className={`sub-item ${activeNav === `folder_child:${folderName}` ? 'active' : ''}`}
                            onClick={() => onNavClick('folder_child', folderName)}
                        >
                            📁 {folderName}
                        </div>
                        <button
                            className="sub-item-setting-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onFolderSettingsClick(folderName);
                            }}
                            title="폴더 설정"
                        >
                            ⚙
                        </button>
                    </div>
                ))}
            </div>

            {/* 공유 폴더 섹션 */}
            <div className="sidebar-section">
                <div className="section-header">
                    <div className="section-title-box">
                        <button
                            type="button"
                            className="section-toggle-btn"
                            onClick={() => setIsSharedSectionOpen((prev) => !prev)}
                            aria-label={isSharedSectionOpen ? '공유 폴더 목록 접기' : '공유 폴더 목록 펼치기'}
                        >
                            {isSharedSectionOpen ? '▾' : '▸'}
                        </button>
                        <span className="section-title" onClick={() => onNavClick('shared_parent')}>공유 폴더</span>
                    </div>
                    <div className="icon-btn-box" onClick={(e) => { e.stopPropagation(); onLinkClick(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    </div>
                </div>
                {isSharedSectionOpen && sharedFolders.map((folderName) => (
                    <div key={folderName} className="sub-item-row">
                        <div
                            className={`sub-item ${activeNav === `shared_child:${folderName}` ? 'active' : ''}`}
                            onClick={() => onNavClick('shared_child', folderName)}
                        >
                            📁 {folderName}
                        </div>
                        <button
                            className="sub-item-setting-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSharedFolderSettingsClick(folderName);
                            }}
                            title="공유 폴더 설정"
                        >
                            ⚙
                        </button>
                    </div>
                ))}
            </div>

            {/* 하단 영역 */}
            <div className="sidebar-footer">
                <div
                    className={`sidebar-extra-item ${activeNav === 'trash' ? 'active' : ''}`}
                    onClick={() => onNavClick('trash')}
                >
                    최근 삭제된 항목
                </div>

                <div className="storage-wrapper storage-clickable" onClick={onStorageClick}>
                    <div className="storage-text">
                        <span>잔여 저장공간</span>
                        <span className="storage-val">{remainingStorageText} / {totalStorageText}</span>
                    </div>
                    <div className="storage-bar">
                        <div className="fill" style={{ width: `${storagePercent}%` }} />
                    </div>
                </div>

                {/* ✅ 로그인 상태에 따라 버튼 전환 */}
                {isLoggedIn ? (
                    <button className="logout-btn-outline" onClick={onLogoutClick}>로그아웃</button>
                ) : (
                    <button className="logout-btn-outline" onClick={onLoginClick}>로그인</button>
                )}
            </div>
        </aside>
    );
}