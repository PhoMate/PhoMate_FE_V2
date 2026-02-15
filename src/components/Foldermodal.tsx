import React from 'react';
import { X } from 'lucide-react';
import '../styles/Foldermodal.css';

interface Member {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'viewer';
}

export default function FolderModal({ folderName, onClose }: { folderName: string, onClose: () => void }) {
    const members: Member[] = [
        { id: 'm1', name: '황태운', email: 'twoon0402@gmail.com', role: 'owner' },
        { id: 'm2', name: '김나연', email: 'twoon040@gmail.com', role: 'viewer' },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="folder-setting-modal" onClick={(e) => e.stopPropagation()}>
                
                {/* 폴더 이름 섹션 */}
                <div className="modal-section">
                    <div className="input-group">
                        <span className="label-text">폴더 이름 |</span>
                        <input type="text" defaultValue={folderName} className="modal-input" />
                        <button className="confirm-btn">확인</button>
                    </div>
                </div>

                {/* 멤버 초대 섹션 */}
                <div className="modal-section">
                    <div className="input-group">
                        <span className="label-text">멤버 초대 |</span>
                        <div className="invite-wrapper">
                            <select className="role-select">
                                <option>보기 전용</option>
                                <option>편집 가능</option>
                            </select>
                            <button className="invite-btn">초대하기</button>
                        </div>
                    </div>
                </div>

                {/* 멤버 리스트 섹션 */}
                <div className="member-list-container">
                    {members.map((member) => (
                        <div key={member.id} className="member-item">
                            <div className="member-info">
                                <div className="member-avatar" />
                                <div className="member-details">
                                    <span className="member-name">{member.name} {member.role === 'owner' && '👑'}</span>
                                    <span className="member-email">{member.email}</span>
                                </div>
                            </div>
                            <div className="member-actions">
                                {member.role === 'owner' ? (
                                    <span className="role-tag">방장</span>
                                ) : (
                                    <>
                                        <select className="member-role-select">
                                            <option>보기 전용</option>
                                        </select>
                                        <button className="member-remove-btn"><X size={14} /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <button className="modal-final-confirm" onClick={onClose}>확인</button>
            </div>
        </div>
    );
}