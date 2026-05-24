# Defensa Técnica: Wallet Service

Este documento resume las decisiones estratégicas y arquitectónicas tomadas para la implementación del servicio de wallet, alineado con los criterios de evaluación de la prueba técnica.

---

## 0. Diagrama de Arquitectura
El diagrama detallado de la arquitectura se encuentra en el archivo raíz: `diagrama-arquitectura.md`.

---

## 1. Contrato de Interfaz (REST)
Se eligió **REST (sobre HTTP/JSON)** como contrato de interfaz principal, descartando alternativas como gRPC o arquitecturas dirigidas por eventos (Kafka/RabbitMQ) por las siguientes razones:
*   **Sincronía y Feedback Inmediato:** Las operaciones financieras críticas (como transferencias o retiros) requieren que el cliente sepa instantáneamente si la transacción fue exitosa o si falló (ej. fondos insuficientes). Eventos asíncronos obligarían al cliente a implementar polling o webhooks para conocer el resultado final de la operación.
*   **Interoperabilidad Universal:** REST es el estándar de facto. Garantiza una integración rápida y de baja fricción para cualquier otro equipo que consuma el wallet, sin requerir la distribución y compilación de archivos `.proto` (gRPC) ni el acoplamiento a una infraestructura de mensajería específica.
*   **Idempotencia y Semántica:** REST permite aprovechar características intrínsecas del protocolo HTTP de manera muy elegante. El sistema utiliza headers estándar (`X-Idempotency-Key`) y verbos semánticos, mapeando errores de negocio a códigos de estado claros (`409 Conflict` para reintentos ya procesados, `422 Unprocessable Entity` para violaciones de saldo), resultando en una API predecible y fácil de debuggear.

## 2. Modelado de Datos (Fuente de Verdad)
Se optó por un modelo **Híbrido de Ledger (Libro Mayor)**:
*   **Tabla `movements` (Inmutable):** Es la fuente de verdad absoluta. Cada transacción (depósito, retiro, transferencia) genera un registro inmutable.
*   **Tabla `accounts` (Hot Balance):** Contiene el saldo actual para optimizar lecturas y bloqueos.
*   **Precisión Financiera:** Se utiliza `DECIMAL(20,2)` en PostgreSQL para evitar errores de redondeo de punto flotante.

## 3. Concurrencia y Consistencia
El mayor riesgo en un wallet es el "Double Spending" y las condiciones de carrera.
*   **Bloqueo Pesimista (`SELECT FOR UPDATE`):** Se bloquea la fila de la cuenta al inicio de la transacción, forzando una ejecución secuencial segura sobre la misma cuenta.
*   **Prevención de Deadlocks:** En transferencias entre dos cuentas, el sistema **siempre bloquea primero el ID menor** (ordenamiento determinístico). Esto elimina la posibilidad de espera circular.
*   **Integridad Atómica:** Todo movimiento ocurre dentro de una transacción ACID. Si falla el registro del movimiento, el saldo no se actualiza (y viceversa).

## 4. Resistencia a Fallos e Idempotencia
El sistema garantiza que "no se cobre dos veces" ante reintentos por fallos de red:
*   **Nivel de API:** Un Interceptor captura la respuesta exitosa y la almacena en `idempotency_responses`. Si el cliente reintenta con la misma `X-Idempotency-Key`, recibe la respuesta original sin procesar la lógica de nuevo.
*   **Nivel de Base de Datos:** La tabla de movimientos tiene un índice `UNIQUE` sobre la clave de idempotencia, actuando como última línea de defensa.

## 5. Manejo de Errores
Se implementó un `DatabaseErrorMapper` que traduce códigos nativos de PostgreSQL (ej. `23514` para violaciones de `CHECK`) en excepciones de dominio claras (`InsufficientFundsException`), desacoplando la lógica de negocio de la implementación de persistencia.

## 6. Estrategia de Testing (Basada en Riesgo)
En lugar de buscar cobertura porcentual genérica, los tests se enfocan en los riesgos críticos:
*   **Stress Test de Concurrencia:** Un test E2E dispara 20 transferencias simultáneas sobre una cuenta con saldo limitado, probando empíricamente que el sistema bloquea correctamente y no permite saldos negativos.
*   **Tests de Idempotencia:** Validan que reintentos idénticos no dupliquen movimientos.

## 7. Trade-offs (Decisiones y Descartes)
*   **Sin ORM (TypeORM/Prisma):** Se descartó para tener control total sobre el SQL, los niveles de aislamiento y los bloqueos pesimistas, evitando la "magia" que suele ocultar problemas de concurrencia.
*   **Arquitectura Modular vs Hexagonal Pura:** Se eligió seguir la filosofía de NestJS (Monolito Modular) para acelerar la entrega sin añadir el boilerplate excesivo de mappers y puertos de una arquitectura hexagonal pura, manteniendo un desacoplamiento sano.
*   **No CQRS/Event Sourcing:** Se priorizó la consistencia inmediata y simplicidad operativa sobre la escalabilidad eventual de modelos asíncronos.

## 8. Conciencia Operacional
*   **Bootstrapping Automático:** El sistema detecta si la base de datos existe al iniciar y la crea/migra automáticamente, facilitando el despliegue en entornos locales (Laragon) o nube (AWS ECS/Fargate).
*   **Restricciones de Integridad (Safety Net):** Se añadió un `CHECK (balance >= 0)` directamente en la base de datos. Incluso si hay un bug en el código, la base de datos impedirá físicamente un saldo negativo.

---
**Resumen de Defensa:** "Prioricé la **consistencia y auditabilidad** por encima de la complejidad técnica innecesaria. El sistema es simple pero blindado mediante transacciones determinísticas y restricciones nativas de PostgreSQL."
