import { useState } from 'react';
import { uploadOrderFile, deleteOrderFile } from '../../../api/ordersApi';
import { toast } from 'react-toastify';
import ConfirmDeleteModal from './ConfirmDeleteModal';

const FILE_STATUSES = {
  'Только добавлен': 'status-new',
  Обрабатывается: 'status-processing',
  Обработан: 'status-processed',
  Ошибочный: 'status-error',
};

const FileUploadSection = ({ orderUuid, files, onFileUploaded, onFileDeleted }) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedErrorFile, setExpandedErrorFile] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null);

  const toggleErrorDetails = (fileUuid) => {
    setExpandedErrorFile(expandedErrorFile === fileUuid ? null : fileUuid);
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.warning('Выберите файл');
      return;
    }

    try {
      setUploading(true);
      const uploadedFile = await uploadOrderFile(orderUuid, selectedFile);
      onFileUploaded(uploadedFile);
      toast.success('Файл успешно загружен!');
      setSelectedFile(null);

      const fileInput = document.getElementById('excel_file');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Ошибка загрузки файла:', error);
      toast.error('Ошибка при загрузке файла');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDeleteModal = (file, e) => {
    e.stopPropagation();
    setFileToDelete(file);
  };

  const handleCloseDeleteModal = () => {
    setFileToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      setDeletingFileId(fileToDelete.uuid);
      await deleteOrderFile(fileToDelete.uuid);

      const updatedFiles = files.filter((f) => f.uuid !== fileToDelete.uuid);

      if (onFileDeleted) {
        onFileDeleted(updatedFiles);
      }

      if (expandedErrorFile === fileToDelete.uuid) {
        setExpandedErrorFile(null);
      }

      toast.success('Файл успешно удалён');
      setFileToDelete(null);
    } catch (error) {
      console.error('Ошибка удаления файла:', error);
      toast.error('Ошибка при удалении файла');
    } finally {
      setDeletingFileId(null);
    }
  };

  const hasFiles = files && files.length > 0;

  return (
    <div className="file-upload-section">
      <div className="file-upload-header">
        <p className="file-upload-description">Загрузите файл для создания КМД</p>
        {hasFiles && (
          <div className="files-header-wrapper">
            <h4 className="files-header">Загруженные файлы</h4>
          </div>
        )}
      </div>

      <div className="file-upload-main">
        <div className="file-upload-left">
          <div className="file-upload-controls">
            <div className="file-input-wrapper">
              <input
                type="file"
                id="excel_file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                disabled={uploading}
                className="file-input"
              />
              <label
                htmlFor="excel_file"
                className="file-input-label"
              />
            </div>
            <button
              onClick={handleFileUpload}
              disabled={!selectedFile || uploading}
              className="file-upload-button"
            >
              {uploading ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>

          {selectedFile && (
            <div className="selected-file-info">
              <span className="file-icon">📄</span>
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">({(selectedFile.size / 1024).toFixed(2)} КБ)</span>
            </div>
          )}
        </div>

        {hasFiles && (
          <div className="files-list">
            <div className="files-scroll">
              {files.map((file) => {
                const isError = file.status === 'Ошибочный';
                const statusClass = FILE_STATUSES[file.status] || '';
                const isDeleting = deletingFileId === file.uuid;

                return (
                  <div key={file.uuid}>
                    <div
                      className={`file-item ${isError ? 'file-item-error' : ''}`}
                      onClick={() => isError && toggleErrorDetails(file.uuid)}
                      style={{ cursor: isError ? 'pointer' : 'default' }}
                    >
                      <div className="file-item-icon">📄</div>
                      <div className="file-item-info">
                        <div className="file-item-name-status">
                          <span className="file-item-name">{file.file_name}</span>
                          <div className="file-item-actions">
                            <span className={`file-item-status ${statusClass}`}>{file.status}</span>
                            {isError && (
                              <button
                                className="file-delete-button"
                                onClick={(e) => handleOpenDeleteModal(file, e)}
                                disabled={isDeleting}
                                title="Удалить файл"
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                  <line
                                    x1="10"
                                    y1="11"
                                    x2="10"
                                    y2="17"
                                  />
                                  <line
                                    x1="14"
                                    y1="11"
                                    x2="14"
                                    y2="17"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="file-item-meta">
                          <span className="file-item-size">{(file.file_size / 1024).toFixed(2)} КБ</span>
                        </div>
                      </div>
                    </div>

                    {expandedErrorFile === file.uuid && file.comment?.length > 0 && (
                      <div className="error-details-panel">
                        <div className="error-details-header">
                          <span className="error-details-title">Детали ошибки</span>
                          <button
                            className="error-details-close"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedErrorFile(null);
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <div className="error-details-content">
                          {file.comment.map((comment, index) => (
                            <div
                              key={index}
                              className="error-details-item"
                            >
                              <div className="error-mark-detail-row">
                                {comment.mark && (
                                  <div className="error-details-mark">
                                    <strong>Марка:</strong> {comment.mark}
                                  </div>
                                )}
                                {comment.num_details && (
                                  <div className="error-details-num">
                                    <strong>Деталь:</strong> {comment.num_details}
                                  </div>
                                )}
                              </div>
                              {comment.detail?.map((detail, idx) => (
                                <div
                                  key={idx}
                                  className="error-details-detail"
                                >
                                  {detail}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={!!fileToDelete}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        fileName={fileToDelete?.file_name}
        isLoading={!!deletingFileId}
      />
    </div>
  );
};

export default FileUploadSection;
