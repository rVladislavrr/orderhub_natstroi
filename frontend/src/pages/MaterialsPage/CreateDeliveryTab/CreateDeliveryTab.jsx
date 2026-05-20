import { useState, useCallback, useEffect } from 'react';
import { createTruck, checkMetal, getProfileTypes, getProfileSizes, getProfileSteels } from '../../../api/deliveryApi';
import AutocompleteInput from '../AutoCompleteInput/AutoCompleteInput'
import './CreateDeliveryTab.css';
import { toast } from 'react-toastify';

const STORAGE_KEY = 'createDeliveryTab_draft';

const emptyItem = () => ({
  id: crypto.randomUUID(),
  profile_type: '',
  profile_size: '',
  steel_grade: '',
  total_weight: '',
  checkData: null,
  checkLoading: false,
  checkError: null,
  allocations: {},
});

const defaultForm = () => ({
  name: '',
  delivery_date: new Date().toISOString().slice(0, 10),
  note: '',
});

// Убираем runtime-поля перед сохранением
const serializeItems = (items) => items.map(({ checkData, checkLoading, checkError, ...rest }) => rest);

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveDraft = (form, items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, items: serializeItems(items) }));
  } catch {}
};

const clearDraft = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};

// Восстанавливаем runtime-поля после загрузки из localStorage
const restoreItems = (items) =>
  items.map((it) => ({
    ...emptyItem(),
    ...it,
  }));

