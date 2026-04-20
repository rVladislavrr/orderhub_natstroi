import { useState } from 'react';
import { uploadOrderFile } from '../../../api/ordersApi';
import { toast } from 'react-toastify';

const FILE_STATUSES = {
  'Только добавлен': 'status-new',
  Обрабатывается: 'status-processing',
  Обработан: 'status-processed',
  Ошибочный: 'status-error',
};

const FileUploadSection = ({ orderUuid, files, onFileUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedErrorFile, setExpandedErrorFile] = useState(null);

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
                          <span className={`file-item-status ${statusClass}`}>{file.status}</span>
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
    </div>
  );
};

export default FileUploadSection;
