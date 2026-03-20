import React, { useEffect, useState } from 'react';
import { X, UserPlus, Calendar, Image as ImageIcon, HardDrive, RefreshCw } from 'lucide-react';
import ActionModal from './Actionmodal';
import { authFetch } from '../api/auth';
import '../styles/SharedFolderModal.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function toApiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  return new URL(path, API_BASE_URL).toString();
}

async function buildHttpError(response: Response, fallbackMessage: string): Promise<Error> {
  let detail = '';
  try {
    detail = (await response.text()).trim();
  } catch {
    detail = '';
  }

  const suffix = detail
    ? ` (${response.status} ${response.statusText}: ${detail})`
    : ` (${response.status} ${response.statusText})`;
  return new Error(`${fallbackMessage}${suffix}`);
}

function inferMemberIdFromEmail(email: string): number | null {
  const trimmed = email.trim().toLocaleLowerCase();

  const memberAliasMatch = trimmed.match(/^member(\d+)@/);
  if (memberAliasMatch) {
    const parsed = Number(memberAliasMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const numericLocalPart = trimmed.split('@')[0] ?? '';
  if (/^\d+$/.test(numericLocalPart)) {
    const parsed = Number(numericLocalPart);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

async function inviteSharedFolderMemberByEmail(
  folderId: number,
  email: string,
  role: SharedFolderRole
): Promise<{ memberId: number | null }> {
  const responseByEmail = await authFetch(toApiUrl(`/api/folders/${folderId}/members`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role })
  });

  if (responseByEmail.ok) {
    return { memberId: inferMemberIdFromEmail(email) };
  }

  const inferredMemberId = inferMemberIdFromEmail(email);
  if (inferredMemberId === null) {
    throw await buildHttpError(
      responseByEmail,
      '이메일 초대 요청이 실패했습니다. 서버가 memberId 기반 초대만 지원할 수 있습니다.'
    );
  }

  const responseByMemberId = await authFetch(toApiUrl(`/api/folders/${folderId}/members`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId: inferredMemberId, role })
  });

  if (!responseByMemberId.ok) {
    throw await buildHttpError(responseByMemberId, '공유 폴더 초대에 실패했습니다.');
  }

  return { memberId: inferredMemberId };
}