export default function CreateDeliveryTab({ onCreated }) {
  const draft = loadDraft();

  const [form, setForm] = useState(draft?.form ?? defaultForm());
  const [items, setItems] = useState(draft?.items?.length ? restoreItems(draft.items) : [emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Сохраняем в localStorage при каждом изменении form или items
  useEffect(() => {
    saveDraft(form, items);
  }, [form, items]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (id) => setItems((p) => p.filter((it) => it.id !== id));

  const updateItem = (id, patch) => setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  // При смене типа — сбрасываем размер, марку, результаты check
  const handleTypeChange = (id, v) =>
    updateItem(id, {
      profile_type: v,
      profile_size: '',
      steel_grade: '',
      checkData: null,
      checkError: null,
      allocations: {},
    });

  // При смене размера — сбрасываем марку и результаты check
  const handleSizeChange = (id, v) =>
    updateItem(id, {
      profile_size: v,
      steel_grade: '',
      checkData: null,
      checkError: null,
      allocations: {},
    });

  // При смене марки — сбрасываем результаты check
  const handleSteelChange = (id, v) =>
    updateItem(id, {
      steel_grade: v,
      checkData: null,
      checkError: null,
      allocations: {},
    });

  const handleCheckKmd = useCallback(async (item) => {
    const { id, profile_type, profile_size, steel_grade } = item;
    if (!profile_type.trim() || !profile_size.trim() || !steel_grade.trim()) return;

    updateItem(id, { checkLoading: true, checkError: null, checkData: null, allocations: {} });
    try {
      const data = await checkMetal(profile_type.trim(), profile_size.trim(), steel_grade.trim());
      updateItem(id, { checkLoading: false, checkData: data });
    } catch (e) {
      updateItem(id, { checkLoading: false, checkError: e.message });
    }
  }, []); // eslint-disable-line

  const setAllocWeight = (itemId, kmd_uuid, val) => setItems((p) => p.map((it) => (it.id === itemId ? { ...it, allocations: { ...it.allocations, [kmd_uuid]: val } } : it)));

  const getUnallocated = (item) => {
    const total = parseFloat(item.total_weight) || 0;
    const allocated = Object.values(item.allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    return Math.max(0, total - allocated);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!form.name.trim()) return setSubmitError('Введите название поставки');
    if (!form.delivery_date) return setSubmitError('Укажите дату поставки');
    for (const it of items) {
      if (!it.profile_type.trim() || !it.profile_size.trim() || !it.steel_grade.trim()) return setSubmitError('Заполните тип, размер и марку стали для каждой позиции');
      if (!it.total_weight || parseFloat(it.total_weight) <= 0) return setSubmitError('Укажите вес для каждой позиции');
    }

    const payload = {
      name: form.name.trim(),
      delivery_date: form.delivery_date,
      note: form.note.trim(),
      items: items.map((it) => ({
        profile_type: it.profile_type.trim(),
        profile_size: it.profile_size.trim(),
        steel_grade: it.steel_grade.trim(),
        total_weight: parseFloat(it.total_weight),
        allocations: Object.entries(it.allocations)
          .filter(([, v]) => parseFloat(v) > 0)
          .map(([kmd_uuid, v]) => ({
            kmd_uuid,
            allocated_weight: parseFloat(v),
          })),
      })),
    };

    setSubmitting(true);
    try {
      await createTruck(payload);
      toast.success('Поставка создана');
      clearDraft();
      setForm(defaultForm());
      setItems([emptyItem()]);
      onCreated?.();
    } catch (e) {
      setSubmitError(e.response?.data?.detail ?? e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cd-tab">
      <section className="cd-section">
        <h2 className="cd-section-title">Информация о поставке</h2>
        <div className="cd-form-grid">
          <div className="cd-field">
            <label className="cd-label">Название *</label>
            <input
              className="cd-input"
              placeholder="Например: Балка 20, июнь 2026"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>
          <div className="cd-field">
            <label className="cd-label">Дата поставки *</label>
            <input
              className="cd-input"
              type="date"
              value={form.delivery_date}
              onChange={(e) => setField('delivery_date', e.target.value)}
            />
          </div>
          <div className="cd-field cd-field--full">
            <label className="cd-label">Примечание</label>
            <textarea
              className="cd-textarea"
              placeholder="Дополнительная информация..."
              rows={2}
              value={form.note}
              onChange={(e) => setField('note', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="cd-section">
        <div className="cd-section-head">
          <h2 className="cd-section-title">Позиции</h2>
          <button
            className="cd-add-item-btn"
            onClick={addItem}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line
                x1="12"
                y1="5"
                x2="12"
                y2="19"
              />
              <line
                x1="5"
                y1="12"
                x2="19"
                y2="12"
              />
            </svg>
            Добавить позицию
          </button>
        </div>

        <div className="cd-items-list">
          {items.map((item, idx) => (
            <ItemCard
              key={item.id}
              item={item}
              idx={idx}
              onTypeChange={(v) => handleTypeChange(item.id, v)}
              onSizeChange={(v) => handleSizeChange(item.id, v)}
              onSteelChange={(v) => handleSteelChange(item.id, v)}
              onWeightChange={(v) => updateItem(item.id, { total_weight: v })}
              onRemove={() => removeItem(item.id)}
              canRemove={items.length > 1}
              unallocated={getUnallocated(item)}
              onCheck={() => handleCheckKmd(item)}
              onAllocWeightChange={(kmd_uuid, val) => setAllocWeight(item.id, kmd_uuid, val)}
            />
          ))}
        </div>
      </section>

      <div className="cd-submit-bar">
        {submitError && <span className="cd-submit-error">{submitError}</span>}
        <button
          className="cd-submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Создаём...' : 'Создать поставку'}
        </button>
      </div>
    </div>
  );
}

function ItemCard({ item, idx, onTypeChange, onSizeChange, onSteelChange, onWeightChange, onRemove, canRemove, unallocated, onCheck, onAllocWeightChange }) {
  const { checkData, checkLoading, checkError, allocations } = item;
  const canCheck = item.profile_type.trim() && item.profile_size.trim() && item.steel_grade.trim();

  const fetchTypes = useCallback(async (search) => getProfileTypes(search), []);

  const fetchSizes = useCallback(
    async (search) => {
      if (!item.profile_type) return [];
      return getProfileSizes(item.profile_type, search);
    },
    [item.profile_type],
  );

  const fetchSteels = useCallback(async () => {
    if (!item.profile_type || !item.profile_size) return [];
    return getProfileSteels(item.profile_type, item.profile_size);
  }, [item.profile_type, item.profile_size]);

  return (
    <div className="cd-item-card">
      <div className="cd-item-header">
        <span className="cd-item-num">Позиция {idx + 1}</span>
        {unallocated > 0.01 && <span className="cd-item-unalloc">На склад: {unallocated.toLocaleString('ru-RU')} кг</span>}
        {canRemove && (
          <button
            className="cd-item-remove"
            onClick={onRemove}
            title="Удалить позицию"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              />
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="cd-item-fields">
        <div className="cd-field">
          <label className="cd-label">Тип профиля *</label>
          <AutocompleteInput
            value={item.profile_type}
            onChange={onTypeChange}
            fetchOptions={fetchTypes}
            placeholder="Балка, Швеллер..."
          />
        </div>

        <div className="cd-field">
          <label className="cd-label">Размер профиля *</label>
          <AutocompleteInput
            value={item.profile_size}
            onChange={onSizeChange}
            fetchOptions={fetchSizes}
            placeholder={item.profile_type ? '10П, 20...' : 'Сначала тип'}
            disabled={!item.profile_type}
          />
        </div>

        <div className="cd-field">
          <label className="cd-label">Марка стали *</label>
          <AutocompleteInput
            value={item.steel_grade}
            onChange={onSteelChange}
            fetchOptions={fetchSteels}
            placeholder={item.profile_size ? 'С245, С345...' : 'Сначала размер'}
            disabled={!item.profile_type || !item.profile_size}
          />
        </div>

        <div className="cd-field">
          <label className="cd-label">Общий вес, кг *</label>
          <input
            className="cd-input cd-input--num"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0"
            value={item.total_weight}
            onChange={(e) => onWeightChange(e.target.value)}
          />
        </div>
      </div>

      <div className="cd-check-bar">
        <button
          className="cd-check-btn"
          onClick={onCheck}
          disabled={!canCheck || checkLoading}
        >
          {checkLoading ? 'Ищем КМД...' : checkData ? '↻ Обновить КМД' : 'Найти КМД'}
        </button>
        {!canCheck && <span className="cd-check-hint">Заполните тип, размер и марку стали</span>}
        {checkData && (
          <span className="cd-stock-badge">
            На складе: <strong>{checkData.stock_weight?.toLocaleString('ru-RU')} кг</strong>
          </span>
        )}
      </div>

      {checkError && <div className="cd-check-error">{checkError}</div>}

      {checkData && (
        <div className="cd-kmd-section">
          {!checkData.orders?.length ? (
            <div className="cd-kmd-empty">Нет КМД с потребностью в этом металле — весь объём пойдёт на склад</div>
          ) : (
            <>
              <div className="cd-kmd-head">
                <span>КМД</span>
                <span className="cd-kmd-col-r">Потребность</span>
                <span className="cd-kmd-col-r">Распределено</span>
                <span className="cd-kmd-col-r">Дефицит</span>
                <span className="cd-kmd-col-r">Покрыто складом</span>
                <span className="cd-kmd-col-r">Реальный дефицит</span>
                <span className="cd-kmd-col-r">Добавить из поставки, кг</span>
              </div>
              {checkData.orders.map((o) => {
                const inputVal = allocations[o.kmd_uuid] ?? '';
                const inputNum = parseFloat(inputVal) || 0;
                const available = unallocated + (parseFloat(inputVal) || 0);
                const maxPossible = Math.min(o.real_deficit, available);
                const isOverLimit = inputNum > maxPossible;

                return (
                  <div
                    key={o.kmd_uuid}
                    className="cd-kmd-row"
                  >
                    <span className="cd-kmd-num">{o.kmd_num}</span>
                    <span className="cd-kmd-col-r">{o.plan_weight?.toLocaleString('ru-RU')}</span>
                    <span className="cd-kmd-col-r">{o.allocated_weight?.toLocaleString('ru-RU')}</span>
                    <span className={`cd-kmd-col-r ${o.deficit > 0 ? 'cd-deficit' : 'cd-ok'}`}>{o.deficit?.toLocaleString('ru-RU')}</span>
                    <span className="cd-kmd-col-r cd-covered">{o.covered_by_stock?.toLocaleString('ru-RU')}</span>
                    <span className={`cd-kmd-col-r ${o.real_deficit > 0 ? 'cd-deficit' : 'cd-ok'}`}>{o.real_deficit?.toLocaleString('ru-RU')}</span>

                    <div className="cd-kmd-alloc-cell">
                      <div className="cd-alloc-input-wrap">
                        <input
                          className={`cd-alloc-input ${isOverLimit ? 'cd-alloc-input--error' : ''}`}
                          type="number"
                          min="0"
                          step="0.01"
                          max={maxPossible}
                          placeholder="0"
                          value={inputVal}
                          onChange={(e) => onAllocWeightChange(o.kmd_uuid, e.target.value)}
                        />
                        {inputVal && parseFloat(inputVal) > 0 && (
                          <button
                            className="cd-alloc-clear-btn"
                            onClick={() => onAllocWeightChange(o.kmd_uuid, '')}
                            title="Сбросить значение"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeLinecap="round"
                            >
                              <line
                                x1="18"
                                y1="6"
                                x2="6"
                                y2="18"
                              />
                              <line
                                x1="6"
                                y1="6"
                                x2="18"
                                y2="18"
                              />
                            </svg>
                          </button>
                        )}
                      </div>

                      {available > 0 && inputNum < Math.min(o.real_deficit, available) && (
                        <button
                          className={`cd-alloc-fill-btn ${o.real_deficit > available ? 'cd-alloc-fill-btn--partial' : ''}`}
                          title={o.real_deficit > available ? `Не хватает. Доступно: ${available.toLocaleString('ru-RU')} кг` : `Заполнить дефицит: ${o.real_deficit?.toLocaleString('ru-RU')} кг`}
                          onClick={() => {
                            const valueToSet = Math.min(o.real_deficit, available);
                            if (valueToSet > 0) {
                              onAllocWeightChange(o.kmd_uuid, String(Math.round(valueToSet * 100) / 100));
                            }
                          }}
                        >
                          {o.real_deficit > available ? `↑ ${available.toLocaleString('ru-RU')} кг` : '↑ дефицит'}
                        </button>
                      )}

                      {isOverLimit && <span className="cd-alloc-hint">Макс: {maxPossible.toLocaleString('ru-RU')} кг</span>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
