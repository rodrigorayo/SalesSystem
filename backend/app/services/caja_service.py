import logging
from datetime import datetime
from fastapi import HTTPException

from app.models.caja import CajaSesion, CajaMovimiento, EstadoSesion, SubtipoMovimiento
from app.models.user import User
from app.schemas.caja import AbrirCajaIn, CerrarCajaIn
from app.models.base import DecimalMoney

logger = logging.getLogger("CajaService")

class CajaService:
    @staticmethod
    async def abrir_caja(body: AbrirCajaIn, current_user: User) -> CajaSesion:
        tenant_id   = current_user.tenant_id or "default"
        sucursal_id = current_user.sucursal_id or body.sucursal_id or "CENTRAL"

        sesion_existente = await CajaSesion.find_one(
            CajaSesion.tenant_id   == tenant_id,
            CajaSesion.sucursal_id == sucursal_id,
            CajaSesion.estado      == EstadoSesion.ABIERTA,
        )
        if sesion_existente:
            raise HTTPException(status_code=400, detail="Ya existe una sesión de caja abierta para esta sucursal.")

        client = CajaSesion.get_motor_collection().database.client
        try:
            async with await client.start_session() as session:
                async with session.start_transaction():
                    monto = DecimalMoney(body.monto_inicial)
                    sesion = CajaSesion(
                        tenant_id    = tenant_id,
                        sucursal_id  = sucursal_id,
                        cajero_id    = str(current_user.id),
                        cajero_name  = current_user.full_name or current_user.username,
                        monto_inicial= monto,
                        estado       = EstadoSesion.ABIERTA,
                    )
                    await sesion.create(session=session)

                    await CajaMovimiento(
                        tenant_id   = tenant_id,
                        sucursal_id = sucursal_id,
                        sesion_id   = str(sesion.id),
                        cajero_id   = str(current_user.id),
                        cajero_name = current_user.full_name or current_user.username,
                        subtipo     = SubtipoMovimiento.APERTURA,
                        tipo        = "INGRESO",
                        monto       = monto,
                        descripcion = "Apertura de caja",
                    ).create(session=session)

                    return sesion
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[CajaService.abrir_caja] Error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error transaccional: {str(e)}")

    @staticmethod
    async def cerrar_caja(sesion_id: str, body: CerrarCajaIn, current_user: User) -> CajaSesion:
        tenant_id = current_user.tenant_id or "default"
        sesion = await CajaSesion.get(sesion_id)
        if not sesion or sesion.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Sesión no encontrada.")
        if sesion.estado == EstadoSesion.CERRADA:
            raise HTTPException(status_code=400, detail="La sesión ya está cerrada.")

        sesion.estado                = EstadoSesion.CERRADA
        sesion.cerrada_at            = datetime.utcnow()
        sesion.monto_cierre_fisico   = DecimalMoney(body.monto_fisico_contado)
        sesion.notas_cierre          = body.notas
        await sesion.save()
        return sesion
