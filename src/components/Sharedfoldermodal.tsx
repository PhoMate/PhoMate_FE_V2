import React, { useEffect, useState } from 'react';
import { X, UserPlus, Calendar, Image as ImageIcon, HardDrive, RefreshCw } from 'lucide-react';
import ActionModal from './Actionmodal';
import '../styles/SharedFolderModal.css';

interface SharedFolderModalProps {
  mode?: 'create' | 'settings';
  folderId?: number;
  folderName: string;
  photoCount?: number;
  createdAt?: string;
  usedStorage?: string;
  onSave: (nextName: string) => boolean | void | Promise<boolean | void>;
  onLeave?: () => void | Promise<void>;
  onClose: () => void;
}

type SharedFolderRole = 'READ' | 'WRITE' | 'ADMIN';

type KnownMember = {
  memberId: number;
  role: SharedFolderRole;
};

export default function SharedFolderModal({
  mode = 'settings',
  folderId,
  folderName,
  photoCount = 0,
  createdAt = '-',
  usedStorage = '0 MB',
  onSave,
  onLeave,
  onClose
}: SharedFolderModalProps) {
  const storageScopedKey = folderId ? String(folderId) : folderName;
  const [inputName, setInputName] = useState(folderName);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [inviteMemberId, setInviteMemberId] = useState('');
  const [inviteRole, setInviteRole] = useState<SharedFolderRole>('READ');
  const [knownMembers, setKnownMembers] = useState<KnownMember[]>([]);
  const [roleTargetMemberId, setRoleTargetMemberId] = useState('');
  const [roleToUpdate, setRoleToUpdate] = useState<SharedFolderRole>('READ');
  const [statusMessage, setStatusMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setInputName(folderName);
  }, [folderName, mode]);

  useEffect(() => {
    if (!storageScopedKey || mode !== 'settings') {
      setKnownMembers([]);
      setRoleTargetMemberId('');
      return;
    }

    const storageKey = `phomate.sharedFolder.members.${storageScopedKey}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setKnownMembers([]);
      setRoleTargetMemberId('');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Array<{ memberId?: number; role?: string }>;
      const normalized = parsed
        .map((item) => {
          const memberId = Number(item.memberId ?? 0);
          const role = item.role === 'WRITE' || item.role === 'ADMIN' ? item.role : 'READ';
          return { memberId, role } as KnownMember;
        })
        .filter((item) => item.memberId > 0);
      setKnownMembers(normalized);
      setRoleTargetMemberId(normalized[0] ? String(normalized[0].memberId) : '');
    } catch {
      setKnownMembers([]);
      setRoleTargetMemberId('');
    }
  }, [storageScopedKey, mode]);

  useEffect(() => {
    if (!storageScopedKey || mode !== 'settings') return;
    const storageKey = `phomate.sharedFolder.members.${storageScopedKey}`;
    localStorage.setItem(storageKey, JSON.stringify(knownMembers));
  }, [storageScopedKey, knownMembers, mode]);

  const upsertKnownMember = (memberId: number, role: SharedFolderRole) => {
    setKnownMembers((prev) => {
      const exists = prev.some((item) => item.memberId === memberId);
      if (!exists) {
        return [...prev, { memberId, role }];
      }

      return prev.map((item) => item.memberId === memberId ? { ...item, role } : item);
    });
  };

  const handleSave = async () => {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    const result = await Promise.resolve(onSave(trimmed));
    if (result === false) return;
    onClose();
  };

  const handleLeaveFolder = () => {
    setIsLeaveConfirmOpen(true);
  };

  const handleConfirmLeaveFolder = async () => {
    await Promise.resolve(onLeave?.());
    setIsLeaveConfirmOpen(false);
    onClose();
  };

  const handleInviteMember = async () => {
    const memberId = Number(inviteMemberId.trim());
    if (!Number.isFinite(memberId) || memberId <= 0) {
      setStatusMessage('초대할 멤버 ID를 올바르게 입력해주세요.');
      return;
    }

    setIsBusy(true);
    setStatusMessage('');
    try {
      await Promise.resolve();
      upsertKnownMember(memberId, inviteRole);
      if (!roleTargetMemberId) {
        setRoleTargetMemberId(String(memberId));
      }
      setInviteMemberId('');
      setStatusMessage(`멤버 ${memberId}를 목록에 추가했습니다.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '멤버 초대에 실패했습니다.';
      setStatusMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateRole = async () => {
    const memberId = Number(roleTargetMemberId.trim());
    if (!Number.isFinite(memberId) || memberId <= 0) {
      setStatusMessage('권한을 변경할 멤버 ID를 올바르게 입력해주세요.');
      return;
    }

    setIsBusy(true);
    setStatusMessage('');
    try {
      await Promise.resolve();
      upsertKnownMember(memberId, roleToUpdate);
      setStatusMessage(`멤버 ${memberId} 권한을 ${roleToUpdate}로 변경했습니다.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '권한 변경에 실패했습니다.';
      setStatusMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const roleText = (role: SharedFolderRole): string => {
    if (role === 'ADMIN') return '관리자';
    if (role === 'WRITE') return '편집 가능';
    return '보기 전용';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="shared-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* 헤더 섹션: 이름 수정 및 닫기 버튼 */}
        <div className="modal-header">
          <div className="title-area">
            <h2 className="modal-title">{mode === 'create' ? '공유 폴더 생성' : `${folderName} 설정`}</h2>
            <button className="text-link-btn">{mode === 'create' ? '공유 보관함' : '공유 사진 보관함'}</button>
          </div>
          <button className="close-icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="section-container">
          <label className="section-label">공유 폴더 이름</label>
          <div className="invite-input-row">
            <input
              type="text"
              className="modern-input"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="공유 폴더 이름"
            />
          </div>
        </div>

        {mode === 'settings' && (
          <>
            <div className="section-container">
              <label className="section-label">폴더 정보 요약</label>
              <div className="link-copy-container folder-summary-box">
                <div className="member-info folder-summary-row">
                  <div className="info-item">
                    <ImageIcon size={16} className="summary-icon" />
                    <span className="summary-text">사진 {photoCount}장</span>
                  </div>
                  <div className="summary-divider" />
                  <div className="info-item">
                    <Calendar size={16} className="summary-icon" />
                    <span className="summary-text">{createdAt} 생성</span>
                  </div>
                  <div className="summary-divider" />
                  <div className="info-item">
                    <HardDrive size={16} className="summary-icon" />
                    <span className="summary-text">사진 용량 {usedStorage}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="section-container">
              <label className="section-label">새 멤버 초대</label>
              <div className="invite-input-row">
                <input
                  type="text"
                  className="modern-input"
                  placeholder="초대할 멤버 ID 입력"
                  value={inviteMemberId}
                  onChange={(e) => setInviteMemberId(e.target.value)}
                  disabled={isBusy}
                />
                <select
                  className="role-dropdown"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as SharedFolderRole)}
                  disabled={isBusy}
                >
                  <option value="READ">보기 전용</option>
                  <option value="WRITE">편집 가능</option>
                  <option value="ADMIN">관리자</option>
                </select>
                <button className="icon-action-btn primary" onClick={() => void handleInviteMember()} disabled={isBusy}><UserPlus size={18} /></button>
              </div>
            </div>

            <div className="section-container">
              <label className="section-label">멤버 권한 변경</label>
              {knownMembers.length > 0 ? (
                <>
                  <div className="shared-member-list">
                    {knownMembers.map((member) => (
                      <button
                        key={member.memberId}
                        type="button"
                        className={`shared-member-chip ${roleTargetMemberId === String(member.memberId) ? 'active' : ''}`}
                        onClick={() => setRoleTargetMemberId(String(member.memberId))}
                      >
                        <span>멤버 {member.memberId}</span>
                        <span>{roleText(member.role)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="invite-input-row">
                    <select
                      className="role-dropdown"
                      value={roleTargetMemberId}
                      onChange={(e) => setRoleTargetMemberId(e.target.value)}
                      disabled={isBusy || knownMembers.length === 0}
                    >
                      {knownMembers.length === 0 ? (
                        <option value="">멤버 선택</option>
                      ) : null}
                      {knownMembers.map((member) => (
                        <option key={member.memberId} value={String(member.memberId)}>
                          멤버 {member.memberId}
                        </option>
                      ))}
                    </select>
                    <select
                      className="role-dropdown"
                      value={roleToUpdate}
                      onChange={(e) => setRoleToUpdate(e.target.value as SharedFolderRole)}
                      disabled={isBusy}
                    >
                      <option value="READ">보기 전용</option>
                      <option value="WRITE">편집 가능</option>
                      <option value="ADMIN">관리자</option>
                    </select>
                    <button className="icon-action-btn primary" onClick={() => void handleUpdateRole()} disabled={isBusy || !roleTargetMemberId}>
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="shared-member-empty">멤버 목록이 없습니다. 먼저 멤버를 초대하세요.</div>
              )}
            </div>

            {statusMessage ? <p className="shared-folder-status-message">{statusMessage}</p> : null}
          </>
        )}
              
        {/* 하단 푸터 버튼 */}
        <div className="modal-footer">
          {mode === 'settings' && <button className="quit-btn" onClick={handleLeaveFolder}>폴더 나가기</button>}
          <button className="save-btn" onClick={handleSave}>{mode === 'create' ? '폴더 생성' : '설정 완료'}</button>
        </div>
        {isLeaveConfirmOpen && (
          <ActionModal
            config={{
              type: 'delete_confirm',
              message: `'${folderName}' 에서 나가시겠습니까?\n나가면 다시 초대받아야 접근할 수 있습니다.`,
            }}
            onClose={() => setIsLeaveConfirmOpen(false)}
            onConfirm={handleConfirmLeaveFolder}
          />
        )}
      </div>
    </div>
  );
}