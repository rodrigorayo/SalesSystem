from pydantic import BaseModel, Field
from typing import List

class KpiResumen(BaseModel):
    total_ventas: float = Field(0.0, description="Suma total de todas las ventas (ingresos)")
    costo_total: float = Field(0.0, description="Suma total de los costos de los productos vendidos")
    margen_bruto: float = Field(0.0, description="Porcentaje de margen bruto: (total_ventas - costo_total) / total_ventas")
    cantidad_transacciones: int = Field(0, description="Número total de boletas o transacciones exitosas")

class SucursalVenta(BaseModel):
    sucursal_id: str
    total_ingresos: float = Field(0.0, description="Ingresos totales de esta sucursal específica")

class VentasPorSucursal(BaseModel):
    detalle: List[SucursalVenta] = []

class ProductoTop(BaseModel):
    producto_id: str
    nombre: str
    cantidad_vendida: int
    ingresos: float = Field(0.0, description="Ingresos generados por este producto")

class TopProductos(BaseModel):
    productos: List[ProductoTop] = []

class DashboardResponse(BaseModel):
    kpis: KpiResumen
    ventas_por_sucursal: VentasPorSucursal
    top_productos: TopProductos
