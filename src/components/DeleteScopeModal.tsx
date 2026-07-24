import React from 'react';
import { FolderMinus, Trash2, X } from 'lucide-react';
import '../styles/DeleteScopeModal.css';

interface DeleteScopeModalProps {
    photoCount: number;
    folderName: string;
    onRemoveFromFolder: () => void;
    onDeleteFromAccount: () => void;
    onClose: () => void;
}

export default function DeleteScopeModal({
    photoCount,
    folderName,
    onRemoveFromFolder,
    onDeleteFromAccount,
    onClose,
}: DeleteScopeModalProps) {
    const label = `사진 ${photoCount}장`;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="delete-scope-modal" onClick={(e) => e.stopPropagation()}>
                <div className="delete-scope-header">
                    <span className="delete-scope-title">삭제 방식 선택</span>
                    <button className="delete-scope-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
                <p className="delete-scope-desc">{label}을 어떻게 처리할까요?</p>

                <div className="delete-scope-options">
                    <button className="delete-scope-option folder-remove" onClick={onRemoveFromFolder}>
                        <FolderMinus size={22} className="delete-scope-icon" />
                        <div className="delete-scope-option-text">
                            <strong>폴더에서만 제거</strong>
                            <span>'{folderName}'에서 제거되지만<br />내 사진 보관함에는 유지됩니다</span>
                        </div>
                    </button>
                    <button className="delete-scope-option account-delete" onClick={onDeleteFromAccount}>
                        <Trash2 size={22} className="delete-scope-icon" />
                        <div className="delete-scope-option-text">
                            <strong>계정에서 삭제</strong>
                            <span>모든 폴더에서 제거되고<br />휴지통으로 이동됩니다</span>
                        </div>
                    </button>
                </div>

                <button className="delete-scope-cancel" onClick={onClose}>취소</button>
            </div>
        </div>
    );
}
