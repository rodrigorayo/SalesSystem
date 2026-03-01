# Database Architecture — SalesSystem

## Design Patterns

### Dual Pattern: Embedding + Analytics Collection

This system uses a dual-source pattern for transaction items to balance read performance and analytical flexibility.

| Primary Collection | Embedded JSON (`items`) | Analytical Collection |
| ------------------ | ----------------------- | --------------------- |
| `sales`            | `items` (List)          | `sale_items`          |
| `pedidos_internos` | `items` (List)          | `pedido_items`        |

#### Why two sources?

1. **Embedded JSON** (`sales.items`, `pedidos_internos.items`):
   - **Use Case**: Loading the full detail of a specific transaction.
   - **Benefit**: No joins or multiple queries needed. One document contains everything.
   - **Priority**: This is the **Source of Truth**. If discrepancies occur, the embedded data is correct.

2. **Analytical Collection** (`sale_items`, `pedido_items`):
   - **Use Case**: Reports, dashboards, and item-based searches.
   - **Benefit**: Efficient indexing by product, category, date, or branch across all transactions.
   - **Queries**: "¿How many units of X were sold today?", "¿What is the movement of product Y between branches?".

#### Implementation Rules

- **Write Rule**: Both sources MUST be written atomically in the same request. If one fails, the transaction must be rolled back (or managed via consistent retry logic).
- **Read Rule (UI)**: Use the primary collection for Detail Views. Use the analytical collection for List Views with filters and Aggregations.
- **Indexing**: Analytical collections include denormalized timestamps (`sale_date`, `pedido_fecha`) for rapid range queries.
