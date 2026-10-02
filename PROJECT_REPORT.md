# InsightDoc Project Report

**Repository:** `awais-ai-engineer/InsightDoc-RAG`  
**Active upgrade branch reviewed:** `production-upgrade`  
**Report date:** 2026-10-03  
**Status:** Production-oriented backend upgrade in progress

## 1. Project Overview

InsightDoc is evolving from a lightweight Streamlit/ChromaDB RAG prototype into a production-oriented document intelligence platform.

The current upgrade branch introduces a FastAPI backend, PostgreSQL with pgvector, authentication, persistent chat history, document management, workspaces, source-backed RAG responses, database migrations, and automated backend tests.

The core product goal is to let authenticated users upload documents, organize them, ask questions against their own document collection, and receive grounded answers with source metadata instead of unsupported model-generated responses.

## 2. Current Architecture

```text
Client / Frontend
      |
      v
FastAPI API
      |
      +--> Authentication
      +--> Document Management
      +--> Workspaces
      +--> Persistent Chats
      +--> RAG Query Pipeline
               |
               +--> Embedding Service
               +--> PostgreSQL + pgvector Retrieval
               +--> OpenRouter-compatible LLM
               +--> Source-backed Answer + Citations
```

### Infrastructure

- FastAPI API service
- PostgreSQL 17 with pgvector
- SQLAlchemy ORM
- Alembic migrations
- OpenRouter-compatible LLM integration
- Sentence Transformers embeddings
- Local document storage
- Docker Compose database service

## 3. Implemented Backend Features

### Authentication

The backend currently supports:

- User signup
- User login
- JWT access tokens
- Password hashing
- Authenticated `/auth/me` endpoint
- User-scoped access controls

### Document Management

The document API currently supports:

- PDF uploads
- TXT uploads
- DOCX uploads
- 50 MB upload limit
- MIME type and extension validation
- Document listing with pagination
- Individual document retrieval
- Document deletion
- Workspace assignment
- Automatic ingestion after upload
- Processing failure status handling

### RAG Pipeline

The production RAG flow includes:

1. Document ingestion
2. Text extraction
3. Chunk creation
4. Embedding generation
5. pgvector-backed semantic retrieval
6. User-scoped document filtering
7. Optional document-specific filtering
8. LLM answer generation
9. Source metadata returned with answers

The LLM system prompt explicitly instructs the model to answer only from retrieved document context and to state when the documents do not contain enough information.

### Persistent Chat

The backend includes persistent chat functionality:

- Create chat
- List chats
- Retrieve a chat with ordered messages
- Delete chat
- Submit user messages
- Store user and assistant messages
- Store citations with assistant responses
- Restrict selected documents to ready documents owned by the current user

If the configured LLM provider is unavailable, the API returns a service-unavailable response instead of pretending the request succeeded.

### Workspaces

Workspace support includes:

- Create workspace
- List workspaces
- Get workspace
- Update workspace
- Delete workspace
- Count documents per workspace
- Assign and unassign documents
- User ownership validation

## 4. Database and Persistence

The upgrade branch contains SQLAlchemy models for:

- Users
- Documents
- Document chunks
- Chats
- Messages
- Workspaces

Alembic migrations are present for the initial schema and later additions including chat history, message ordering, and workspaces.

PostgreSQL with pgvector replaces the original prototype's ChromaDB-oriented production path.

## 5. API Structure

The FastAPI application currently exposes versioned API modules for:

- `/api/v1/auth`
- `/api/v1/chat`
- `/api/v1/chats`
- `/api/v1/documents`
- `/api/v1/workspaces`

A health endpoint is also available:

```text
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "service": "insightdoc-api"
}
```

## 6. Testing

The repository currently includes backend test modules covering:

- Document workflows
- Chat queries
- Persistent chats
- Workspaces

The presence of tests is a strong production-readiness improvement over the original prototype. This report does not claim a current passing test count because test execution results are not stored in the reviewed repository snapshot.

## 7. Legacy Prototype vs Production Upgrade

The repository currently contains both the original prototype and the newer backend architecture.

### Legacy prototype

The root-level README and Streamlit files still describe:

- Streamlit
- ChromaDB
- Sentence Transformers
- PDF/TXT RAG
- Local modular Python application

### Production upgrade

The `production-upgrade` branch adds:

- FastAPI
- PostgreSQL
- pgvector
- Authentication
- Persistent chats
- Workspaces
- DOCX support
- Database migrations
- Backend tests
- More explicit provider-failure handling

This means the repository documentation is currently behind the production implementation and should be updated before the branch becomes the main portfolio version.

## 8. Current Repository Observations

Based on the reviewed remote `production-upgrade` branch:

- The production backend is present and significantly more advanced than the original prototype.
- The root README still documents the older Streamlit/ChromaDB architecture.
- Legacy `app.py` and `modules/` files still coexist with the production backend.
- No frontend directory is present in the current remote branch snapshot reviewed for this report.
- The latest reviewed branch commit focuses on backend configuration hardening and removing the legacy Chroma dependency from the production backend path.
- LLM functionality depends on valid provider configuration.
- The backend intentionally reports provider failure rather than returning fake successful AI responses.

## 9. Recommended Next Steps

1. Push the current production frontend to the repository if it exists locally but is not yet on the remote branch.
2. Replace or rewrite the root README so it accurately describes the FastAPI + PostgreSQL + pgvector architecture.
3. Decide whether legacy Streamlit files should remain as a prototype folder or be removed from the production branch.
4. Add a clear local-development setup for backend, database, and frontend.
5. Add deployment documentation and environment-variable guidance.
6. Add CI for backend tests.
7. Add API documentation examples for authentication, uploads, chat, citations, and workspaces.
8. Verify production database migrations from a clean database.
9. Add end-to-end tests covering signup -> upload -> ingestion -> chat -> citation flow.
10. Complete provider and deployment configuration without committing secrets.

## 10. Portfolio Positioning

InsightDoc can be presented as a production-style AI document intelligence SaaS rather than only a basic RAG demo.

The strongest engineering points currently visible in the repository are:

- End-to-end RAG pipeline
- PostgreSQL + pgvector semantic retrieval
- FastAPI backend architecture
- Authenticated user-scoped data
- Persistent chats and citations
- Workspaces and document organization
- Structured database migrations
- Failure-aware LLM integration
- Automated backend testing
- Migration from a prototype architecture toward a production service

## 11. Short Project Summary

> **InsightDoc** is a production-oriented document intelligence platform built with FastAPI, PostgreSQL, pgvector, and RAG. It supports authenticated document ingestion, semantic retrieval, persistent chats, source-backed answers, workspaces, and user-scoped document management while explicitly handling LLM provider failures instead of faking successful responses.

---

This report reflects the remote GitHub repository state reviewed on the `production-upgrade` branch on 2026-10-03.
