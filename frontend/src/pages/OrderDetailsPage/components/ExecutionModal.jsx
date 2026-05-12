import { useState, useEffect } from 'react';
import { getWorkers } from '../../../api/workApi';

const ExecutionModal = ({ isOpen, onClose, detail, markInfo, onSubmit }) => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    workerUuid: '',
    quantity: 0,
    completionDate: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadWorkers();
      setFormData({
        workerUuid: '',
        quantity: 0,
        completionDate: new Date().toISOString().split('T')[0],
      });
      setError('');
      setSaving(false);
    }
  }, [isOpen]);

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const data = await getWorkers(1, 100);
      setWorkers(data.workers || []);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      setError('Не удалось загрузить список исполнителей');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (!formData.workerUuid) {
      setError('Выберите исполнителя');
      return;
    }

    if (!formData.quantity || formData.quantity <= 0) {
      setError('Укажите количество больше 0');
      return;
    }

    if (formData.quantity > detail.remaining_quantity) {
      setError(`Количество не может превышать остаток (${detail.remaining_quantity})`);
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSubmit({
        ...formData,
        detailId: detail.id,
        relMarkadelId: detail.id,
      });
    } catch (error) {
      setError('Ошибка при сохранении');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Выполнение детали</h3>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-info">
            <div className="info-row">
              <span>Деталь:</span>
              <strong>{detail?.detail?.num_detail || '-'}</strong>
            </div>
            <div className="info-row">
              <span>Марка:</span>
              <strong>
                {markInfo?.title} {markInfo?.name}
              </strong>
            </div>
            <div className="info-row">
              <span>Остаток:</span>
              <strong>{detail?.remaining_quantity || 0} шт.</strong>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Исполнитель:</label>
              <select
                value={formData.workerUuid}
                onChange={(e) => setFormData({ ...formData, workerUuid: e.target.value })}
                disabled={loading || saving}
              >
                <option value="">Выберите исполнителя</option>
                {workers.map((worker) => (
                  <option
                    key={worker.uuid}
                    value={worker.uuid}
                  >
                    {worker.lastname} {worker.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Количество:</label>
              <input
                type="number"
                min="1"
                max={detail?.remaining_quantity || 0}
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                placeholder={`Макс: ${detail?.remaining_quantity || 0}`}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>Дата выполнения:</label>
              <input
                type="date"
                value={formData.completionDate}
                onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
                disabled={saving}
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExecutionModal;
