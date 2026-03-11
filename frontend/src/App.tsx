import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import TenantDashboard from './pages/TenantDashboard';
import SucursalesPage from './pages/SucursalesPage';
import CatalogoPage from './pages/CatalogoPage';
import InventarioPage from './pages/InventarioPage';
import PedidosPage from './pages/PedidosPage';
import POSPage from './pages/POSPage';
import CajaPage from './pages/CajaPage';
import CategoriesPage from './pages/CategoriesPage';
import UsersPage from './pages/UsersPage';
import DescuentosPage from './pages/DescuentosPage';
import DashboardSucursal from './pages/DashboardSucursal';
import VentasPage from './pages/VentasPage';
import ControlQRPage from './pages/ControlQRPage';
import PriceRequestsPage from './pages/PriceRequestsPage';
import ReportsPage from './pages/ReportsPage';
import { useAuthStore } from './store/authStore';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// ─── Route Guard ─────────────────────────────────────────────────────────────
const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated()) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'SUPERADMIN') return <Navigate to="/admin" replace />;
    if (['ADMIN_MATRIZ', 'ADMIN'].includes(role)) return <Navigate to="/dashboard" replace />;
    if (role === 'ADMIN_SUCURSAL') return <Navigate to="/pedidos" replace />;
    return <Navigate to="/pos" replace />;
  }

  return children;
};

// ─── Role Dispatcher ─────────────────────────────────────────────────────────
const DashboardDispatch = () => {
  const { role } = useAuthStore();
  if (role === 'SUPERADMIN') return <Navigate to="/admin" replace />;
  if (['ADMIN_MATRIZ', 'ADMIN'].includes(role ?? '')) return <Navigate to="/dashboard" replace />;
  if (role === 'ADMIN_SUCURSAL') return <Navigate to="/dashboard-sucursal" replace />;
  return <Navigate to="/pos" replace />;
};

const MATRIZ_ROLES = ['ADMIN_MATRIZ', 'ADMIN', 'SUPERADMIN'];
const BRANCH_ROLES = ['ADMIN_SUCURSAL', 'ADMIN_MATRIZ', 'ADMIN', 'SUPERADMIN'];
const ALL_STAFF = ['ADMIN_MATRIZ', 'ADMIN_SUCURSAL', 'CAJERO', 'ADMIN', 'USER', 'SUPERADMIN'];

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors theme="light" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/*" element={
            <Layout>
              <Routes>
                {/* Auto-redirect to the right view for the role */}
                <Route path="/" element={<ProtectedRoute><DashboardDispatch /></ProtectedRoute>} />

                {/* SuperAdmin */}
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />

                {/* Matriz Admin */}
                <Route path="/dashboard" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES}>
                    <TenantDashboard />
                  </ProtectedRoute>
                } />

                {/* Reportes/Analytics */}
                <Route path="/reportes" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES}>
                    <ReportsPage />
                  </ProtectedRoute>
                } />

                <Route path="/sucursales" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES}>
                    <SucursalesPage />
                  </ProtectedRoute>
                } />

                <Route path="/dashboard-sucursal" element={
                  <ProtectedRoute allowedRoles={['ADMIN_SUCURSAL']}>
                    <DashboardSucursal />
                  </ProtectedRoute>
                } />

                <Route path="/catalogo" element={
                  <ProtectedRoute allowedRoles={BRANCH_ROLES}>
                    <CatalogoPage />
                  </ProtectedRoute>
                } />

                <Route path="/inventario" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF}>
                    <InventarioPage />
                  </ProtectedRoute>
                } />

                {/* B2B Orders — both Matriz and Sucursal */}
                <Route path="/pedidos" element={
                  <ProtectedRoute allowedRoles={BRANCH_ROLES}>
                    <PedidosPage />
                  </ProtectedRoute>
                } />

                {/* Historial de Ventas (Tickets) */}
                <Route path="/ventas" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF}>
                    <VentasPage />
                  </ProtectedRoute>
                } />

                {/* Control QR */}
                <Route path="/qr-control" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF}>
                    <ControlQRPage />
                  </ProtectedRoute>
                } />

                {/* Descuentos */}
                <Route path="/descuentos" element={
                  <ProtectedRoute allowedRoles={BRANCH_ROLES}>
                    <DescuentosPage />
                  </ProtectedRoute>
                } />

                <Route path="/solicitudes-precio" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES}>
                    <PriceRequestsPage />
                  </ProtectedRoute>
                } />

                {/* Categories */}
                <Route path="/categories" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES}>
                    <CategoriesPage />
                  </ProtectedRoute>
                } />

                {/* Users (Personal) */}
                <Route path="/usuarios" element={
                  <ProtectedRoute allowedRoles={BRANCH_ROLES}>
                    <UsersPage />
                  </ProtectedRoute>
                } />

                {/* Caja */}
                <Route path="/caja" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF}>
                    <CajaPage />
                  </ProtectedRoute>
                } />

                {/* POS */}
                <Route path="/pos" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF}>
                    <POSPage />
                  </ProtectedRoute>
                } />
              </Routes>
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
