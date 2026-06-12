import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import TenantsAdminPage from './pages/TenantsAdminPage';
import PlanesAdminPage from './pages/PlanesAdminPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import TenantDashboard from './pages/TenantDashboard';
import SucursalesPage from './pages/SucursalesPage';
import CatalogoPage from './pages/CatalogoPage';
import InventarioPage from './pages/InventarioPage';
import InventarioTrasladosPage from './pages/InventarioTrasladosPage';
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
import ClientesPage from './pages/ClientesPage';
import ProveedoresPage from './pages/ProveedoresPage';
import CreditosPage from './pages/CreditosPage';
import RecipesPage from './pages/RecipesPage';
import MealPlansPage from './pages/MealPlansPage';
import ProductionCalendarPage from './pages/ProductionCalendarPage';
import ReclamosFabrica from './pages/b2b/ReclamosFabrica';
import ComunidadPage from './pages/ComunidadPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import AuditLogsPage from './pages/AuditLogsPage';
import { useAuthStore } from './store/authStore';
import { getMyFeatures, getMyTenant } from './api/api';
import { Toaster } from 'sonner';
import { ErrorModalProvider, useErrorModal } from './components/ErrorModal';
import { ConfirmProvider } from './components/ConfirmModal';

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
  const { isAuthenticated, setFeatures, features, setTenantSettings, setPlanExpiresAt } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) return;
    
    if (features.length === 0) {
      getMyFeatures()
        .then(res => setFeatures(res.features, res.plan_name))
        .catch(() => {});
    }

    // Siempre refrescar settings al iniciar
    getMyTenant()
      .then(tenant => {
          if (tenant.settings) {
              setTenantSettings(tenant.settings);
              if (tenant.settings.brand_color) {
                  document.documentElement.style.setProperty('--brand-color', tenant.settings.brand_color);
              }
          }
          if (tenant.plan_expires_at !== undefined) {
              setPlanExpiresAt(tenant.plan_expires_at);
          }
      })
      .catch(() => {});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated()]);

  return null;
}

function SoftLockBlocker() {
    const { isAuthenticated, planExpiresAt, role, logout } = useAuthStore();
    if (!isAuthenticated() || role === 'SUPERADMIN' || !planExpiresAt) return null;

    // Check if expired
    const today = new Date();
    // planExpiresAt is full ISO from backend
    const expiry = new Date(planExpiresAt);
    if (today <= expiry) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
                <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 border-8 border-red-100/50">
                    <Lock size={40} />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Acceso Bloqueado</h1>
                <p className="text-gray-500 mb-8 font-medium leading-relaxed">Tu suscripción ha finalizado el <strong className="text-gray-900">{expiry.toLocaleDateString()}</strong>. Por favor, contacta con tu proveedor para renovar tu plan y recuperar el acceso a tu información.</p>
                <button onClick={() => { logout(); window.location.href = '/login'; }} className="w-full bg-black text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors shadow-lg shadow-black/10">
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
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
    if (role === 'FACTURADOR') return <Navigate to="/ventas" replace />;
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
  if (role === 'FACTURADOR') return <Navigate to="/ventas" replace />;
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
        <ConfirmProvider>
          <ErrorEventBridge />
          <FeaturesFetcher />
          <SoftLockBlocker />
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
                <Route path="/admin/dashboard" element={
                  <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/empresas" element={
                  <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                    <TenantsAdminPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/planes" element={
                  <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                    <PlanesAdminPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

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

                {/* Traslados de Inventario */}
                <Route path="/traslados" element={
                  <ProtectedRoute allowedRoles={MOBILE_MANAGEMENT_ROLES} requiredFeature="INVENTARIO">
                    <InventarioTrasladosPage />
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
                  <ProtectedRoute allowedRoles={[...ALL_STAFF, 'FACTURADOR']} requiredFeature="VENTAS">
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

                {/* Clientes */}
                <Route path="/clientes" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF}>
                    <ClientesPage />
                  </ProtectedRoute>
                } />

                {/* Proveedores */}
                <Route path="/proveedores" element={
                  <ProtectedRoute allowedRoles={MOBILE_MANAGEMENT_ROLES}>
                    <ProveedoresPage />
                  </ProtectedRoute>
                } />

                {/* Dark Kitchen */}
                <Route path="/recetas" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES} requiredFeature="INVENTARIO">
                    <RecipesPage />
                  </ProtectedRoute>
                } />
                <Route path="/planes-comida" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES} requiredFeature="INVENTARIO">
                    <MealPlansPage />
                  </ProtectedRoute>
                } />
                <Route path="/produccion" element={
                  <ProtectedRoute allowedRoles={ALL_STAFF} requiredFeature="INVENTARIO">
                    <ProductionCalendarPage />
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

                {/* Configuración */}
                <Route path="/configuracion" element={
                  <ProtectedRoute allowedRoles={MATRIZ_ROLES}>
                    <ConfiguracionPage />
                  </ProtectedRoute>
                } />

                {/* Auditoria */}
                <Route path="/auditoria" element={
                  <ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN_MATRIZ', 'ADMIN']}>
                    <AuditLogsPage />
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
        </ConfirmProvider>
      </ErrorModalProvider>
    </QueryClientProvider>
  );
}

export default App;
