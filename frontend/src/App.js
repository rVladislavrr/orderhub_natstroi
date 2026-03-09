import { Route, Routes } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';
import OrdersPage from './pages/OrdersPage/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage/OrderDetailsPage';
import CreateOrderPage from './pages/CreateOrderPage/CreateOrderPage';
import { ToastContainer } from 'react-toastify';

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route
          path="/"
          element={<OrdersPage />}
        />

        <Route
          path="/create-order"
          element={<CreateOrderPage />}
        />

        <Route
          path="/order"
          element={<OrderDetailsPage />}
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
