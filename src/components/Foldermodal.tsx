import React, { useEffect, useState } from 'react';
import { X, Trash2, Calendar, Image as ImageIcon, HardDrive } from 'lucide-react';
import ActionModal from './Actionmodal';
import '../styles/FolderModal.css';

interface FolderModalProps {
  mode?: 'create' | 'settings';
  folderName: string;
  photoCount?: number;
  createdAt?: string;
  usedStorage?: string;
  onSave?: (name: string) => boolean | void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function FolderModal({ mode = 'settings', folderName, photoCount = 0, createdAt = "2026.02.20", usedStorage = '0 MB', onSave, onDelete, onClose }: FolderModalProps) {
  const [inputName, setInputName] = useState(folderName);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setInputName(folderName);
  }, [folderName, mode]);

  const handleSave = () => {
    const result = onSave?.(inputName);
    if (result === false) return;
    onClose();
  };

  const handleDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete?.();
    setIsDeleteConfirmOpen(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="shared-modal-card" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <div className="title-area">
            <h2 className="modal-title">{mode === 'create' ? '폴더 생성' : `${folderName} 설정`}</h2>
            <p className="text-link-btn" style={{ fontSize: '16px', color: '#64748b', textDecoration: 'none' }}>개인 보관함</p>
          </div>
          <button className="close-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="section-container">
          <label className="section-label">폴더 이름</label>
          <div className="invite-input-row" >
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="modern-input"
              placeholder="폴더 이름을 입력하세요"
            />
            <button className="copy-btn" style={{ minWidth: '60px' }} onClick={handleSave}>
              {mode === 'create' ? '생성' : '변경'}
            </button>
          </div>
        </div>

        {mode === 'settings' && (
          <>
            <div className="section-container">
              <label className="section-label">폴더 정보 요약</label>
              <div className="link-copy-container" style={{ padding: '12px 16px' }}>
                <div className="member-info" style={{ width: '100%', justifyContent: 'space-around' }}>
                  <div className="info-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ImageIcon size={16} style={{ color: '#1e3a8a' }} />
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>사진 {photoCount}장</span>
                  </div>
                  <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />
                  <div className="info-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} style={{ color: '#1e3a8a' }} />
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>{createdAt} 생성</span>
                  </div>
                  <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />
                  <div className="info-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HardDrive size={16} style={{ color: '#1e3a8a' }} />
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>사진 용량 {usedStorage}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="member-list-area">
              <label className="section-label">폴더 관리</label>
              <div className="member-item-card folder-delete-card" style={{ cursor: 'pointer', border: '1px solid #fee2e2' }} onClick={handleDelete}>
                <div className="member-info">
                  <div className="member-avatar folder-delete-avatar" style={{ background: '#fef2f2', color: '#ef4444' }}>
                    <Trash2 size={16} />
                  </div>
                  <div className="member-text">
                    <span className="name" style={{ color: '#e11d48' }}>폴더 삭제하기</span>
                    <span className="email">삭제 시 복구가 불가능합니다.</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="modal-footer">
          <button className="save-btn" style={{ flex: 1 }} onClick={handleSave}>
            {mode === 'create' ? '폴더 생성' : '설정 완료'}
          </button>
        </div>

        {isDeleteConfirmOpen && (
          <ActionModal
            config={{
              type: 'delete_confirm',
              message: `'${folderName}' 폴더를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`,
            }}
            onClose={() => setIsDeleteConfirmOpen(false)}
            onConfirm={handleConfirmDelete}
          />
        )}
      </div>
    </div>
  );
}