async function updateSharedFolderMemberRole(
  folderId: number,
  memberId: number,
  role: SharedFolderRole
): Promise<void> {
  const response = await authFetch(toApiUrl(`/api/folders/${folderId}/members/${memberId}/role`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });

  if (!response.ok) {
    throw await buildHttpError(response, '공유 폴더 권한 변경에 실패했습니다.');
  }
}

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
  email: string;
  memberId?: number;
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<SharedFolderRole>('READ');
  const [knownMembers, setKnownMembers] = useState<KnownMember[]>([]);
  const [roleTargetEmail, setRoleTargetEmail] = useState('');
  const [roleToUpdate, setRoleToUpdate] = useState<SharedFolderRole>('READ');
  const [statusMessage, setStatusMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const normalizeEmail = (value: string): string => value.trim().toLocaleLowerCase();
  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

  useEffect(() => {
    setInputName(folderName);
  }, [folderName, mode]);

  useEffect(() => {
    if (!storageScopedKey || mode !== 'settings') {
      setKnownMembers([]);
      setRoleTargetEmail('');
      return;
    }

    const storageKey = `phomate.sharedFolder.members.${storageScopedKey}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setKnownMembers([]);
      setRoleTargetEmail('');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Array<{ email?: string; role?: string; memberId?: number }>;
      const normalized = parsed
        .map((item) => {
          const legacyMemberId = Number(item.memberId ?? 0);
          const legacyEmail = Number.isFinite(legacyMemberId) && legacyMemberId > 0
            ? `member${legacyMemberId}@phomate.local`
            : '';
          const email = normalizeEmail(item.email ?? legacyEmail);
          const role = item.role === 'WRITE' || item.role === 'ADMIN' ? item.role : 'READ';
          const memberId = Number(item.memberId ?? 0);
          return {
            email,
            memberId: Number.isFinite(memberId) && memberId > 0 ? memberId : undefined,
            role
          } as KnownMember;
        })
        .filter((item) => !!item.email && isValidEmail(item.email));
      setKnownMembers(normalized);
      setRoleTargetEmail(normalized[0] ? normalized[0].email : '');
    } catch {
      setKnownMembers([]);
      setRoleTargetEmail('');
    }
  }, [storageScopedKey, mode]);

  useEffect(() => {
    if (!storageScopedKey || mode !== 'settings') return;
    const storageKey = `phomate.sharedFolder.members.${storageScopedKey}`;
    localStorage.setItem(storageKey, JSON.stringify(knownMembers));
  }, [storageScopedKey, knownMembers, mode]);

  const upsertKnownMember = (email: string, role: SharedFolderRole, memberId?: number) => {
    setKnownMembers((prev) => {
      const normalizedEmail = normalizeEmail(email);
      const exists = prev.some((item) => item.email === normalizedEmail);
      if (!exists) {
        return [...prev, { email: normalizedEmail, role, memberId }];
      }

      return prev.map((item) => (
        item.email === normalizedEmail
          ? { ...item, role, memberId: memberId ?? item.memberId }
          : item
      ));
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
    const email = normalizeEmail(inviteEmail);
    if (!isValidEmail(email)) {
      setStatusMessage('초대할 이메일 주소를 올바르게 입력해주세요.');
      return;
    }

    setIsBusy(true);
    setStatusMessage('');
    try {
      let resolvedMemberId: number | undefined;
      if (typeof folderId === 'number' && folderId > 0) {
        const result = await inviteSharedFolderMemberByEmail(folderId, email, inviteRole);
        resolvedMemberId = result.memberId ?? undefined;
      }

      upsertKnownMember(email, inviteRole, resolvedMemberId);
      if (!roleTargetEmail) {
        setRoleTargetEmail(email);
      }
      setInviteEmail('');
      setStatusMessage(
        typeof folderId === 'number' && folderId > 0
          ? `${email} 초대 요청을 전송했습니다.`
          : `${email}을(를) 로컬 초대 목록에 추가했습니다. (folderId 연동 전)`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '이메일 초대에 실패했습니다.';
      setStatusMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateRole = async () => {
    const email = normalizeEmail(roleTargetEmail);
    if (!isValidEmail(email)) {
      setStatusMessage('권한을 변경할 이메일을 올바르게 선택해주세요.');
      return;
    }

    const selectedMember = knownMembers.find((member) => member.email === email);

    setIsBusy(true);
    setStatusMessage('');
    try {
      if (
        typeof folderId === 'number' &&
        folderId > 0 &&
        typeof selectedMember?.memberId === 'number' &&
        selectedMember.memberId > 0
      ) {
        await updateSharedFolderMemberRole(folderId, selectedMember.memberId, roleToUpdate);
      }

      upsertKnownMember(email, roleToUpdate, selectedMember?.memberId);

      if (typeof folderId === 'number' && folderId > 0 && !(selectedMember?.memberId && selectedMember.memberId > 0)) {
        setStatusMessage(`${email} 권한을 로컬에서 변경했습니다. (memberId 미확정)`);
      } else {
        setStatusMessage(`${email} 권한을 ${roleToUpdate}로 변경했습니다.`);
      }
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
                  type="email"
                  className="modern-input"
                  placeholder="초대할 이메일 입력"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
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
                        key={member.email}
                        type="button"
                        className={`shared-member-chip ${roleTargetEmail === member.email ? 'active' : ''}`}
                        onClick={() => setRoleTargetEmail(member.email)}
                      >
                        <span>{member.email}</span>
                        <span>{roleText(member.role)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="invite-input-row">
                    <select
                      className="role-dropdown"
                      value={roleTargetEmail}
                      onChange={(e) => setRoleTargetEmail(e.target.value)}
                      disabled={isBusy || knownMembers.length === 0}
                    >
                      {knownMembers.length === 0 ? (
                        <option value="">이메일 선택</option>
                      ) : null}
                      {knownMembers.map((member) => (
                        <option key={member.email} value={member.email}>
                          {member.email}
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
                    <button className="icon-action-btn primary" onClick={() => void handleUpdateRole()} disabled={isBusy || !roleTargetEmail}>
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="shared-member-empty">초대 목록이 없습니다. 먼저 이메일로 멤버를 초대하세요.</div>
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