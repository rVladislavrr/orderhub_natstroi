import { useState, useCallback, useRef } from 'react';
import { api } from '../../../../api/ordersApi';
import { getWorkers } from '../../../../api/workApi';
import { getStatusColor } from '../../../../utils/statusUtils';
import EmptyState from '../../../../components/EmptyState/EmptyState';
import './DetailSearch.css';
import { toast } from 'react-toastify';

const normalizeDetailNum = (val) => {
  const cleaned = val
    .trim()
    .toLowerCase()
    .replace(/^дет[\s.]*/, '');
  return `Дет.${cleaned}`;
};

const AutocompleteInput = ({ value, onChange, fetchOptions, placeholder, disabled, onSelect }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const load = useCallback(
    async (raw) => {
      setLoading(true);
      try {
        const list = await fetchOptions(raw.trim());
        setSuggestions(list ?? []);
        setOpen((list?.length ?? 0) > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [fetchOptions],
  );

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val), 300);
  };

  const handleFocus = () => {
    if (!disabled) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => load(value ?? ''), 100);
    }
  };

  const handleSelect = (label) => {
    onChange(label);
    setSuggestions([]);
    setOpen(false);
    onSelect?.(label);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setOpen(false);
      onSelect?.(value);
    }
    if (e.key === 'Escape') setOpen(false);
  };

  const handleBlur = (e) => {
    if (!wrapperRef.current?.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <div
      className="ds-autocomplete"
      ref={wrapperRef}
      onBlur={handleBlur}
    >
      <input
        className="ds-input"
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {loading && <div className="ds-autocomplete__loading">Поиск...</div>}
      {open && suggestions.length > 0 && (
        <div className="ds-autocomplete__dropdown">
          {suggestions.map((label, idx) => (
            <button
              key={idx}
              className="ds-autocomplete__option"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(label);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const DetailSearch = ({ selectedKmd, canChanges }) => {
  const [numDetail, setNumDetail] = useState('');
  const [queNum, setQueNum] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [totalDone, setTotalDone] = useState('');
  const [distribution, setDistribution] = useState({});

  const [workerUuid, setWorkerUuid] = useState('');
  const [workerError, setWorkerError] = useState(false);
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [workers, setWorkers] = useState([]);
  const [workersLoaded, setWorkersLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const fetchDetailSuggestions = useCallback(
    async (search) => {
      if (!selectedKmd?.uuid) return [];
      const normalized = search ? normalizeDetailNum(search) : '';
      const response = await api.get(`/kmd/${selectedKmd.uuid}/details/search`, {
        params: { search: normalized },
      });
      const list = response.data?.suggestions ?? response.data ?? [];
      return list.map((item) => (typeof item === 'string' ? item : (item.num_detail ?? String(item))));
    },
    [selectedKmd?.uuid],
  );

  const fetchQueueSuggestions = useCallback(
    async (search) => {
      if (!selectedKmd?.uuid) return [];
      const response = await api.get(`/kmd/${selectedKmd.uuid}/queues`);
      const list = response.data?.queues ?? response.data ?? [];
      const mapped = list.map((item) => (typeof item === 'string' ? item : (item.que_num ?? item.name ?? String(item))));
      if (!search) return mapped;
      return mapped.filter((s) => s.toLowerCase().includes(search.toLowerCase()));
    },
    [selectedKmd?.uuid],
  );

  const loadWorkers = async () => {
    if (workersLoaded) return;
    try {
      const data = await getWorkers(1, 100);
      setWorkers(data.workers || []);
      setWorkersLoaded(true);
    } catch (e) {
      console.error('Ошибка загрузки исполнителей', e);
    }
  };

  const doSearch = async (rawDetail, rawQue) => {
    const raw = (rawDetail ?? numDetail).trim();
    if (!raw) {
      setSearchError('Введите номер детали');
      return;
    }

    const normalized = normalizeDetailNum(raw);
    const que = (rawQue ?? queNum).trim();

    setSearchError('');
    setSaveSuccess('');
    setSaveError('');
    setHasSearched(false);
    setSearching(true);

    try {
      const response = await api.get(`/kmd/${selectedKmd.uuid}/detail-search`, {
        params: {
          num_detail: normalized,
          ...(que ? { que_num: que } : {}),
        },
      });

      setSearchResult(response.data);
      setHasSearched(true);

      const initDist = {};
      response.data.items?.forEach((item) => {
        initDist[item.rel_markadel_id] = 0;
      });
      setDistribution(initDist);
      setTotalDone('');

      await loadWorkers();
    } catch (e) {
      setHasSearched(true);
      setSearchError('Деталь не найдена или произошла ошибка запроса');
      setSearchResult(null);
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleAutoDistribute = () => {
    if (!searchResult || !totalDone) {
      setSaveError('Сначала укажите количество выполненных деталей');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }
    let toDistribute = parseInt(totalDone) || 0;
    if (toDistribute <= 0) {
      setSaveError('Количество выполненных деталей должно быть больше 0');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }
    const newDist = {};
    for (const item of searchResult.items) {
      if (toDistribute <= 0) {
        newDist[item.rel_markadel_id] = 0;
        continue;
      }
      const canTake = Math.min(item.remaining_quantity, toDistribute);
      newDist[item.rel_markadel_id] = canTake;
      toDistribute -= canTake;
    }
    setDistribution(newDist);
  };

  const handleFillAll = () => {
    const totalRemaining = searchResult?.total_remaining ?? 0;
    setTotalDone(String(totalRemaining));
  };

  const handleDistributionChange = (relId, value) => {
    const totalDoneNum = parseInt(totalDone);
    if (!totalDone || totalDoneNum <= 0) {
      setSaveError('Сначала укажите количество выполненных деталей');
      setTimeout(() => setSaveError(''), 3000);
      return;
    }
    const parsed = parseInt(value) || 0;
    setDistribution((prev) => ({ ...prev, [relId]: parsed < 0 ? 0 : parsed }));
  };

  const totalDistributed = Object.values(distribution).reduce((sum, v) => sum + (parseInt(v) || 0), 0);

  const calcStatus = (remaining, total) => {
    if (remaining === 0) return 'Завершен';
    if (remaining < total) return 'В работе';
    return 'Новый';
  };

  const handleSubmit = async () => {
    if (!workerUuid) {
      setWorkerError(true);
      return;
    }

    const items = Object.entries(distribution)
      .filter(([, qty]) => parseInt(qty) > 0)
      .map(([relId, qty]) => ({
        rel_markadel_id: parseInt(relId),
        quantity: parseInt(qty),
      }));

    if (items.length === 0) {
      setSaveError('Нет деталей для сохранения');
      return;
    }

    for (const it of items) {
      const found = searchResult.items.find((i) => i.rel_markadel_id === it.rel_markadel_id);
      if (found && it.quantity > found.remaining_quantity) {
        setSaveError(`Превышен остаток для марки ${found.mark_title} (макс. ${found.remaining_quantity})`);
        return;
      }
    }

    setSaveError('');
    setSaving(true);

    try {
      await api.post('/work/bulk', {
        user_uuid: workerUuid,
        completion_date: completionDate,
        items,
      });

      const count = items.length;
      toast.success(`Сохранено: ${totalDistributed} шт. по ${count} марк${count === 1 ? 'е' : 'ам'}`);

      setSearchResult((prev) => {
        const newTotalRemaining = prev.total_remaining - totalDistributed;
        const newItems = prev.items.map((i) => {
          const done = parseInt(distribution[i.rel_markadel_id]) || 0;
          if (!done) return i;
          const newRemaining = Math.max(0, i.remaining_quantity - done);
          const newStatus = calcStatus(newRemaining, i.detail_quantity);
          return { ...i, remaining_quantity: newRemaining, status: newStatus };
        });
        return { ...prev, total_remaining: newTotalRemaining, items: newItems };
      });

      setDistribution({});
      setTotalDone('');
    } catch (e) {
      setSaveError('Ошибка при сохранении');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const previewNormalized = numDetail.trim() ? normalizeDetailNum(numDetail.trim()) : null;
  const showHint = previewNormalized && numDetail.trim().toLowerCase() !== previewNormalized.toLowerCase();
  const isTotalDoneValid = totalDone && parseInt(totalDone) > 0;

  return (
    <div className="ds-tab">
      <section className="ds-section">
        <h2 className="ds-section-title">Поиск детали</h2>
        <div className="ds-search-grid">
          <div className="ds-field">
            <label className="ds-label">Номер детали *</label>
            <AutocompleteInput
              value={numDetail}
              onChange={setNumDetail}
              fetchOptions={fetchDetailSuggestions}
              placeholder="дет.1000 или 1000"
              onSelect={(val) => doSearch(val, queNum)}
            />
            <span
              className="ds-input-hint"
              style={{ visibility: showHint ? 'visible' : 'hidden' }}
            >
              Будет искать: <strong>{previewNormalized}</strong>
            </span>
          </div>

          <div className="ds-field">
            <label className="ds-label">№ очереди</label>
            <AutocompleteInput
              value={queNum}
              onChange={setQueNum}
              fetchOptions={fetchQueueSuggestions}
              placeholder="Все"
            />
          </div>

          <div className="ds-field ds-field--action">
            <button
              className="ds-search-btn"
              onClick={() => doSearch()}
              disabled={searching}
            >
              {searching ? 'Поиск...' : 'Найти'}
            </button>
          </div>
        </div>

        {searchError && <div className="ds-check-error">{searchError}</div>}
      </section>

      {hasSearched && !searchError && searchResult?.items?.length === 0 && !searching && (
        <EmptyState
          type="marks"
          title="Ничего не найдено"
          subtitle={`Деталь «${searchResult.num_detail}» не найдена ни в одной марке этого КМД`}
        />
      )}

      {searchResult && searchResult.items?.length > 0 && (
        <div className={`ds-results-wrapper ${searching ? 'ds-results-wrapper--loading' : ''}`}>
          {searching && <div className="ds-loading-overlay">Загрузка...</div>}

          <>
            <section className="ds-section">
              <div className="ds-summary-row">
                <div className="ds-summary-item">
                  <span className="ds-label">Деталь</span>
                  <span className="ds-summary-value">{searchResult.num_detail}</span>
                </div>
                {searchResult.que_num && (
                  <div className="ds-summary-item">
                    <span className="ds-label">Очередь</span>
                    <span className="ds-summary-value">{searchResult.que_num}</span>
                  </div>
                )}
                <div className="ds-summary-item">
                  <span className="ds-label">Остаток по всем маркам</span>
                  <span className="ds-summary-value ds-summary-value--accent">{searchResult.total_remaining} шт.</span>
                </div>
                {totalDistributed > 0 && (
                  <div className="ds-summary-item">
                    <span className="ds-label">Распределено</span>
                    <span className={`ds-summary-value ${totalDone && totalDistributed === parseInt(totalDone) ? 'ds-summary-value--ok' : 'ds-summary-value--partial'}`}>
                      {totalDistributed}
                      {totalDone ? ` / ${totalDone}` : ''} шт.
                    </span>
                  </div>
                )}
              </div>
            </section>

            {canChanges && (
              <section className="ds-section">
                <h2 className="ds-section-title">Распределение</h2>

                <div className="ds-dist-bar">
                  <div className="ds-field">
                    <label className="ds-label">Выполнено деталей</label>
                    <div className="ds-dist-inputs">
                      <input
                        className="ds-input ds-input--qty"
                        type="number"
                        min="0"
                        value={totalDone}
                        onChange={(e) => setTotalDone(e.target.value)}
                        placeholder="Кол-во"
                      />
                      <button
                        className="ds-auto-btn"
                        onClick={handleAutoDistribute}
                        disabled={!isTotalDoneValid}
                        title="Распределить автоматически по маркам сверху вниз"
                      >
                        Авто по порядку
                      </button>
                      <button
                        className="ds-fill-btn"
                        onClick={handleFillAll}
                        title="Подставить весь остаток"
                      >
                        Весь остаток
                      </button>
                    </div>
                  </div>
                </div>

                <div className="ds-kmd-section">
                  <div className="ds-kmd-head">
                    <span>Марка</span>
                    <span>Название</span>
                    <span className="ds-col-r">Кол-во марки</span>
                    <span className="ds-col-r">Деталей</span>
                    <span className="ds-col-r">Остаток</span>
                    <span className="ds-col-r">Очередь</span>
                    <span className="ds-col-r">Статус</span>
                    <span className="ds-col-r">Распределить, шт.</span>
                  </div>

                  {searchResult.items.map((item) => {
                    const qty = distribution[item.rel_markadel_id] || 0;
                    const isOver = qty > item.remaining_quantity;

                    return (
                      <div
                        key={item.rel_markadel_id}
                        className={`ds-kmd-row ${qty > 0 ? (isOver ? 'ds-kmd-row--error' : 'ds-kmd-row--filled') : ''}`}
                      >
                        <span className="ds-kmd-title">{item.mark_title}</span>
                        <span className="ds-kmd-name">{item.mark_name}</span>
                        <span className="ds-col-r">{item.mark_quantity}</span>
                        <span className="ds-col-r">{item.detail_quantity}</span>
                        <span className={`ds-col-r ${item.remaining_quantity === 0 ? 'ds-zero' : ''}`}>{item.remaining_quantity} шт.</span>
                        <span className="ds-col-r ds-col-queue">{item.que_num || '—'}</span>
                        <span className="ds-col-r">
                          <span
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(item.status) }}
                          >
                            {item.status}
                          </span>
                        </span>

                        <div className="ds-alloc-cell">
                          {item.remaining_quantity > 0 ? (
                            <>
                              <div className="ds-alloc-input-wrap">
                                <input
                                  className={`ds-alloc-input ${isOver ? 'ds-alloc-input--error' : ''}`}
                                  type="number"
                                  min="0"
                                  max={item.remaining_quantity}
                                  value={qty || ''}
                                  onChange={(e) => handleDistributionChange(item.rel_markadel_id, e.target.value)}
                                  placeholder="0"
                                  disabled={!isTotalDoneValid}
                                />
                                {qty > 0 && (
                                  <button
                                    className="ds-alloc-clear-btn"
                                    onClick={() => handleDistributionChange(item.rel_markadel_id, 0)}
                                    title="Сбросить"
                                    disabled={!isTotalDoneValid}
                                  >
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="3"
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
                              {isOver && <span className="ds-alloc-hint">Макс: {item.remaining_quantity}</span>}
                            </>
                          ) : (
                            <span className="ds-zero">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {!canChanges && (
              <section className="ds-section">
                <div className="ds-kmd-section">
                  <div className="ds-kmd-head ds-kmd-head--readonly">
                    <span>Марка</span>
                    <span>Название</span>
                    <span className="ds-col-r">Кол-во марки</span>
                    <span className="ds-col-r">Деталей</span>
                    <span className="ds-col-r">Остаток</span>
                    <span className="ds-col-r">Очередь</span>
                    <span className="ds-col-r">Статус</span>
                  </div>
                  {searchResult.items.map((item) => (
                    <div
                      key={item.rel_markadel_id}
                      className="ds-kmd-row ds-kmd-row--readonly"
                    >
                      <span className="ds-kmd-title">{item.mark_title}</span>
                      <span className="ds-kmd-name">{item.mark_name}</span>
                      <span className="ds-col-r">{item.mark_quantity}</span>
                      <span className="ds-col-r">{item.detail_quantity}</span>
                      <span className={`ds-col-r ${item.remaining_quantity === 0 ? 'ds-zero' : ''}`}>{item.remaining_quantity} шт.</span>
                      <span className="ds-col-r ds-col-queue">{item.que_num || '—'}</span>
                      <span className="ds-col-r">
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(item.status) }}
                        >
                          {item.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {canChanges && (
              <div className="ds-submit-bar">
                <div className="ds-submit-fields">
                  <div className="ds-field">
                    <label className="ds-label">Исполнитель *</label>
                    <select
                      className={`ds-input ds-select ${workerError ? 'ds-input--error' : ''}`}
                      value={workerUuid}
                      onChange={(e) => {
                        setWorkerUuid(e.target.value);
                        setWorkerError(false);
                      }}
                      disabled={saving}
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
                    {workerError && <span className="ds-field-error">Выберите исполнителя</span>}
                  </div>
                  <div className="ds-field">
                    <label className="ds-label">Дата выполнения *</label>
                    <input
                      className="ds-input"
                      type="date"
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="ds-submit-actions">
                  {saveError && <span className="ds-submit-error">{saveError}</span>}
                  {saveSuccess && <span className="ds-submit-ok">{saveSuccess}</span>}
                  <button
                    className="ds-submit-btn"
                    onClick={handleSubmit}
                    disabled={saving || totalDistributed === 0}
                  >
                    {saving ? 'Сохранение...' : `Сохранить${totalDistributed > 0 ? ` (${totalDistributed} шт.)` : ''}`}
                  </button>
                </div>
              </div>
            )}
          </>
        </div>
      )}
    </div>
  );
};

export default DetailSearch;
