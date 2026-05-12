import React, { useState } from 'react';
import { getMarkDetails } from '../../../api/ordersApi';
import { getStatusColor } from '../../../utils/statusUtils';
import { toast } from 'react-toastify';
import LoadingDots from '../../../components/LoadingDots/LoadingDots';
import EmptyState from '../../../components/EmptyState/EmptyState';
import ExecutionModal from './ExecutionModal';
import { createWorkExecution } from '../../../api/workApi';

const MarksList = ({ marks, selectedKmd, marksLoading, lastElementRef }) => {
  const [expandedMarkId, setExpandedMarkId] = useState([]);
  const [markDetails, setMarkDetails] = useState({});
  const [detailsLoading, setDetailsLoading] = useState({});
  const [executionModal, setExecutionModal] = useState({
    isOpen: false,
    detail: null,
    markInfo: null,
  });

  const toggleMark = async (markId) => {
    const isExpanded = expandedMarkId.includes(markId);

    if (isExpanded) {
      setExpandedMarkId(expandedMarkId.filter((id) => id !== markId));
    } else {
      setExpandedMarkId([...expandedMarkId, markId]);

      if (!markDetails[markId]) {
        setDetailsLoading((prev) => ({ ...prev, [markId]: true }));
        try {
          const details = await getMarkDetails(markId);
          setMarkDetails((prev) => ({ ...prev, [markId]: details }));
        } catch (error) {
          console.error('Ошибка загрузки деталей', error);
          toast.error('Ошибка при загрузке деталей');
        } finally {
          setDetailsLoading((prev) => ({ ...prev, [markId]: false }));
        }
      }
    }
  };

  const calculateStatus = (remainingQuantity, totalQuantity) => {
    if (remainingQuantity === 0) return 'Завершен';
    if (remainingQuantity < totalQuantity) return 'В работе';
    return 'Новый';
  };

  const handleOpenExecution = (detail, mark) => {
    setExecutionModal({
      isOpen: true,
      detail,
      markInfo: mark,
    });
  };

  const handleCloseExecution = () => {
    setExecutionModal({ isOpen: false, detail: null, markInfo: null });
  };

  const handleExecutionSubmit = async (formData) => {
    try {
      const newRemaining = executionModal.detail.remaining_quantity - formData.quantity;
      const totalQuantity = executionModal.detail.details_quantity;

      const newStatus = calculateStatus(newRemaining, totalQuantity);

      await createWorkExecution({
        work_id: 0,
        rel_markadel_id: executionModal.detail.id,
        user_uuid: formData.workerUuid,
        quantity: formData.quantity,
        completion_date: formData.completionDate,
        remaining_quantity: newRemaining,
        detail_status: newStatus,
        message: `Выполнено ${formData.quantity} шт.`,
      });

      setMarkDetails((prev) => {
        const markId = executionModal.markInfo?.id;
        const details = prev[markId]?.details || [];

        const updatedDetails = details.map((d) => {
          if (d.id === executionModal.detail.id) {
            return {
              ...d,
              remaining_quantity: newRemaining,
              status: newStatus,
            };
          }
          return d;
        });

        return {
          ...prev,
          [markId]: {
            ...prev[markId],
            details: updatedDetails,
          },
        };
      });

      toast.success('Выполнение записано');
      setExecutionModal({ isOpen: false, detail: null, markInfo: null });
    } catch (error) {
      console.error('Ошибка сохранения выполнения:', error);
      toast.error('Ошибка при сохранении');
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
          {marks.map((mark, index) => (
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
                    <div className="mark-info-item">
                      <span></span>
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
                    className={`arrow-icon ${expandedMarkId.includes(mark.id) ? 'expanded' : ''}`}
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

                {expandedMarkId.includes(mark.id) && (
                  <div className="mark-details">
                    {detailsLoading[mark.id] ? (
                      <LoadingDots inline />
                    ) : (
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
                              <th>Выполнение</th>
                            </tr>
                          </thead>
                          <tbody>
                            {markDetails[mark.id]?.details?.map((detail) => (
                              <tr key={detail.id}>
                                <td>{detail.detail?.num_detail || '-'}</td>
                                <td>{detail.detail?.type || '-'}</td>
                                <td>{detail.detail?.size || '-'}</td>
                                <td>{detail.detail?.length || '-'}</td>
                                <td>{detail.detail?.width || '-'}</td>
                                <td>{detail.detail?.weight || '-'}</td>
                                <td>{detail.detail?.steel_grade || '-'}</td>
                                <td>{detail.details_quantity || '-'}</td>
                                <td>{detail.remaining_quantity || '-'}</td>
                                <td>
                                  <span
                                    className="status-badge"
                                    style={{ backgroundColor: getStatusColor(detail.status || calculateStatus(detail.remaining_quantity, detail.details_quantity)) }}
                                  >
                                    {detail.status || calculateStatus(detail.remaining_quantity, detail.details_quantity)}
                                  </span>
                                </td>
                                <td>{detail.detail?.operation || '-'}</td>
                                <td>
                                  <button
                                    className="execution-button"
                                    onClick={(e) => handleRowClick(e, () => handleOpenExecution(detail, mark))}
                                    disabled={detail.remaining_quantity === 0}
                                  >
                                    Выполнить
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {(index + 1) % 5 === 0 && index !== marks.length - 1 && <div className="marks-separator" />}
            </React.Fragment>
          ))}
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
    </div>
  );
};

export default MarksList;
