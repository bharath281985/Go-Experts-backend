# Flutter Chat & FCM Notification Audit Report

## Realtime Chat (Socket.IO + REST Fallback)
- **Socket.IO Client:** `socket_io_client: ^3.1.2`
- **Events Traced:** `connect`, `authenticate`, `join_conversation`, `send_message`, `receive_message`, `typing`, `read_receipt`.
- **REST Fallback:** Clean polling fallback via `GET /chat/conversations/:id` if Socket.IO drops connection.
- **Status:** **WORKING**

## Firebase Cloud Messaging (FCM)
- **Firebase Initialization:** `firebase_core`, `firebase_messaging` configured in `lib/main.dart`.
- **Device Token Registration:** `POST /app/device-token` associates FCM token with active user session.
- **Targeted Push Notifications:** Server triggers FCM push notifications for new chat messages, proposal status changes, and payment completions.
- **Foreground / Background Handling:** Handled via `flutter_local_notifications`.
- **Status:** **WORKING**
