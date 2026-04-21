from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from app.domain.models.user import User
from app.infrastructure.auth import get_current_active_user
from app.domain.models.credito import CuentaCredito, Deuda, TransaccionCredito, EstadoCuenta
from app.domain.models.cliente import Cliente
from app.schemas.credito import CuentasCreditoPaginated, AbonoRequestIn, CuentaCreditoResponse
from app.application.services.credito_service import CreditoService

router = APIRouter()

@router.get("/creditos", response_model=CuentasCreditoPaginated)
async def get_cuentas_credito(
    q: Optional[str] = None,
    estado: Optional[EstadoCuenta] = None,
    page: int = 1,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    
    filters = [CuentaCredito.tenant_id == tenant_id]
    if estado:
        filters.append(CuentaCredito.estado_cuenta == estado)
        
    if q:
        import re
        regex = re.compile(f".*{re.escape(q)}.*", re.IGNORECASE)
        filters.append({
            "$or": [
                {"cliente_nombre": regex},
                {"cliente_nit": regex},
                {"cliente_telefono": regex}
            ]
        })
        
    query = CuentaCredito.find(*filters)
    total = await query.count()
    skip = (page - 1) * limit
    cuentas = await query.sort(-CuentaCredito.updated_at).skip(skip).limit(limit).to_list()
    
    # Resolve client names fallback (for older accounts not yet migrated)
    result_items = []
    for c in cuentas:
        # If the newly added fields exist, use them. Otherwise fallback to fetch.
        c_nombre = getattr(c, "cliente_nombre", None)
        c_nit = getattr(c, "cliente_nit", None)
        c_telefono = getattr(c, "cliente_telefono", None)
        
        if not c_nombre:
            cli = await Cliente.get(c.cliente_id)
            if cli:
                c_nombre = cli.nombre
                c_nit = cli.nit_ci
                c_telefono = cli.telefono

        result_items.append({
            "id": str(c.id),
            "cliente_id": c.cliente_id,
            "saldo_total": float(str(c.saldo_total)),
            "estado_cuenta": c.estado_cuenta.value,
            "created_at": c.created_at.isoformat(),
            "cliente_nombre": c_nombre or "Desconocido",
            "cliente_nit": c_nit,
            "cliente_telefono": c_telefono
        })

    import math
    return {
        "items": result_items,
        "total": total, 
        "page": page,
        "pages": math.ceil(total / limit) if limit > 0 else 1
    }


@router.get("/creditos/{cuenta_id}/deudas")
async def get_deudas_por_cuenta(
    cuenta_id: str,
    estado: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    cuenta = await CuentaCredito.get(cuenta_id)
    if not cuenta or cuenta.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
    filters = [Deuda.cuenta_id == cuenta_id]
    if estado:
        filters.append(Deuda.estado == estado)
        
    deudas = await Deuda.find(*filters).sort(-Deuda.fecha_emision).to_list()
    
    return [
        {
            "id": str(d.id),
            "cuenta_id": str(d.cuenta_id),
            "cliente_id": str(d.cliente_id),
            "sale_id": str(d.sale_id),
            "sale_id_corto": str(d.sale_id)[-6:].upper(),
            "monto_original": float(str(d.monto_original)),
            "saldo_pendiente": float(str(d.saldo_pendiente)),
            "fecha_emision": d.fecha_emision.isoformat(),
            "estado": d.estado.value,
        } for d in deudas
    ]
    

@router.get("/creditos/{cuenta_id}/transacciones")
async def get_transacciones_cuenta(
    cuenta_id: str,
    current_user: User = Depends(get_current_active_user)
):
    tenant_id = current_user.tenant_id or "default"
    cuenta = await CuentaCredito.get(cuenta_id)
    if not cuenta or cuenta.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
    historial = await TransaccionCredito.find(
        TransaccionCredito.cuenta_id == cuenta_id
    ).sort(-TransaccionCredito.created_at).to_list()
    
    return [
        {
            "id": str(h.id),
            "tipo": h.tipo,
            "monto": float(str(h.monto)),
            "pagos": [p.dict() for p in h.pagos] if h.pagos else [],
            "deudas_afectadas": h.deudas_afectadas,
            "cajero_nombre": h.cajero_nombre,
            "notas": h.notas,
            "created_at": h.created_at.isoformat()
        } for h in historial
    ]


@router.post("/creditos/{cuenta_id}/abonos")
async def registrar_abono_endpoint(
    cuenta_id: str,
    request: AbonoRequestIn,
    current_user: User = Depends(get_current_active_user)
):
    """
    Registra uno o múltiples pagos a la cuenta, rebajando deudas de manera inteligente.
    """
    cuenta_actualizada = await CreditoService.registrar_abono(cuenta_id, request, current_user)
    
    return {
        "message": "Abono registrado exitosamente.",
        "cuenta_id": str(cuenta_actualizada.id),
        "nuevo_saldo": float(str(cuenta_actualizada.saldo_total))
    }

@router.post("/creditos/{cuenta_id}/transacciones/{transaccion_id}/anular")
async def anular_abono_endpoint(
    cuenta_id: str,
    transaccion_id: str,
    motivo: str = "Reversión manual",
    current_user: User = Depends(get_current_active_user)
):
    """
    Anula un abono, devolviendo la deuda, actualizando el saldo y registrando el egreso en caja.
    """
    # Verify account
    tenant_id = current_user.tenant_id or "default"
    cuenta = await CuentaCredito.get(cuenta_id)
    if not cuenta or cuenta.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
    cuenta_actualizada = await CreditoService.anular_abono(transaccion_id, current_user, motivo)
    
    return {
        "message": "Abono anulado exitosamente.",
        "cuenta_id": str(cuenta_actualizada.id),
        "nuevo_saldo": float(str(cuenta_actualizada.saldo_total))
    }
