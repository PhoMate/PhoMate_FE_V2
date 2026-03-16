import React from 'react';
import { X, Folder, FolderOpen } from 'lucide-react';
import '../styles/StorageUsageModal.css';

type UsageItem = {
    name: string;
    storage: string;
};

interface StorageUsageModalProps {
    folderUsages: UsageItem[];
    sharedFolderUsages: UsageItem[];
    totalStorageText: string;
    usedStorageText: string;
    remainingStorageText: string;
    storagePercent?: number; // 추가
    onClose: () => void;
}

function UsageSection({
    title,
    icon,
    items,
    emptyText,
}: {
    title: string;
    icon: React.ReactNode;
    items: UsageItem[];
    emptyText: string;
}) {
    return (
        <div className="storage-section">
            <div className="storage-section-title">
                {icon}
                <span>{title}</span>
            </div>
            {items.length === 0 ? (
                <p className="storage-empty-text">{emptyText}</p>
            ) : (
                <ul className="storage-list">
                    {items.map((item) => (
                        <li key={item.name} className="storage-list-item">
                            <span className="storage-folder-name">{item.name}</span>
                            <span className="storage-folder-value">{item.storage}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function StorageUsageModal({
    folderUsages,
    sharedFolderUsages,
    totalStorageText,
    usedStorageText,
    remainingStorageText,
    storagePercent = 0,
    onClose
}: StorageUsageModalProps) {
    return (
        <div className="storage-modal-overlay" onClick={onClose}>
            <div className="storage-modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="storage-modal-header">
                    <h2 className="storage-modal-title">저장 공간 상세</h2>
                    <button className="storage-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="storage-summary">
                    <div className="storage-summary-item">
                        <span className="storage-summary-label">전체 용량</span>
                        <span className="storage-summary-value">{totalStorageText}</span>
                    </div>
                    <div className="storage-summary-item">
                        <span className="storage-summary-label">사용 중</span>
                        <span className="storage-summary-value">{usedStorageText}</span>
                    </div>
                    <div className="storage-summary-item">
                        <span className="storage-summary-label">잔여 용량</span>
                        <span className="storage-summary-value">{remainingStorageText}</span>
                    </div>
                </div>

                {/* 프로그레스바 추가 */}
                <div className="storage-progress-wrapper">
                    <div className="storage-progress-bar">
                        <div
                            className="storage-progress-fill"
                            style={{ width: `${Math.max(storagePercent, storagePercent > 0 ? 0.5 : 0)}%` }}
                        />
                    </div>
                    <span className="storage-progress-label">
                        {storagePercent < 0.01 && storagePercent > 0
                            ? '< 0.01'
                            : storagePercent.toFixed(2)}% 사용 중
                    </span>
                </div>

                <UsageSection
                    title="개인 폴더"
                    icon={<Folder size={16} />}
                    items={folderUsages}
                    emptyText="개인 폴더가 없습니다."
                />

                <UsageSection
                    title="공유 폴더"
                    icon={<FolderOpen size={16} />}
                    items={sharedFolderUsages}
                    emptyText="공유 폴더가 없습니다."
                />
            </div>
        </div>
    );
}