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

export default function StorageUsageModal({ folderUsages, sharedFolderUsages, onClose }: StorageUsageModalProps) {
  return (
    <div className="storage-modal-overlay" onClick={onClose}>
      <div className="storage-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="storage-modal-header">
          <h2 className="storage-modal-title">저장 공간 상세</h2>
          <button className="storage-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
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