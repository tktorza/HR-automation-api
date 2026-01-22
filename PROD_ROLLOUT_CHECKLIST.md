# Production Rollout Checklist

This file tracks the temporary configurations applied for testing the LinkedIn Reply System.
**Status**: [TESTING]

## Temporary Changes (To Revert)

1.  **Orchestrator Service (`src/orchestrator/orchestrator.service.ts`)**
    *   [ ] Re-enable `@Cron(CronExpression.EVERY_10_MINUTES)` decorator on `handleCron`.
    *   [ ] Set `DRY_RUN_MODE = false`.
    *   [ ] Set `MAX_UNREAD_LIMIT = 20` (or desired production batch size).

## Feature Logic Summary

*   **Persistence**: Messages are scraped and saved to DB with `processingStatus = 'PENDING_LLM'` *before* any processing.
*   **Context**: Code attempts to use cached conversations or partial scrape to build context for LLM.
*   **Drafting**: LLM generates a response which is saved as an `LlmAction` with `actionType='REPLY_SUGGESTION'` and status `DRAFT`.
*   **Replying**: The system navigates to the `threadUrl` stored in the Conversation.
    *   If `DRY_RUN_MODE` is true, it types the message and logs it but **does not click send**.
    *   If `DRY_RUN_MODE` is false, it sends the reply.

## Testing Steps

1.  Trigger workflow manually: `POST /orchestrator/run`
2.  Check logs (`docker logs` or console) to see:
    *   "Scraped X active conversations"
    *   "Persisted URL ... with status PENDING_LLM"
    *   "Generated draft ... Status -> PENDING_REPLY"
    *   "[DRY RUN] Would have sent message: ..."
3.  Verify Database:
    *   Check `conversations` table for `thread_url` and `processing_status`.
    *   Check `llm_actions` for the generated draft.
