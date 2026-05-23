# Diagrama de Arquitectura - Wallet Service

Este diagrama representa el flujo de datos y la infraestructura del sistema, desde la solicitud del cliente hasta las garantías de integridad en la base de datos PostgreSQL.

```mermaid
graph TD
    Client[Cliente / Otros Equipos] -- HTTPS / JSON --> ALB[AWS Application Load Balancer]
    
    subgraph "Application Tier (AWS ECS Fargate)"
        ALB --> NestApp[NestJS Wallet Service]
        
        subgraph "NestJS Internal Flow"
            NestApp --> Interceptor[Idempotency Interceptor]
            Interceptor --> Service[Wallet Logic / ACID Transactions]
            Service --> Repo[Raw SQL Repository]
        end
    end

    subgraph "Data Tier (AWS RDS PostgreSQL)"
        Repo --> DB[(PostgreSQL Engine)]
        
        subgraph "Tables & Invariants"
            DB --> Accounts[Accounts Table \n balance >= 0]
            DB --> Movements[Movements Ledger \n Append-Only]
            DB --> IdemTable[Idempotency Responses \n JSON Cache]
        end
    end

    style NestApp fill:#e1f5fe,stroke:#01579b
    style DB fill:#fff3e0,stroke:#e65100
    style Accounts fill:#fffde7,stroke:#fbc02d
    style Movements fill:#fffde7,stroke:#fbc02d
```
