# 🚀 Multi-Agent Orchestration Platform

Welcome to the **Multi-Agent Orchestration Platform**—a powerful, modular environment for building, managing, and orchestrating teams of AI agents.

## ✨ Features
- **Modular Monorepo**: Clean separation between UI, Backend, and Shared Libraries.
- **API-First Design**: Type-safe development from Spec to UI using OpenAPI and Zod.
- **Real-time Streaming**: Seamless task execution updates via Server-Sent Events (SSE).
- **Extensible Agent Personas**: Over 14+ domain-specific agent categories (Engineering, Marketing, Game Dev, etc.).
- **Modern UI**: Polished, motion-enhanced dashboard built with React and Tailwind CSS.

## 🏗️ Architecture
For a detailed look at how the project is structured and how components interact, please refer to the:
👉 **[Full Architecture Documentation (ARCHITECTURE.md)](./ARCHITECTURE.md)**

## 📂 Quick Start
1.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
2.  **Start Development**:
    ```bash
    pnpm dev
    ```

## 🗂️ Overview
- `artifacts/ai-platform`: Frontend Dashboard
- `artifacts/api-server`: Orchestrator Backend
- `lib/`: Shared type-safe libraries (`db`, `api-client`, `zod`)
- `agents/`: Domain-specific agent persona definitions

---
*Built with ❤️ for advanced AI orchestration.*
