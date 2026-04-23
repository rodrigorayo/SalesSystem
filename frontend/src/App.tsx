import React, { useEffect } from 'react';
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
import CreditosPage from './pages/CreditosPage';
import ReclamosFabrica from './pages/b2b/ReclamosFabrica';
import ComunidadPage from './pages/ComunidadPage';
import { useAuthStore } from './store/authStore';
import { getMyFeatures } from './api/api';
import { Toaster } from 'sonner';
import { ErrorModalProvider, useErrorModal } from './components/ErrorModal';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/**
 * Bridges the imperative window CustomEvent from client.ts
 * into the React ErrorModal context — keeping concerns separated.
 */
function ErrorEventBridge() {
  const { showError } = useErrorModal();
  useEffect(() => {
    const handler = (e: Event) => {
      const { message, statusCode, retryFn } = (e as CustomEvent).detail;
      showError(message, { statusCode, retryFn });
    };
    window.addEventListener('api:critical-error', handler);
    return () => window.removeEventListener('api:critical-error', handler);
  }, [showError]);
  return null;
}

/**
 * Carga los feature flags del tenant al iniciar la app (si hay sesión activa).
 * Se ejecuta una sola vez por sesión, persistido en el store.
 */
function FeaturesFetcher() {
  const { isAuthenticated, setFeatures, features } = useAuthStore();

  useEffect(() => {
    // Solo cargar si está autenticado y aún no tiene features cargados
    if (!isAuthenticated()) return;
    if (features.length > 0) return;

    getMyFeatures()
      .then(res => setFeatures(res.features, res.plan_name))
      .catch(() => {
        // Error de red → ignorar, el fallback en hasFeature() retorna true
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated()]);

  return null;
}

// ─── Route Guard (autenticación + rol) ───────────────────────────────────────
const ProtectedRoute = ({
  children,
  allowedRoles,
  requiredFeature,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredFeature?: string;
}) => {
  const { isAuthenticated, role, hasFeature } = useAuthStore();

  if (!isAuthenticated()) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'SUPERADMIN') return <Navigate to="/admin" replace />;
    if (['ADMIN_MATRIZ', 'ADMIN'].includes(role)) return <Navigate to="/dashboard" replace />;
    if (role === 'ADMIN_SUCURSAL') return <Navigate to="/dashboard-sucursal" replace />;
    if (['SUPERVISOR', 'VENDEDOR'].includes(role)) return <Navigate to="/inventario" replace />;
    return <Navigate to="/pos" replace />;
  }

  // Verificar feature flag si se especificó
  if (requiredFeature && !hasFeature(requiredFeature)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// ─── Role Dispatcher ─────────────────────────────────────────────────────────
const DashboardDispatch = () => {
  const { role } = useAuthStore();
  if (role === 'SUPERADMIN') return <Navigate to="/admin" replace />;
  if (['ADMIN_MATRIZ', 'ADMIN'].includes(role ?? '')) return <Navigate to="/dashboard" replace />;
  if (role === 'ADMIN_SUCURSAL') return <Navigate to="/dashboard-sucursal" replace />;
  if (['SUPERVISOR', 'VENDEDOR'].includes(role ?? '')) return <Navigate to="/inventario" replace />;
  return <Navigate to="/pos" replace />;
};

const MATRIZ_ROLES = ['ADMIN_MATRIZ', 'ADMIN', 'SUPERADMIN'];
const BRANCH_ROLES = ['ADMIN_SUCURSAL', 'ADMIN_MATRIZ', 'ADMIN', 'SUPERADMIN'];
const MOBILE_MANAGEMENT_ROLES = [...BRANCH_ROLES, 'SUPERVISOR'];
const ALL_STAFF = ['ADMIN_MATRIZ', 'ADMIN_SUCURSAL', 'CAJERO', 'ADMIN', 'USER', 'SUPERADMIN', 'SUPERVISOR', 'VENDEDOR'];

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorModalProvider>
        <ErrorEventBridge />
        <Toaster position="top-right" richColors theme="light" />
      <BrowserRouter>
        <FeaturesFetcher />
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
                  <ProtectedRoute allowedRoles={BRANCH_ROLES} requiredFeature="REPORTES_AVANZADOS">
                    <ReportsPage />
                  </ProtectedRoute>
                } />

                <Route path="/sucursales" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES} requiredFeature="MULTI_SUCURSAL">
                    <SucursalesPage />
                  </ProtectedRoute>
                } />

                <Route path="/dashboard-sucursal" element={
                  <ProtectedRoute allowedRoles={['ADMIN_SUCURSAL']}>
                    <DashboardSucursal />
                  </ProtectedRoute>
                } />

                <Route path="/catalogo" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF} requiredFeature="INVENTARIO">
                    <CatalogoPage />
                  </ProtectedRoute>
                } />

                <Route path="/inventario" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF} requiredFeature="INVENTARIO">
                    <InventarioPage />
                  </ProtectedRoute>
                } />

                {/* B2B Orders */}
                <Route path="/pedidos" element={
                  <ProtectedRoute allowedRoles={MOBILE_MANAGEMENT_ROLES} requiredFeature="PEDIDOS_INTERNOS">
                    <PedidosPage />
                  </ProtectedRoute>
                } />

                {/* Historial de Ventas */}
                <Route path="/ventas" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF} requiredFeature="VENTAS">
                    <VentasPage />
                  </ProtectedRoute>
                } />

                {/* Control QR */}
                <Route path="/qr-control" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF} requiredFeature="CONTROL_QR">
                    <ControlQRPage />
                  </ProtectedRoute>
                } />

                {/* Créditos */}
                <Route path="/creditos" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF} requiredFeature="CREDITOS">
                    <CreditosPage />
                  </ProtectedRoute>
                } />

                {/* B2B / Reclamos Fábrica */}
                <Route path="/b2b/mermas" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES}>
                    <ReclamosFabrica />
                  </ProtectedRoute>
                } />

                {/* Comunidad FEXCO */}
                <Route path="/comunidad" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES}>
                    <ComunidadPage />
                  </ProtectedRoute>
                } />

                {/* Descuentos */}
                <Route path="/descuentos" element={
                  <ProtectedRoute allowedRoles={BRANCH_ROLES} requiredFeature="DESCUENTOS_AVANZADOS">
                    <DescuentosPage />
                  </ProtectedRoute>
                } />

                <Route path="/solicitudes-precio" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES} requiredFeature="LISTAS_PRECIOS">
                    <PriceRequestsPage />
                  </ProtectedRoute>
                } />

                {/* Categories (parte de INVENTARIO) */}
                <Route path="/categories" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES} requiredFeature="INVENTARIO">
                    <CategoriesPage />
                  </ProtectedRoute>
                } />

                {/* Users */}
                <Route path="/usuarios" element={
                  <ProtectedRoute allowedRoles={MOBILE_MANAGEMENT_ROLES}>
                    <UsersPage />
                  </ProtectedRoute>
                } />

                {/* Caja */}
                <Route path="/caja" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF} requiredFeature="CAJA">
                    <CajaPage />
                  </ProtectedRoute>
                } />

                {/* POS */}
                <Route path="/pos" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF} requiredFeature="VENTAS">
                    <POSPage />
                  </ProtectedRoute>
                } />
              </Routes>
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
      </ErrorModalProvider>
    </QueryClientProvider>
  );
}

export default App;
