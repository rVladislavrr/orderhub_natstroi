import React, { useState } from 'react';
import { getMarkDetails } from '../../../../api/ordersApi';
import { getStatusColor } from '../../../../utils/statusUtils';
import { toast } from 'react-toastify';
import LoadingDots from '../../../../components/LoadingDots/LoadingDots';
import EmptyState from '../../../../components/EmptyState/EmptyState';
import { createWorkExecution } from '../../../../api/workApi';
import { assembleMark, shipMark } from '../../../../api/ordersApi';
import './MarksList.css';
import ExecutionModal from '../ExecutionModal/ExecutionModal';
import AssembleModal from '../AssembleModal';
import ShipModal from '../ShipModal';

const DETAILS_PAGE_LIMIT = 10;

const MarksList = ({ marks, onMarkUpdate, selectedKmd, marksLoading, lastElementRef, canChanges }) => {
  const [expandedMarkId, setExpandedMarkId] = useState([]);
  const [markDetails, setMarkDetails] = useState({});
  const [detailsLoading, setDetailsLoading] = useState({});
  const [detailsPagination, setDetailsPagination] = useState({});
  const [localMarkStatuses, setLocalMarkStatuses] = useState({});

  const [executionModal, setExecutionModal] = useState({
    isOpen: false,
    detail: null,
    markInfo: null,
  });
  const [assembleModal, setAssembleModal] = useState({
    isOpen: false,
    mark: null,
  });
  const [shipModal, setShipModal] = useState({
    isOpen: false,
    mark: null,
  });

  const fetchMarkDetails = async (markId, page = 1) => {
    setDetailsLoading((prev) => ({ ...prev, [markId]: true }));
    try {
      const data = await getMarkDetails(markId, page, DETAILS_PAGE_LIMIT);
      setMarkDetails((prev) => ({ ...prev, [markId]: data.details }));
      setDetailsPagination((prev) => ({
        ...prev,
        [markId]: {
          page: data.pagination.page,
          totalPages: data.pagination.total_pages,
          totalItems: data.pagination.total_items,
        },
      }));
    } catch (error) {
      toast.error('Ошибка при загрузке деталей');
    } finally {
      setDetailsLoading((prev) => ({ ...prev, [markId]: false }));
    }
  };

  const toggleMark = async (markId) => {
    const isExpanded = expandedMarkId.includes(markId);
    if (isExpanded) {
      setExpandedMarkId(expandedMarkId.filter((id) => id !== markId));
    } else {
      setExpandedMarkId([...expandedMarkId, markId]);
      if (!markDetails[markId]) {
        await fetchMarkDetails(markId, 1);
      }
    }
  };

  const handlePageChange = async (markId, newPage) => {
    await fetchMarkDetails(markId, newPage);
  };

  const calculateDetailStatus = (remainingQuantity, totalQuantity) => {
    if (remainingQuantity === 0) return 'Завершен';
    if (remainingQuantity < totalQuantity) return 'В работе';
    return 'Новый';
  };

  const getMarkStatus = (mark) => localMarkStatuses[mark.id] ?? mark.status;

  const handleMarkUpdate = (markId, updates) => {
    if (updates.status) {
      setLocalMarkStatuses((prev) => ({ ...prev, [markId]: updates.status }));
    }
    onMarkUpdate(markId, updates);
  };

  const handleOpenExecution = (detail, mark) => {
    setExecutionModal({ isOpen: true, detail, markInfo: mark });
  };

  const handleCloseExecution = () => {
    setExecutionModal({ isOpen: false, detail: null, markInfo: null });
  };

  const handleExecutionSubmit = async (formData) => {
    try {
      const newRemaining = executionModal.detail.remaining_quantity - formData.quantity;
      const totalQuantity = executionModal.detail.details_quantity;
      const newDetailStatus = calculateDetailStatus(newRemaining, totalQuantity);

      const response = await createWorkExecution({
        work_id: 0,
        rel_markadel_id: executionModal.detail.id,
        user_uuid: formData.workerUuid,
        quantity: formData.quantity,
        completion_date: formData.completionDate,
        remaining_quantity: newRemaining,
        detail_status: newDetailStatus,
        message: `Выполнено ${formData.quantity} шт.`,
      });

      const markId = executionModal.markInfo?.id;
      setMarkDetails((prev) => {
        const details = prev[markId] || [];
        const updatedDetails = details.map((d) => (d.id === executionModal.detail.id ? { ...d, remaining_quantity: newRemaining, status: newDetailStatus } : d));
        return { ...prev, [markId]: updatedDetails };
      });

      if (response?.mark_status) {
        handleMarkUpdate(markId, { status: response.mark_status });
      }

      toast.success('Выполнение записано');
      setExecutionModal({ isOpen: false, detail: null, markInfo: null });
    } catch (error) {
      toast.error('Ошибка при сохранении');
    }
  };

  const handleAssembleSubmit = async (formData) => {
    const markId = assembleModal.mark.id;

    try {
      const response = await assembleMark(markId, {
        user_uuid: formData.workerUuid,
        quantity: formData.quantity,
        completion_date: formData.completionDate,
      });

      handleMarkUpdate(markId, {
        assembled_quantity: response.assembled_quantity,
        status: response.mark_status,
      });

      toast.success(response.message || 'Сборка записана');
      setAssembleModal({ isOpen: false, mark: null });
    } catch (error) {
      console.error('Ошибка при сборке:', error);
      throw error;
    }
  };

  const handleShipSubmit = async (formData) => {
    const mark = shipModal.mark;

    try {
      const response = await shipMark(mark.id, {
        user_uuid: formData.workerUuid,
        quantity: formData.quantity,
        completion_date: formData.completionDate,
      });

      handleMarkUpdate(mark.id, {
        shipped_quantity: response.shipped_quantity ?? mark.shipped_quantity + formData.quantity,
        status: response.mark_status,
      });

      toast.success(response.message || 'Отгрузка записана');
      setShipModal({ isOpen: false, mark: null });
    } catch (error) {
      console.error('Ошибка при отгрузке:', error);
      throw error;
    }
  };

  const handleRowClick = (e, callback) => {
    e.stopPropagation();
    callback();
  };

  if (!selectedKmd) return null;

  return (
    <div className="marks-section">
      {!marksLoading && marks.length === 0 && (
        <EmptyState
          type="marks"
          title="Марки отсутствуют"
          subtitle="Для данного КМД марки не найдены"
        />
      )}

      {marks.length > 0 && (
        <div className="marks-list">
          {marks.map((mark, index) => {
            const markStatus = getMarkStatus(mark);
            const isExpanded = expandedMarkId.includes(mark.id);
            const pagination = detailsPagination[mark.id];

            return (
              <React.Fragment key={mark.id}>
                <div
                  ref={index === marks.length - 1 ? lastElementRef : null}
                  className="mark-card"
                >
                  <div
                    className="mark-header"
                    onClick={() => toggleMark(mark.id)}
                  >
                    <div className="mark-info">
                      <span className="mark-title">{mark.title}</span>
                      <span className="mark-name">{mark.name}</span>

                      <div className="mark-info-divider" />

                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(markStatus) }}
                      >
                        {markStatus}
                      </span>

                      <div className="mark-info-divider" />

                      <div className="mark-info-item">
                        <span>{mark.quantity} шт.</span>
                      </div>
                      <div className="mark-info-item">
                        <span>Вес:</span>
                        <span>{mark.weight} кг</span>
                      </div>
                      <div className="mark-info-item">
                        <span>Общий вес:</span>
                        <span>{(mark.quantity * mark.weight).toFixed(1)} кг</span>
                      </div>

                      {mark.cooperation && (
                        <>
                          <div className="mark-info-divider" />
                          <div className="mark-info-item">
                            <span>Кооперация:</span>
                            <span>{mark.cooperation}</span>
                          </div>
                        </>
                      )}
                      {mark.mounting_part && (
                        <>
                          <div className="mark-info-divider" />
                          <div className="mark-info-item">
                            <span>Монтажная деталь:</span>
                            <span>{mark.mounting_part}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <svg
                      className={`arrow-icon ${isExpanded ? 'expanded' : ''}`}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {isExpanded && (
                    <div className="mark-details">
                      <div className="mark-actions-bar">
                        <div className="mark-counters">
                          <span className="mark-counter">
                            Собрано:{' '}
                            <strong>
                              {mark.assembled_quantity}/{mark.quantity}
                            </strong>
                          </span>
                          <span className="mark-counter">
                            Отгружено:{' '}
                            <strong>
                              {mark.shipped_quantity}/{mark.quantity}
                            </strong>
                          </span>
                        </div>
                        {canChanges && (
                          <div className="mark-action-buttons">
                            <button
                              className="execution-button"
                              onClick={(e) => handleRowClick(e, () => setAssembleModal({ isOpen: true, mark }))}
                              disabled={mark.assembled_quantity >= mark.quantity}
                            >
                              Выполнить
                            </button>
                            <button
                              className="ship-button"
                              onClick={(e) => handleRowClick(e, () => setShipModal({ isOpen: true, mark }))}
                              disabled={mark.shipped_quantity >= mark.quantity}
                            >
                              Отгрузить
                            </button>
                          </div>
                        )}
                      </div>

                      {detailsLoading[mark.id] ? (
                        <LoadingDots inline />
                      ) : (
                        <>
                          <div className="details-table-wrapper">
                            <table className="details-table">
                              <thead>
                                <tr>
                                  <th>№ детали</th>
                                  <th>Тип</th>
                                  <th>Размер</th>
                                  <th>Длина</th>
                                  <th>Ширина</th>
                                  <th>Вес</th>
                                  <th>Марка стали</th>
                                  <th>Кол-во</th>
                                  <th>Остаток</th>
                                  <th>Статус</th>
                                  <th>Операция</th>
                                  {canChanges && <th>Выполнение</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {markDetails[mark.id]?.map((detail) => (
                                  <tr key={detail.id}>
                                    <td>{detail.detail?.num_detail || '-'}</td>
                                    <td>{detail.detail?.type || '-'}</td>
                                    <td>{detail.detail?.size || '-'}</td>
                                    <td>{detail.detail?.length || '-'}</td>
                                    <td>{detail.detail?.width || '-'}</td>
                                    <td>{detail.detail?.weight || '-'}</td>
                                    <td>{detail.detail?.steel_grade || '-'}</td>
                                    <td>{detail.details_quantity || '-'}</td>
                                    <td>{detail.remaining_quantity ?? '-'}</td>
                                    <td>
                                      <span
                                        className="status-badge"
                                        style={{
                                          backgroundColor: getStatusColor(detail.status || calculateDetailStatus(detail.remaining_quantity, detail.details_quantity)),
                                        }}
                                      >
                                        {detail.status || calculateDetailStatus(detail.remaining_quantity, detail.details_quantity)}
                                      </span>
                                    </td>
                                    <td>{detail.operation || '-'}</td>
                                    {canChanges && (
                                      <td>
                                        <button
                                          className="execution-button"
                                          onClick={(e) => handleRowClick(e, () => handleOpenExecution(detail, mark))}
                                          disabled={detail.remaining_quantity === 0}
                                        >
                                          Выполнить
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {pagination && pagination.totalPages > 1 && (
                            <div
                              className="details-pagination"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="pagination-button"
                                onClick={() => handlePageChange(mark.id, pagination.page - 1)}
                                disabled={pagination.page <= 1}
                              >
                                ‹
                              </button>

                              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                  key={p}
                                  className={`pagination-button ${p === pagination.page ? 'active' : ''}`}
                                  onClick={() => handlePageChange(mark.id, p)}
                                >
                                  {p}
                                </button>
                              ))}

                              <button
                                className="pagination-button"
                                onClick={() => handlePageChange(mark.id, pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages}
                              >
                                ›
                              </button>

                              <span className="pagination-info">{pagination.totalItems} дет.</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {(index + 1) % 5 === 0 && index !== marks.length - 1 && <div className="marks-separator" />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {marksLoading && <LoadingDots inline />}

      <ExecutionModal
        isOpen={executionModal.isOpen}
        onClose={handleCloseExecution}
        detail={executionModal.detail}
        markInfo={executionModal.markInfo}
        onSubmit={handleExecutionSubmit}
      />

      <AssembleModal
        isOpen={assembleModal.isOpen}
        onClose={() => setAssembleModal({ isOpen: false, mark: null })}
        mark={assembleModal.mark}
        onSubmit={handleAssembleSubmit}
      />

      <ShipModal
        isOpen={shipModal.isOpen}
        onClose={() => setShipModal({ isOpen: false, mark: null })}
        mark={shipModal.mark}
        onSubmit={handleShipSubmit}
      />
    </div>
  );
};

export default MarksList;
