<!-- markdownlint-disable MD003 MD007 MD011 MD013 MD022 MD023 MD025 MD029 MD032 MD033 MD034 -->

# NEØ Dashboard

[![Dashboard CI](https://github.com/NEO-PROTOCOL/neo-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/NEO-PROTOCOL/neo-dashboard/actions/workflows/ci.yml)
![Last Commit](https://img.shields.io/github/last-commit/NEO-PROTOCOL/neo-dashboard?style=flat-square&color=2a76ff&labelColor=0d0d0d)
![License](https://img.shields.io/github/license/NEO-PROTOCOL/neo-dashboard?style=flat-square&color=2a76ff&labelColor=0d0d0d)
![Role](https://img.shields.io/badge/Role-Observability-2a76ff?style=flat-square&labelColor=0d0d0d)
![Deploy](https://img.shields.io/badge/Deploy-Railway-2a76ff?style=flat-square&logo=railway&logoColor=white&labelColor=0d0d0d)
![NEØ](https://img.shields.io/badge/NEØ-Protocol-2a76ff?style=flat-square&labelColor=0d0d0d)

Painel de comando operacional do ecossistema **NEØ PROTOCOL**.

Owner oficial: **NEØ MELLØ**.

Este projeto não foi desenhado para estética isolada. Ele existe para expor saúde da malha, detectar desconexão entre nós e reduzir tempo de resposta operacional.

> [!NOTE]
> Para detalhes técnicos de configuração, variáveis de ambiente e execução local, consulte o arquivo [SETUP.md](./SETUP.md).

## Propósito

- Consolidar observabilidade da stack NEØ PROTOCOL em uma interface única.
- Exibir estado de conectividade entre nós em tempo quase real.
- Servir como plano de comando para Nexus, automações, IA e operações.

## Acesso Rápido

- **Produção:** [dashboard.neoprotocol.space](https://dashboard.neoprotocol.space)
- **Grafo Vivo:** [/ecosystem-3d.html](https://dashboard.neoprotocol.space/ecosystem-3d.html)
- **Stack Analyzer:** [/stack-analyzer.html](https://dashboard.neoprotocol.space/stack-analyzer.html)

## Escopo e Limites

Este repositório representa o dashboard único do ecossistema NEØ PROTOCOL.

Não usar este projeto para mapear ou fundir a trilha externa `flowpay-core` dentro da stack NEØ. Essa fronteira é intencional.

---

### Governança

O desenvolvimento segue o fluxo de entrega oficial:
1. Branch de feature -> Pull Request.
2. Validação automática pelo CI (Dashboard CI).
3. Aprovação obrigatória (Code Owner).
4. Merge em `main` disparando deploy automatizado.

---

```
▓▓▓ NΞØ MELLØ
─────────────────────────────
Core Architect · NΞØ Protocol
neo@neoprotocol.space
```
```
     ▄       
  ▄██▄░                         
  █  █ █░    
  █ █░ █  
   ▀██▀  
   ▀░
```
