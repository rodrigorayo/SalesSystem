"""
Utilidades centralizadas de manejo de errores.

Principios:
  - DRY: un solo lugar para traducir errores técnicos → mensajes al usuario
  - SRP: solo responsable de clasificar y formatear errores
  - El backend nunca expone stacktraces ni jerga técnica al usuario final
"""
from fastapi import HTTPException
import logging

logger = logging.getLogger("ErrorUtils")


# ─── Detección de errores transitorios de MongoDB ────────────────────────────

_TRANSIENT_KEYWORDS = [
    "WriteConflict",
    "write conflict",
    "TransientTransactionError",
    "retryable",
    "connection reset",
    "connection refused",
    "ServerSelectionTimeoutError",
]


def is_transient_error(exc: Exception) -> bool:
    """Devuelve True si el error es temporal (reintentar puede resolverlo)."""
    msg = str(exc).lower()
    return any(kw.lower() in msg for kw in _TRANSIENT_KEYWORDS)


def handle_service_error(exc: Exception, context: str = "") -> HTTPException:
    """
    Convierte cualquier excepción inesperada en un HTTPException amigable.
    Distingue entre errores transitorios (reintentar) y errores permanentes.

    Uso:
        except HTTPException:
            raise  # Dejar pasar los errores de negocio ya manejados
        except Exception as e:
            raise handle_service_error(e, "al procesar la venta")
    """
    if isinstance(exc, HTTPException):
        return exc

    log_msg = f"[{context}] Error inesperado: {exc}"
    logger.error(log_msg, exc_info=True)

    if is_transient_error(exc):
        return HTTPException(
            status_code=503,
            detail=(
                "El sistema está procesando otra operación al mismo tiempo. "
                "Esperá 2 segundos y volvé a intentarlo."
            )
        )

    return HTTPException(
        status_code=500,
        detail=(
            "Ocurrió un error inesperado en el servidor. "
            f"Contexto: {context}. Si el problema persiste, contactá al soporte."
        )
    )


# ─── Mensajes amigables por módulo ───────────────────────────────────────────

class CajaErrors:
    SESION_YA_ABIERTA      = "Ya hay una caja abierta en esta sucursal. Cerrala antes de abrir una nueva."
    SESION_NO_ENCONTRADA   = "No se encontró la sesión de caja. Es posible que ya haya sido cerrada."
    SESION_YA_CERRADA      = "Esta sesión de caja ya fue cerrada anteriormente."
    SIN_SESION_ACTIVA      = "No hay una caja abierta en este momento. Abrí la caja antes de registrar movimientos."


class VentasErrors:
    @staticmethod
    def stock_insuficiente(producto: str, disponible: int, solicitado: int) -> str:
        return (
            f"Stock insuficiente para '{producto}'. "
            f"Hay {disponible} unidad{'es' if disponible != 1 else ''} disponible{'s' if disponible != 1 else ''}, "
            f"y se solicitaron {solicitado}."
        )

    @staticmethod
    def producto_no_encontrado(producto_id: str) -> str:
        return f"El producto con ID '{producto_id}' no existe en el catálogo de este negocio."

    VENTA_YA_ANULADA       = "Esta venta ya fue anulada anteriormente y no puede modificarse."
    VENTA_NO_ENCONTRADA    = "No se encontró la venta. Es posible que haya sido eliminada."
    SIN_PERMISO_ANULAR     = "Solo podés anular ventas de tu propia sucursal."


class PedidosErrors:
    @staticmethod
    def stock_insuficiente_origen(producto: str, solicitado: int, disponible: int) -> str:
        return (
            f"Stock insuficiente de '{producto}' en la sucursal origen. "
            f"Solicitado: {solicitado}, Disponible: {disponible}."
        )

    @staticmethod
    def producto_no_encontrado(producto_id: str) -> str:
        return f"El producto '{producto_id}' no se encuentra en el catálogo."

    @staticmethod
    def estado_invalido_para(accion: str, estado_actual: str) -> str:
        return f"No se puede {accion} un pedido que está en estado '{estado_actual}'."

    PEDIDO_NO_ENCONTRADO           = "El pedido no fue encontrado. Puede haber sido cancelado."
    SIN_PERMISO_CANCELAR           = "No tenés permiso para cancelar este pedido."
    SIN_PERMISO_DESPACHAR          = "Solo el Administrador de Matriz puede despachar pedidos."
    SIN_PERMISO_RECIBIR            = "No tenés permiso para recibir este pedido en tu sucursal."
    SIN_PERMISO_APROBAR            = "No tenés permiso para aprobar despachos de esta sucursal."
    SUPERVISOR_NO_PUEDE_A_MATRIZ   = "Los Supervisores no pueden solicitar pedidos directos a la Matriz."
    NO_PUEDE_A_OTRA_SUCURSAL       = "Solo podés crear pedidos para tu propia sucursal."


class InventarioErrors:
    SIN_PERMISO                    = "No tenés permisos para realizar ajustes de inventario."
    SIN_SUCURSAL                   = "Tu usuario no tiene una sucursal asignada. Contactá al administrador."
    PRODUCTO_NO_ENCONTRADO         = "El producto no se encontró en el catálogo."
    CANTIDAD_NEGATIVA              = "La cantidad del ajuste debe ser un número positivo o cero."
    TIPO_INVALIDO                  = "Tipo de movimiento inválido. Usá: ENTRADA, SALIDA o AJUSTE."
