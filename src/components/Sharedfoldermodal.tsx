import React from 'react';
import { X, Crown } from 'lucide-react';
import '../styles/SharedFolderModal.css';

interface SharedFolderModalProps {
  folderName: string;
  onClose: () => void;
}

export default function SharedFolderModal({ folderName, onClose }: SharedFolderModalProps) {
  // 샘플 데이터
  const members = [
    { id: 1, name: '황태운', email: 'twoon0402@gmail.com', role: 'owner' },
    { id: 2, name: '김나연', email: 'twoon040@gmail.com', role: 'viewer' },
  ];

  const handleCopyLink = () => {
    const link = "https://phomate.com/share/a1b2c3d4";
    navigator.clipboard.writeText(link);
    alert("링크가 복사되었습니다!");
  };

  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* 헤더 섹션 */}
        <div className="shared-modal-header">
          <h2 className="shared-modal-title">공유폴더</h2>
          <button className="edit-text-btn">수정</button>
        </div>

        {/* 멤버 초대 섹션 */}
        <div className="shared-modal-section">
          <div className="invite-row">
            <span className="section-label">멤버 초대 |</span>
            <div className="invite-controls">
              <select className="role-select-box">
                <option>보기 전용</option>
                <option>편집 가능</option>
              </select>
              <button className="invite-action-btn">초대하기</button>
            </div>
          </div>
        </div>

        {/* 멤버 리스트 섹션 */}
        <div className="shared-member-list">
          {members.map((member) => (
            <div key={member.id} className="shared-member-card">
              <div className="member-profile-info">
                <div className="avatar-placeholder" />
                <div className="text-details">
                  <p className="member-name-tag">
                    {member.name} {member.role === 'owner' && <Crown size={14} className="owner-icon" />}
                  </p>
                  <p className="member-email-tag">{member.email}</p>
                </div>
              </div>
              <div className="member-status-area">
                {member.role === 'owner' ? (
                  <span className="owner-label">방장</span>
                ) : (
                  <div className="viewer-controls">
                    <select className="mini-role-select">
                      <option>보기 전용</option>
                    </select>
                    <button className="remove-member-btn"><X size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 링크 공유 섹션 (image_f3b9a3.png 스타일) */}
        <div className="shared-modal-section link-share-area">
          <label className="link-label">링크 공유</label>
          <div className="link-copy-group">
            <input 
              type="text" 
              readOnly 
              value="https://phomate.com/share/a1b2c3d4" 
              className="share-link-input" 
            />
            <button className="copy-action-btn" onClick={handleCopyLink}>링크 복사</button>
          </div>
        </div>

        {/* 하단 버튼 섹션 */}
        <div className="shared-modal-footer">
          <button className="modal-confirm-btn" onClick={onClose}>확인</button>
          <button className="folder-delete-btn">공유 폴더 삭제</button>
        </div>
      </div>
    </div>
  );
}