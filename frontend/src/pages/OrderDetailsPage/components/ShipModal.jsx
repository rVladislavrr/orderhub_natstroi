import { useState, useEffect } from 'react';
import { getWorkers } from '../../../api/workApi';

const ShipModal = ({ isOpen, onClose, mark, onSubmit }) => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    workerUuid: '',
    quantity: 0,
    completionDate: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');

  const remaining = mark ? mark.quantity - mark.shipped_quantity : 0;

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
    } catch {
      setError('Не удалось загрузить список исполнителей');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!formData.workerUuid) return setError('Выберите исполнителя');
    if (!formData.quantity || formData.quantity <= 0) return setError('Укажите количество больше 0');
    if (formData.quantity > remaining) return setError(`Количество не может превышать остаток (${remaining})`);

    setSaving(true);
    setError('');

    try {
      await onSubmit(formData);
    } catch {
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
          <h3>Отгрузка марки</h3>
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
              <span>Марка:</span>
              <strong>
                {mark?.title} {mark?.name}
              </strong>
            </div>
            <div className="info-row">
              <span>Отгружено:</span>
              <strong>
                {mark?.shipped_quantity}/{mark?.quantity} шт.
              </strong>
            </div>
            <div className="info-row">
              <span>Осталось отгрузить:</span>
              <strong>{remaining} шт.</strong>
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
                {workers.map((w) => (
                  <option
                    key={w.uuid}
                    value={w.uuid}
                  >
                    {w.lastname} {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Количество:</label>
              <input
                type="number"
                min="1"
                max={remaining}
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                placeholder={`Макс: ${remaining}`}
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <label>Дата отгрузки:</label>
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

export default ShipModal;
