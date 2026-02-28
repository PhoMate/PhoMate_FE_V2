import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Chatbot from '../components/Chatbot';
import PhotoCard from '../components/Photocard';
import PhotoPreview from '../components/Photopreview';
import FolderView from '../components/Folderview';
import FolderModal from '../components/Foldermodal';
import SharedFolderModal from '../components/Sharedfoldermodal';
import NotificationPanel from '../components/Notificationpanel';
import InviteModal from '../components/Invitemodal';
import TrashView from '../components/Trashview'; 
import ActionModal from '../components/Actionmodal'; 
// 업로드 관련 컴포넌트 추가
import UploadModal from '../components/Uploadmodal'; 
import UploadStatusPanel from '../components/Uploadstatuspanel';
import StorageUsageModal from '../components/StorageUsageModal';
import { Photo } from '../types';
import '../styles/Home.css';

type ViewType = 'home' | 'folder_list' | 'folder_detail' | 'shared_list' | 'shared_detail' | 'trash';

export default function Home() {
    const [view, setView] = useState<ViewType>('home');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folders, setFolders] = useState<string[]>(['폴더 1']);
    const [folderStorageByName, setFolderStorageByName] = useState<Record<string, string>>({
        '폴더 1': '1.2 GB',
    });
    const [sharedFolders, setSharedFolders] = useState<string[]>(['공유 폴더 1']);
    const [sharedFolderStorageByName, setSharedFolderStorageByName] = useState<Record<string, string>>({
        '공유 폴더 1': '11.8 GB',
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(true);

    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [folderModalMode, setFolderModalMode] = useState<'create' | 'settings'>('create');
    const [selectedFolderForSettings, setSelectedFolderForSettings] = useState('새 폴더');
    const [isSharedModalOpen, setIsSharedModalOpen] = useState(false);
    const [sharedModalMode, setSharedModalMode] = useState<'create' | 'settings'>('settings');
    const [selectedSharedFolderForSettings, setSelectedSharedFolderForSettings] = useState('공유 폴더 1');
    const [isNotiOpen, setIsNotiOpen] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [modalConfig, setModalConfig] = useState<{type: 'restore' | 'delete_confirm' | 'alert', message: string} | null>(null);
    const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);

    const startUpload = () => {
        setIsUploadModalOpen(false);
        setIsUploading(true);
        setUploadProgress(0);
    };

    useEffect(() => {
        if (isUploading && uploadProgress < 100) {
            const timer = setTimeout(() => setUploadProgress(prev => prev + 5), 200);
            return () => clearTimeout(timer);
        } else if (uploadProgress >= 100) {
            setTimeout(() => setIsUploading(false), 1000); 
        }
    }, [isUploading, uploadProgress]);

    const dummyPhotos: Photo[] = Array.from({ length: 16 }, (_, i) => ({
        id: String(i),
        thumbnailUrl: `https://picsum.photos/400/500?random=${i}`,
        likeCount: 0,
    }));

    const handleNavigate = (type: string, target?: string) => {
        if (type === 'home') {
            setView('home');
            setSelectedFolder(null);
        } else if (type === 'trash') {
            setView('trash');
            setSelectedFolder(null);
        } else if (type === 'folder_parent') {
            setView('folder_list');
            setSelectedFolder(null);
        } else if (type === 'folder_child') {
            setView('folder_detail');
            setSelectedFolder(target || null);
        } else if (type === 'shared_parent') {
            setView('shared_list');
            setSelectedFolder(null);
        } else if (type === 'shared_child') {
            setView('shared_detail');
            setSelectedFolder(target || null);
        }
    };

    const handleSaveFolder = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        if (folderModalMode === 'create') {
            setFolders((prev) => [...prev, trimmed]);
            setFolderStorageByName((prev) => ({ ...prev, [trimmed]: '0 MB' }));
            setSelectedFolder(trimmed);
            setView('folder_detail');
        } else {
            setFolders((prev) => prev.map((folder) => folder === selectedFolderForSettings ? trimmed : folder));
            setFolderStorageByName((prev) => {
                const currentStorage = prev[selectedFolderForSettings] ?? '0 MB';
                const next = { ...prev };
                delete next[selectedFolderForSettings];
                next[trimmed] = currentStorage;
                return next;
            });
            if (selectedFolder === selectedFolderForSettings) {
                setSelectedFolder(trimmed);
            }
        }
    };

    const handleDeleteFolder = () => {
        const target = selectedFolderForSettings;
        setFolders((prev) => prev.filter((folder) => folder !== target));
        setFolderStorageByName((prev) => {
            const next = { ...prev };
            delete next[target];
            return next;
        });

        if (selectedFolder === target) {
            setSelectedFolder(null);
            setView('folder_list');
        }
    };

    const handleSaveSharedFolder = (nextName: string) => {
        const trimmed = nextName.trim();
        if (!trimmed) return;

        if (sharedModalMode === 'create') {
            setSharedFolders((prev) => [...prev, trimmed]);
            setSharedFolderStorageByName((prev) => ({ ...prev, [trimmed]: '0 MB' }));
            setSelectedFolder(trimmed);
            setView('shared_detail');
            setSelectedSharedFolderForSettings(trimmed);
        } else {
            setSharedFolders((prev) =>
                prev.map((folder) =>
                    folder === selectedSharedFolderForSettings ? trimmed : folder
                )
            );

            setSharedFolderStorageByName((prev) => {
                const currentStorage = prev[selectedSharedFolderForSettings] ?? '0 MB';
                const next = { ...prev };
                delete next[selectedSharedFolderForSettings];
                next[trimmed] = currentStorage;
                return next;
            });

            if (selectedFolder === selectedSharedFolderForSettings) {
                setSelectedFolder(trimmed);
            }

            setSelectedSharedFolderForSettings(trimmed);
        }
    };

    const handleLeaveSharedFolder = () => {
        const target = selectedSharedFolderForSettings;

        setSharedFolders((prev) => prev.filter((folder) => folder !== target));
        setSharedFolderStorageByName((prev) => {
            const next = { ...prev };
            delete next[target];
            return next;
        });

        if (selectedFolder === target) {
            setSelectedFolder(null);
            setView('shared_list');
        }
    };

    const activeNavKey =
        view === 'home' ? 'home' :
        view === 'trash' ? 'trash' :
        view === 'folder_list' ? 'folder_parent' :
        view === 'folder_detail' ? `folder_child:${selectedFolder || ''}` :
        view === 'shared_list' ? 'shared_parent' :
        `shared_child:${selectedFolder || ''}`;

    return (
        <div className="home-container">
            <Navbar 
                onNotiClick={() => setIsNotiOpen(!isNotiOpen)} 
                onUploadClick={() => setIsUploadModalOpen(true)} 
            />

            <div className="main-layout">
                <Sidebar 
                    isOpen={isSidebarOpen}
                    onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                    activeNav={activeNavKey}
                    folders={folders}
                    sharedFolders={sharedFolders}
                    onNavClick={handleNavigate} 
                    onPlusClick={() => {
                        setFolderModalMode('create');
                        setSelectedFolderForSettings('새 폴더');
                        setIsFolderModalOpen(true);
                    }}
                    onLinkClick={() => {
                        setSharedModalMode('create');
                        setSelectedSharedFolderForSettings(`공유 폴더 ${sharedFolders.length + 1}`);
                        setIsSharedModalOpen(true);
                    }}
                    onStorageClick={() => setIsStorageModalOpen(true)}
                    onFolderSettingsClick={(name) => {
                        setFolderModalMode('settings');
                        setSelectedFolderForSettings(name);
                        setIsFolderModalOpen(true);
                    }}
                    onSharedFolderSettingsClick={(name) => {
                        setSharedModalMode('settings');
                        setSelectedSharedFolderForSettings(name);
                        setIsSharedModalOpen(true);
                    }}
                /> 

                <main className={`photo-area 
                    ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} 
                    ${isChatOpen ? 'chat-open' : 'chat-closed'}`}
                >
                    {selectedFolder && <h2 className="folder-title">{selectedFolder}</h2>}

                    {view === 'trash' ? (
                        <TrashView />
                    ) : (view === 'home' || view === 'folder_detail' || view === 'shared_detail') ? (
                        <div className="photo-grid">
                            {dummyPhotos.map((photo, index) => (
                                <PhotoCard 
                                    key={photo.id} 
                                    photo={photo} 
                                    onClick={() => setPreviewIndex(index)} 
                                />
                            ))}
                        </div>
                    ) : (
                        <FolderView onFolderClick={(name) => handleNavigate('folder_child', name)} />
                    )}

                    {isNotiOpen && (
                        <NotificationPanel 
                            onClose={() => setIsNotiOpen(false)} 
                            onItemClick={() => {
                                setIsNotiOpen(false);
                                setShowInviteModal(true);
                            }}
                        />
                    )}

                    {isUploading && (
                        <UploadStatusPanel progress={uploadProgress} />
                    )}
                </main>

                <Chatbot 
                    isOpen={isChatOpen} 
                    onClose={() => setIsChatOpen(false)} 
                    onOpen={() => setIsChatOpen(true)} 
                />
            </div>

            {previewIndex !== null && (
                <PhotoPreview 
                    photo={dummyPhotos[previewIndex]}
                    onClose={() => setPreviewIndex(null)}
                    onPrev={() => setPreviewIndex((previewIndex - 1 + dummyPhotos.length) % dummyPhotos.length)}
                    onNext={() => setPreviewIndex((previewIndex + 1) % dummyPhotos.length)}
                    onDelete={() => {}}
                    onDownload={() => {}}
                />
            )}

            {isFolderModalOpen && (
                <FolderModal
                    mode={folderModalMode}
                    folderName={selectedFolderForSettings}
                    usedStorage={folderStorageByName[selectedFolderForSettings] ?? '0 MB'}
                    onSave={handleSaveFolder}
                    onDelete={handleDeleteFolder}
                    onClose={() => setIsFolderModalOpen(false)}
                />
            )}

            {isSharedModalOpen && (
                <SharedFolderModal
                    mode={sharedModalMode}
                    folderName={selectedSharedFolderForSettings}
                    onSave={handleSaveSharedFolder}
                    onLeave={handleLeaveSharedFolder}
                    onClose={() => setIsSharedModalOpen(false)}
                />
            )}

            {showInviteModal && (
                <InviteModal 
                    albumName="공유 앨범 3" 
                    onClose={() => setShowInviteModal(false)} 
                    onAccept={() => setShowInviteModal(false)}
                    onReject={() => setShowInviteModal(false)}
                />
            )}

            {isUploadModalOpen && (
                <UploadModal 
                    onClose={() => setIsUploadModalOpen(false)} 
                    onStart={startUpload} 
                />
            )}

            {modalConfig && (
                <ActionModal 
                    config={modalConfig} 
                    onClose={() => setModalConfig(null)}
                    onConfirm={() => {
                        if(modalConfig.type === 'delete_confirm') {
                            setModalConfig({type: 'alert', message: '삭제되었습니다.'});
                        } else {
                            setModalConfig(null);
                        }
                    }}
                />
            )}

            {isStorageModalOpen && (
                <StorageUsageModal
                    folderUsages={folders.map((name) => ({
                        name,
                        storage: folderStorageByName[name] ?? '0 MB',
                    }))}
                    sharedFolderUsages={sharedFolders.map((name) => ({
                        name,
                        storage: sharedFolderStorageByName[name] ?? '0 MB',
                    }))}
                    onClose={() => setIsStorageModalOpen(false)}
                />
            )}
        </div>
    );
}