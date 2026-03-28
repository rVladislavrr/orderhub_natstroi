import React, { useState } from 'react';
import { getMarkDetails } from '../../../api/ordersApi';
import { getStatusColor } from '../../../utils/statusUtils';
import { toast } from 'react-toastify';
import LoadingDots from '../../../components/LoadingDots/LoadingDots';

const MarksList = ({ marks, selectedKmd, marksLoading }) => {
  const [expandedMarkId, setExpandedMarkId] = useState(null);
  const [markDetails, setMarkDetails] = useState({});
  const [detailsLoading, setDetailsLoading] = useState({});

  const toggleMark = async (markId) => {
    if (expandedMarkId === markId) {
      setExpandedMarkId(null);
    } else {
      setExpandedMarkId(markId);
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

  if (!selectedKmd) return null;

  return (
    <div className="marks-section">
      {!marksLoading && marks.length === 0 && <p className="no-marks">Нет марок для этого КМД</p>}

      {!marksLoading && marks.length > 0 && (
        <div className="marks-list">
          {marks.map((mark) => (
            <div
              key={mark.id}
              className="mark-card"
              onClick={() => toggleMark(mark.id)}
            >
              <div className="mark-header">
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

                  {mark.cooperation && (
                    <>
                      <div className="mark-info-divider" />
                      <div className="mark-info-item">
                        <span>Кооперация:</span>
                        <span>{mark.cooperation}</span>
                      </div>
                    </>
                  )}
                </div>

                <svg
                  className="arrow-icon"
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

              {expandedMarkId === mark.id && (
                <div className="mark-details">
                  {detailsLoading[mark.id] ? (
                    <LoadingDots />
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
                                  style={{ backgroundColor: getStatusColor(detail.status) }}
                                >
                                  {detail.status}
                                </span>
                              </td>
                              <td>{detail.detail?.operation || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarksList;
