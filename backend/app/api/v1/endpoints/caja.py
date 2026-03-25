"""
Caja endpoints — full cash-drawer session management.

Routes:
  POST   /caja/sesion/abrir            — open a new session
  GET    /caja/sesion/activa           — get the active session for this branch
  POST   /caja/sesion/{id}/cerrar      — close a session with physical count
  GET    /caja/sesion/{id}/resumen     — full day breakdown (for arqueo modal)
  POST   /caja/gastos                  — record a manual expense
  GET    /caja/movimientos             — list movements (today / active session)
  GET    /caja/categorias-gasto        — list expense categories
  POST   /caja/categorias-gasto        — create an expense category
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.models.caja import CajaSesion, CajaMovimiento, CajaGastoCategoria, EstadoSesion, SubtipoMovimiento
from app.models.sale import Sale
from app.models.user import User
from app.auth import get_current_active_user

router = APIRouter()


from app.schemas.caja import AbrirCajaIn, CerrarCajaIn, GastoIn, IngresoIn, CategoriaGastoIn, ResumenCaja

# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_active_session(tenant_id: str, sucursal_id: str) -> Optional[CajaSesion]:
    return await CajaSesion.find_one(
        CajaSesion.tenant_id   == tenant_id,
        CajaSesion.sucursal_id == sucursal_id,
        CajaSesion.estado      == EstadoSesion.ABIERTA,
    )


# ─── Historial de sesiones ────────────────────────────────────────────────────

@router.get("/sesiones")
async def get_sesiones(current_user: User = Depends(get_current_active_user)):
    """Return all sessions for the current tenant/branch, newest first. Read-only."""
    tenant_id   = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "CENTRAL"

    sesiones = await CajaSesion.find(
        CajaSesion.tenant_id   == tenant_id,
        CajaSesion.sucursal_id == sucursal_id,
    ).sort("-abierta_at").to_list()

    result = []
    for s in sesiones:
        movs = await CajaMovimiento.find(CajaMovimiento.sesion_id == str(s.id)).to_list()
        ef   = sum(float(m.monto) for m in movs if m.subtipo == SubtipoMovimiento.VENTA_EFECTIVO)
        ef_ing = sum(float(m.monto) for m in movs if m.subtipo == SubtipoMovimiento.INGRESO_EFECTIVO)
        cc   = sum(float(m.monto) for m in movs if m.subtipo == SubtipoMovimiento.CAMBIO)
        gs   = sum(float(m.monto) for m in movs if m.subtipo == SubtipoMovimiento.GASTO)
        aj   = sum((float(m.monto) if m.tipo == "INGRESO" else -float(m.monto)) for m in movs if m.subtipo == SubtipoMovimiento.AJUSTE)
        saldo = float(s.monto_inicial) + ef + ef_ing - cc - gs + aj

        # Digital totals from sales during this session
        cerrada_at = s.cerrada_at or datetime.utcnow()
        sales = await Sale.find(
            Sale.tenant_id   == tenant_id,
            Sale.sucursal_id == sucursal_id,
            Sale.created_at  >= s.abierta_at,
            Sale.created_at  <= cerrada_at,
            Sale.anulada     == False,
        ).to_list()
        total_qr      = sum(float(p.monto) for sale in sales for p in (sale.pagos or []) if str(p.metodo).upper() == "QR") + sum(float(m.monto) for m in movs if m.subtipo == SubtipoMovimiento.INGRESO_QR)
        total_tarjeta = sum(float(p.monto) for sale in sales for p in (sale.pagos or []) if str(p.metodo).upper() == "TARJETA") + sum(float(m.monto) for m in movs if m.subtipo == SubtipoMovimiento.INGRESO_TARJETA)
        total_ventas  = sum(float(p.monto) for sale in sales for p in (sale.pagos or []))

        result.append({
            "id":              str(s.id),
            "cajero_name":     s.cajero_name,
            "estado":          s.estado,
            "abierta_at":      s.abierta_at,
            "cerrada_at":      s.cerrada_at,
            "monto_inicial":   float(s.monto_inicial),
            "saldo_calculado": round(saldo, 2),
            "total_efectivo":  round(ef, 2),
            "total_cambio":    round(cc, 2),
            "total_gastos":    round(gs, 2),
            "total_ajustes":   round(aj, 2),
            "total_qr":        round(total_qr, 2),
            "total_tarjeta":   round(total_tarjeta, 2),
            "total_ventas":    round(total_ventas, 2),
            "num_transacciones": len(sales),
            "monto_cierre_fisico": float(s.monto_cierre_fisico) if s.monto_cierre_fisico is not None else None,
            "diferencia":      round(float(s.monto_cierre_fisico) - saldo, 2) if s.monto_cierre_fisico is not None else None,
            "notas_cierre":    s.notas_cierre,
        })

    return result



# ─── Sesión ───────────────────────────────────────────────────────────────────

@router.post("/sesion/abrir")
async def abrir_caja(body: AbrirCajaIn, current_user: User = Depends(get_current_active_user)):
    tenant_id   = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or body.sucursal_id or "CENTRAL"

    # Block if a session is already open
    existing = await _get_active_session(tenant_id, sucursal_id)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una sesión de caja abierta para esta sucursal.")

    sesion = CajaSesion(
        tenant_id    = tenant_id,
        sucursal_id  = sucursal_id,
        cajero_id    = str(current_user.id),
        cajero_name  = current_user.full_name or current_user.username,
        monto_inicial= float(body.monto_inicial),
        estado       = EstadoSesion.ABIERTA,
    )
    await sesion.create()

    # Register the opening movement
    await CajaMovimiento(
        tenant_id   = tenant_id,
        sucursal_id = sucursal_id,
        sesion_id   = str(sesion.id),
        cajero_id   = str(current_user.id),
        cajero_name = current_user.full_name or current_user.username,
        subtipo     = SubtipoMovimiento.APERTURA,
        tipo        = "INGRESO",
        monto       = float(body.monto_inicial),
        descripcion = "Apertura de caja",
    ).create()

    return sesion


@router.get("/sesion/activa")
async def get_sesion_activa(current_user: User = Depends(get_current_active_user)):
    tenant_id   = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "CENTRAL"
    sesion = await _get_active_session(tenant_id, sucursal_id)
    if not sesion:
        return None
    return sesion


@router.post("/sesion/{sesion_id}/cerrar")
async def cerrar_caja(sesion_id: str, body: CerrarCajaIn, current_user: User = Depends(get_current_active_user)):
    tenant_id = current_user.tenant_id or "default"

    sesion = await CajaSesion.get(sesion_id)
    if not sesion or sesion.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Sesión no encontrada.")
    if sesion.estado == EstadoSesion.CERRADA:
        raise HTTPException(status_code=400, detail="La sesión ya está cerrada.")

    sesion.estado                = EstadoSesion.CERRADA
    sesion.cerrada_at            = datetime.utcnow()
    sesion.monto_cierre_fisico   = float(body.monto_fisico_contado)
    sesion.notas_cierre          = body.notas
    await sesion.save()
    return sesion


@router.get("/sesion/{sesion_id}/resumen", response_model=ResumenCaja)
async def get_resumen(sesion_id: str, current_user: User = Depends(get_current_active_user)):
    tenant_id = current_user.tenant_id or "default"

    sesion = await CajaSesion.get(sesion_id)
    if not sesion or sesion.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Sesi\u00f3n no encontrada.")

    # ── Cash movements ────────────────────────────────────────────────────────
    movimientos = await CajaMovimiento.find(
        CajaMovimiento.sesion_id == sesion_id
    ).sort("+fecha").to_list()

    total_ventas_ef = sum(float(m.monto) for m in movimientos if m.subtipo == SubtipoMovimiento.VENTA_EFECTIVO)
    total_ingresos_ef = sum(float(m.monto) for m in movimientos if m.subtipo == SubtipoMovimiento.INGRESO_EFECTIVO)
    total_cambio    = sum(float(m.monto) for m in movimientos if m.subtipo == SubtipoMovimiento.CAMBIO)
    total_gastos    = sum(float(m.monto) for m in movimientos if m.subtipo == SubtipoMovimiento.GASTO)
    total_ajustes   = sum((float(m.monto) if m.tipo == "INGRESO" else -float(m.monto)) for m in movimientos if m.subtipo == SubtipoMovimiento.AJUSTE)
    
    total_ingresos_qr = sum(float(m.monto) for m in movimientos if m.subtipo == SubtipoMovimiento.INGRESO_QR)
    total_ingresos_tj = sum(float(m.monto) for m in movimientos if m.subtipo == SubtipoMovimiento.INGRESO_TARJETA)

    monto_inicial   = float(sesion.monto_inicial)
    saldo_calculado = monto_inicial + total_ventas_ef + total_ingresos_ef - total_cambio - total_gastos + total_ajustes

    # ── Sales made during this session (for digital channel totals) ───────────
    cerrada_at = sesion.cerrada_at or datetime.utcnow()
    sales_in_session = await Sale.find(
        Sale.tenant_id    == tenant_id,
        Sale.sucursal_id  == (sesion.sucursal_id),
        Sale.created_at   >= sesion.abierta_at,
        Sale.created_at   <= cerrada_at,
        Sale.anulada      == False,
    ).to_list()

    total_qr       = 0.0
    total_tarjeta  = 0.0
    total_efectivo_sales = 0.0

    for sale in sales_in_session:
        for pago in (sale.pagos or []):
            m = pago.metodo.upper() if hasattr(pago.metodo, 'upper') else str(pago.metodo).upper()
            v = float(pago.monto)
            if m == "QR":
                total_qr += v
            elif m == "TARJETA":
                total_tarjeta += v
            else:
                total_efectivo_sales += v

    total_qr += sum(float(m.monto) for m in movimientos if m.subtipo == SubtipoMovimiento.INGRESO_QR)
    total_tarjeta += sum(float(m.monto) for m in movimientos if m.subtipo == SubtipoMovimiento.INGRESO_TARJETA)
    total_ventas_general = total_qr + total_tarjeta + total_efectivo_sales
    num_transacciones    = len(sales_in_session)

    return ResumenCaja(
        sesion_id              = str(sesion.id),
        cajero_name            = sesion.cajero_name,
        abierta_at             = sesion.abierta_at,
        monto_inicial          = monto_inicial,
        total_efectivo_ventas  = total_ventas_ef,
        total_cambio           = total_cambio,
        total_gastos           = total_gastos,
        total_ajustes          = total_ajustes,
        saldo_calculado        = saldo_calculado,
        total_qr               = total_qr,
        total_tarjeta          = total_tarjeta,
        total_ventas_general   = total_ventas_general,
        total_ingresos_efectivo = total_ingresos_ef,
        total_ingresos_qr       = total_ingresos_qr,
        total_ingresos_tarjeta  = total_ingresos_tj,
        num_transacciones      = num_transacciones,
        movimientos            = [m.model_dump(mode="json") for m in movimientos],
    )


# ─── Gastos ───────────────────────────────────────────────────────────────────

@router.post("/gastos")
async def registrar_gasto(body: GastoIn, current_user: User = Depends(get_current_active_user)):
    tenant_id   = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "CENTRAL"

    sesion = await _get_active_session(tenant_id, sucursal_id)
    if not sesion:
        raise HTTPException(status_code=400, detail="No hay una sesión de caja abierta. Abrí la caja primero.")

    mov = CajaMovimiento(
        tenant_id   = tenant_id,
        sucursal_id = sucursal_id,
        sesion_id   = str(sesion.id),
        cajero_id   = str(current_user.id),
        cajero_name = current_user.full_name or current_user.username,
        subtipo     = SubtipoMovimiento.GASTO,
        tipo        = "EGRESO",
        monto       = float(body.monto),
        descripcion = body.descripcion,
        categoria_id= body.categoria_id,
    )
    await mov.create()
    return mov


# ─── Ingresos Manuales ────────────────────────────────────────────────────────

@router.post("/ingresos")
async def registrar_ingreso(body: IngresoIn, current_user: User = Depends(get_current_active_user)):
    tenant_id   = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "CENTRAL"

    sesion = await _get_active_session(tenant_id, sucursal_id)
    if not sesion:
        raise HTTPException(status_code=400, detail="No hay una sesión de caja abierta. Abrí la caja primero.")

    subtipo = SubtipoMovimiento.INGRESO_EFECTIVO
    metodo_upper = body.metodo.upper()
    if metodo_upper == "QR":
        subtipo = SubtipoMovimiento.INGRESO_QR
    elif metodo_upper == "TARJETA":
        subtipo = SubtipoMovimiento.INGRESO_TARJETA

    mov = CajaMovimiento(
        tenant_id   = tenant_id,
        sucursal_id = sucursal_id,
        sesion_id   = str(sesion.id),
        cajero_id   = str(current_user.id),
        cajero_name = current_user.full_name or current_user.username,
        subtipo     = subtipo,
        tipo        = "INGRESO",
        monto       = float(body.monto),
        descripcion = body.descripcion,
    )
    await mov.create()
    return mov


# ─── Movimientos ──────────────────────────────────────────────────────────────

@router.get("/movimientos")
async def get_movimientos(current_user: User = Depends(get_current_active_user)):
    tenant_id   = current_user.tenant_id or "default"
    sucursal_id = current_user.sucursal_id or "CENTRAL"

    sesion = await _get_active_session(tenant_id, sucursal_id)
    if not sesion:
        return []

    return await CajaMovimiento.find(
        CajaMovimiento.sesion_id == str(sesion.id)
    ).sort("+fecha").to_list()


# ─── Categorías de gasto ──────────────────────────────────────────────────────

@router.get("/categorias-gasto")
async def get_categorias(current_user: User = Depends(get_current_active_user)):
    tenant_id = current_user.tenant_id or "default"
    return await CajaGastoCategoria.find(CajaGastoCategoria.tenant_id == tenant_id).to_list()


@router.post("/categorias-gasto")
async def create_categoria(body: CategoriaGastoIn, current_user: User = Depends(get_current_active_user)):
    tenant_id = current_user.tenant_id or "default"
    cat = CajaGastoCategoria(
        tenant_id   = tenant_id,
        nombre      = body.nombre,
        descripcion = body.descripcion,
        icono       = body.icono or "receipt",
    )
    await cat.create()
    return cat
