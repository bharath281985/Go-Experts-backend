# Flutter File Upload Forensic Audit Report

This report evaluates file and document uploads across all Flutter features.

## Upload Audit Matrix

| Feature | Endpoint | Multipart Field Name | Content Type / MIME | Status |
|---|---|---|---|---|
| **Avatar / Profile Photo** | `POST /files/upload` / `/freelancer/profile/avatar` | `file` / `avatar` | `image/jpeg`, `image/png` | **WORKING** |
| **Resume / CV** | `POST /freelancer/profile/resume` | `resume` | `application/pdf`, `application/msword` | **WORKING** |
| **Certificates** | `POST /freelancer/certificates` | `file` | `application/pdf`, `image/png` | **WORKING** |
| **Portfolio Covers & Videos** | `POST /freelancer/portfolio` | `cover`, `file` | `image/*`, `video/mp4` | **WORKING** |
| **Project Attachments** | `POST /files/upload` | `files` | `*/*` | **WORKING** |
| **Chat Attachments** | `POST /chat/attachments` | `file` | `image/*`, `application/pdf` | **WORKING** |
| **Pitch Deck / Business Plan** | `POST /founder/documents/upload` | `file` | `application/pdf` | **WORKING** |
