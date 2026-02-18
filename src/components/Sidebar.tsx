import React from 'react';
import '../styles/Sidebar.css';

type SidebarProps = {
    isOpen: boolean;
    onToggle: () => void;
    activeNav?: string;
    onNavClick: (type: string, target?: string) => void;
    onPlusClick: () => void;
    onLinkClick: () => void;
};

export default function Sidebar({ isOpen, onToggle, activeNav, onNavClick, onPlusClick, onLinkClick }: SidebarProps) {
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
                    <span className="section-title" onClick={() => onNavClick('folder_parent')}>폴더</span>
                    <div className="icon-btn-box" onClick={(e) => { e.stopPropagation(); onPlusClick(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
                    </div>
                </div>
                <div className={`sub-item ${activeNav === 'folder_child' ? 'active' : ''}`} onClick={() => onNavClick('folder_child', '폴더 1')}>📁 폴더 1</div>
            </div>

            {/* 공유 폴더 섹션 */}
            <div className="sidebar-section">
                <div className="section-header">
                    <span className="section-title" onClick={() => onNavClick('shared_parent')}>공유 폴더</span>
                    <div className="icon-btn-box" onClick={(e) => { e.stopPropagation(); onLinkClick(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    </div>
                </div>
                <div className={`sub-item ${activeNav === 'shared_child' ? 'active' : ''}`} onClick={() => onNavClick('shared_child', '공유 폴더 1')}>📁 공유 폴더 1</div>
            </div>

            {/* 하단 영역: 최근 삭제된 항목 + 저장공간 */}
            <div className="sidebar-footer">
                {/* [추가] 최근 삭제된 항목 칸 */}
                <div 
                    className={`sidebar-extra-item ${activeNav === 'trash' ? 'active' : ''}`} 
                    onClick={() => onNavClick('trash')}
                >
                    최근 삭제된 항목
                </div>

                <div className="storage-wrapper">
                    <div className="storage-text">
                        <span>잔여 저장공간</span>
                        <span className="storage-val">13 / 50 GB</span>
                    </div>
                    <div className="storage-bar">
                        <div className="fill" style={{ width: '26%' }} />
                    </div>
                </div>
                <button className="logout-btn-outline">로그아웃</button>
            </div>
        </aside>
    );
}