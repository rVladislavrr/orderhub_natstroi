import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrderMarks } from '../api/ordersApi';
import { toast } from 'react-toastify';

const useInfiniteMarks = (kmdUuid, sortBy = 'title', orderBy = 'asc', filters = {}) => {
  const [marks, setMarks] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [initLoadDone, setInitLoadDone] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  const observerRef = useRef();
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    setMarks([]);
    setPage(1);
    setHasMore(true);
    setInitLoadDone(false);
    setError(false);
    setTotalItems(0);
  }, [kmdUuid, sortBy, orderBy, filtersKey]);

  const fetchMarks = useCallback(async () => {
    if (loading || !hasMore || !kmdUuid) return;

    setLoading(true);

    try {
      const data = await getOrderMarks(kmdUuid, {
        page: page,
        limit: 5,
        sort_by: sortBy,
        order_by: orderBy,
        filter_name: filters.filter_name || null,
        filter_cooperation: filters.filter_cooperation || null,
        filter_mounting_part: filters.filter_mounting_part || null,
        filter_status: filters.filter_status || null,
      });

      setMarks((prev) => [...prev, ...(data.marks || [])]);
      setTotalItems(data.pagination?.total_items || 0);

      const hasMorePages = data.pagination?.has_more || false;
      setHasMore(hasMorePages);

      if (hasMorePages) {
        setPage((prev) => prev + 1);
      }
    } catch (error) {
      setError(true);
      toast.error('Не удалось загрузить марки');
      console.error('Ошибка загрузки марок:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, kmdUuid, sortBy, orderBy, filters]);

  useEffect(() => {
    if (!initLoadDone && !loading && kmdUuid) {
      fetchMarks();
      setInitLoadDone(true);
    }
  }, [fetchMarks, initLoadDone, loading, kmdUuid]);

  const lastElementRef = useCallback(
    (node) => {
      if (loading) return;

      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading && kmdUuid) {
            fetchMarks();
          }
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 1,
        },
      );

      if (node) observerRef.current.observe(node);
    },
    [fetchMarks, hasMore, loading, kmdUuid],
  );

  return {
    marks,
    loading,
    lastElementRef,
    hasMore,
    error,
    totalItems,
    resetMarks: () => {
      setMarks([]);
      setPage(1);
      setHasMore(true);
      setInitLoadDone(false);
      setTotalItems(0);
    },
  };
};

export default useInfiniteMarks;
