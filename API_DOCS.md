# API Documentation

This document describes the API endpoints available in the HR Automation API.

## Base URL
The API is typically served at `http://localhost:3000` (depending on environment configuration).

## Authentication
Most endpoints require a JWT token.
Header: `Authorization: Bearer <token>`

---

## 1. Authentication
**Base path:** `/auth`

### Register
*   **Method:** `POST`
*   **Endpoint:** `/auth/register`
*   **Auth Required:** No
*   **Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "password123", // Min length 6
      "tenantName": "Optional Company Name"
    }
    ```

### Login
*   **Method:** `POST`
*   **Endpoint:** `/auth/login`
*   **Auth Required:** No
*   **Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "password123"
    }
    ```
*   **Response:** Returns JWT access token.

### Get Current User Profile
*   **Method:** `GET`
*   **Endpoint:** `/auth/me`
*   **Auth Required:** Yes
*   **Response:** Returns key user information based on the token.

### Forgot Password
*   **Method:** `POST`
*   **Endpoint:** `/auth/forgot-password`
*   **Auth Required:** No
*   **Body:**
    ```json
    {
      "email": "user@example.com"
    }
    ```

### Reset Password
*   **Method:** `POST`
*   **Endpoint:** `/auth/reset-password`
*   **Auth Required:** No
*   **Body:**
    ```json
    {
      "token": "reset-token-received-in-email",
      "newPassword": "newPassword123"
    }
    ```

---

## 2. Analytics
**Base path:** `/analytics`

### Get Dashboard Stats
*   **Method:** `GET`
*   **Endpoint:** `/analytics/dashboard`
*   **Auth Required:** Yes
*   **Response:** Aggregated dashboard statistics.

---

## 3. Conversations
**Base path:** `/conversations`

### List All Conversations
*   **Method:** `GET`
*   **Endpoint:** `/conversations`
*   **Auth Required:** Yes
*   **Response:** List of conversations associated with the tenant.

### Get One Conversation
*   **Method:** `GET`
*   **Endpoint:** `/conversations/:id`
*   **Auth Required:** Yes
*   **Parameters:**
    *   `id`: The ID of the conversation.

---

## 4. LinkedIn
**Base path:** `/linkedin`

### Get Linked Accounts
*   **Method:** `GET`
*   **Endpoint:** `/linkedin`
*   **Auth Required:** Yes
*   **Response:** List of linked LinkedIn accounts.

### Connect New Account
*   **Method:** `POST`
*   **Endpoint:** `/linkedin`
*   **Auth Required:** Yes
*   **Body:**
    ```json
    {
      "email": "linkedin-email@example.com",
      "password": "linkedin-password"
    }
    ```

### Submit 2FA Code
*   **Method:** `POST`
*   **Endpoint:** `/linkedin/2fa`
*   **Auth Required:** Yes
*   **Body:**
    ```json
    {
      "code": "123456"
    }
    ```

---

## 5. Settings
**Base path:** `/settings`

### Get Settings
*   **Method:** `GET`
*   **Endpoint:** `/settings`
*   **Auth Required:** Yes
*   **Response:** Current tenant settings.

### Update Settings
*   **Method:** `PATCH`
*   **Endpoint:** `/settings`
*   **Auth Required:** Yes
*   **Body:** JSON object with settings fields to update.

---

## 6. Orchestrator
**Base path:** `/orchestrator`

### Run Workflow Manually
*   **Method:** `POST`
*   **Endpoint:** `/orchestrator/run`
*   **Auth Required:** Yes
*   **Response:**
    ```json
    {
      "message": "Workflow triggered successfully"
    }
    ```

---

## 7. App (Health/General)
**Base path:** `/`

### Hello World
*   **Method:** `GET`
*   **Endpoint:** `/`
*   **Auth Required:** No
