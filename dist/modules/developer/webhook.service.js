import crypto from "crypto";
import { prisma } from "../../config/database.js";
export class WebhookService {
    /**
     * Generates SHA-256 HMAC signature of the payload using webhook secret
     */
    static generateSignature(payload, secret) {
        return crypto.createHmac("sha256", secret).update(payload).digest("hex");
    }
    /**
     * Dispatch a webhook event asynchronously.
     * Finds all active webhooks subscribed to the event and triggers HTTP POST requests.
     */
    static async triggerEvent(event, payloadObj) {
        const payloadString = JSON.stringify(payloadObj);
        // Find all active webhooks subscribed to this event name
        const webhooks = await prisma.webhook.findMany({
            where: {
                status: "active",
                events: {
                    some: { event },
                },
            },
        });
        for (const hook of webhooks) {
            this.dispatchWebhook(hook.id, hook.url, hook.secret, event, payloadString).catch((err) => {
                console.error(`[WEBHOOK DISPATCH FAIL] Hook ID ${hook.id}:`, err?.message);
            });
        }
    }
    /**
     * Performs the HTTP request, measures latency, records logs, and handles retry queues
     */
    static async dispatchWebhook(webhookId, url, secret, event, payload, retryCount = 0) {
        const t0 = Date.now();
        const signature = this.generateSignature(payload, secret);
        let statusCode = null;
        let responseBody = "";
        let status = "failed";
        let error = null;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "GoExperts-Webhook-Engine/1.0",
                    "X-GoExperts-Event": event,
                    "X-GoExperts-Signature": signature,
                },
                body: payload,
            });
            statusCode = response.status;
            responseBody = await response.text();
            if (response.ok) {
                status = "success";
            }
            else {
                error = `HTTP error ${response.status}`;
            }
        }
        catch (err) {
            error = err.message || "Network request failed";
        }
        const duration = Date.now() - t0;
        // Log the delivery attempt in database
        await prisma.webhookDelivery.create({
            data: {
                webhookId,
                event,
                payload,
                statusCode,
                responseBody: responseBody.slice(0, 1000), // truncate long bodies
                duration,
                status,
                retryCount,
                error,
            },
        });
        // Handle retry logic if failed and max attempts not met (max 3 retries)
        if (status === "failed" && retryCount < 3) {
            const nextRetryMinutes = Math.pow(2, retryCount) * 5; // Exponential backoff: 5m, 10m, 20m
            const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000);
            // Schedule background execution using standard setTimeout
            const delayMs = nextRetryMinutes * 60 * 1000;
            setTimeout(() => {
                this.dispatchWebhook(webhookId, url, secret, event, payload, retryCount + 1).catch((err) => {
                    console.error(`[WEBHOOK RETRY FAIL] Hook ID ${webhookId}:`, err?.message);
                });
            }, delayMs);
            // Record next retry time on current delivery (for UI/Dashboard visualization)
            try {
                await prisma.webhookDelivery.updateMany({
                    where: { webhookId, event, status: "failed" },
                    data: { nextRetryAt },
                });
            }
            catch { }
        }
        return status === "success";
    }
    /**
     * Replays a previously failed delivery manually
     */
    static async replayDelivery(deliveryId) {
        const delivery = await prisma.webhookDelivery.findUnique({
            where: { id: deliveryId },
            include: { webhook: true },
        });
        if (!delivery) {
            throw new Error("Webhook delivery record not found.");
        }
        return this.dispatchWebhook(delivery.webhookId, delivery.webhook.url, delivery.webhook.secret, delivery.event, delivery.payload, 0 // reset retry count for manual replays
        );
    }
}
