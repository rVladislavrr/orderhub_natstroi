import './OrdersPage.css';
import useInfiniteOrders from '../../hooks/useInfiniteOrders';
import LoadingDots from '../../components/LoadingDots/LoadingDots';
import OrderCard from '../../components/OrderCard/OrderCard';
import { Link } from 'react-router-dom';

const OrdersPage = () => {
  const { orders, loading, lastElementRef, hasMore, error, } = useInfiniteOrders();

  return (
    <div className="orders-page">
      <div className="orders-actions">
        <p>фильтрация</p>
        <p>сортировка</p>
        <Link to={`/create-order`}>
          <button className="create-order">Добавить заказ</button>
        </Link>
      </div>

      {!loading && error ? <p className="nan-orders">Что-то пошло не так O_o</p> : orders.length === 0 && !loading && !error ? <p className="nan-orders">Заказов пока нет</p> : null}

      {orders.map((order, index) => {
        const isLastElement = index === orders.length - 1;

        return (
          <OrderCard
            key={order.uuid}
            order={order}
            isLastElement={isLastElement}
            lastElementRef={lastElementRef}
          />
        );
      })}

      {loading && <LoadingDots />}

      {!loading && hasMore && orders.length > 0 && (
        <div
          ref={lastElementRef}
          style={{ height: '10px' }}
        />
      )}
    </div>
  );
};

export default OrdersPage;
