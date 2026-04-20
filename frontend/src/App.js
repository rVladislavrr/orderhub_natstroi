import { Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';
import OrdersPage from './pages/OrdersPage/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage/OrderDetailsPage';
import CreateOrderPage from './pages/CreateOrderPage/CreateOrderPage';
import { ToastContainer } from 'react-toastify';
import HomePage from './pages/HomePage/HomePage';
import QueuePrintpage from './pages/QueuePrintPage/QueuePrintPage';

function App() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  return (
    <>
      {!isHomePage && <Header />}
      <Routes>
        <Route
          path=""
          element={<HomePage />}
        />
        <Route
          path="/orders"
          element={<OrdersPage />}
        />
        <Route
          path="/create-order"
          element={<CreateOrderPage />}
        />
        <Route
          path="/orders/:orderNum"
          element={<OrderDetailsPage />}
        />
        <Route
          path="/print-queue"
          element={<QueuePrintpage />}
        />
      </Routes>
      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </>
  );
}

export default App;
