import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrders } from '../api/ordersApi';
import { toast } from 'react-toastify';

const useInfiniteOrders = () => {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [initLoadDone, setInitLoadDone] = useState(false);

  const observer = useRef();

  const fetchOrders = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);

    try {
      const data = await getOrders(page, 5);
      setOrders((prev) => [...prev, ...data.orders]);
      setHasMore(data.pagination.has_more);
      setPage((prev) => prev + 1);
    } catch {
      setError(true);
      toast.error('Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page]);

  useEffect(() => {
    if (!initLoadDone && !loading) {
      fetchOrders();
      setInitLoadDone(true);
    }
  }, [fetchOrders, initLoadDone, loading]);

  const lastElementRef = useCallback(
    (node) => {
      if (loading) return;

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            fetchOrders();
          }
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 1,
        },
      );

      if (node) observer.current.observe(node);
    },
    [fetchOrders, hasMore, loading],
  );

  return { orders, loading, lastElementRef, hasMore, error };
};

export default useInfiniteOrders;
