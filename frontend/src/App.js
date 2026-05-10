import { Route, Routes, useLocation, Navigate } from 'react-router-dom';
import './App.css';
import Header from './components/Header/Header';
import OrdersPage from './pages/OrdersPage/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage/OrderDetailsPage';
import { ToastContainer } from 'react-toastify';
import HomePage from './pages/HomePage/HomePage';
import QueuePrintpage from './pages/QueuePrintPage/QueuePrintPage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import EmployeesPage from './pages/EmployeesPage/EmployeesPage';
import MaterialsPage from './pages/MaterialsPage/MaterialPage';

function App() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <AuthProvider>
      {!isHomePage && <Header />}
      <Routes>
        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute
              allowedPermissions={[
                { key: 'order', level: 1 },
                { key: 'queues', level: 1 },
              ]}
            >
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:orderNum"
          element={
            <ProtectedRoute
              allowedPermissions={[
                { key: 'order', level: 1 },
                { key: 'queues', level: 1 },
              ]}
            >
              <OrderDetailsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/print-queue"
          element={
            <ProtectedRoute allowedPermissions={[{ key: 'queues', level: 1 }]}>
              <QueuePrintpage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/materials"
          element={
            <ProtectedRoute allowedPermissions={[{ key: 'storage', level: 1 }]}>
              <MaterialsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedPermissions={[{ key: 'role', level: 1 }]}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
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
    </AuthProvider>
  );
}

export default App;
