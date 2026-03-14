/**
 * Connection Manager com Retry, Connection Pooling e Circuit Breaker
 * Solução para "Connection reset by peer" e "High latency"
 */

import http from 'http';
import https from 'https';

// ──────────────────────────────────────────────────────────────
// Agent Pool Configuration (TCP KeepAlive + Connection Pooling)
// ──────────────────────────────────────────────────────────────

const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
});

function getAgent(url) {
    return url.startsWith('https') ? httpsAgent : httpAgent;
}

// ──────────────────────────────────────────────────────────────
// Retry Logic com Exponential Backoff
// ──────────────────────────────────────────────────────────────

class RetryStrategy {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.initialDelay = options.initialDelay || 100; // ms
        this.maxDelay = options.maxDelay || 5000; // ms
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.timeout = options.timeout || 10000; // ms
        this.retryOn = options.retryOn || [408, 429, 500, 502, 503, 504]; // HTTP status codes
    }

    async execute(fetchFn, context = {}) {
        let lastError;
        let lastResponse;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this._fetchWithTimeout(fetchFn, context);

                // Se status não é retryable, retornar imediatamente
                if (response.ok || !this.retryOn.includes(response.status)) {
                    return response;
                }

                // Se é retryable e não é último retry, continuar
                if (attempt < this.maxRetries) {
                    lastResponse = response;
                    const delay = this._calculateDelay(attempt);
                    console.warn(
                        `[RETRY] Status ${response.status} - Attempt ${attempt + 1}/${this.maxRetries + 1}. ` +
                        `Retrying in ${delay}ms...`,
                        context.url || ''
                    );
                    await this._sleep(delay);
                    continue;
                }

                // Último retry falhou, retornar resposta
                return response;
            } catch (error) {
                lastError = error;

                // Se é erro de rede/timeout e não é último retry
                if (attempt < this.maxRetries) {
                    const delay = this._calculateDelay(attempt);
                    console.warn(
                        `[RETRY] Network error: ${error.message} - Attempt ${attempt + 1}/${this.maxRetries + 1}. ` +
                        `Retrying in ${delay}ms...`,
                        context.url || ''
                    );
                    await this._sleep(delay);
                    continue;
                }

                // Último retry com erro de rede
                throw error;
            }
        }

        // Se chegou aqui, falhou todas as tentativas
        if (lastResponse) return lastResponse;
        throw lastError || new Error('All retry attempts failed');
    }

    async _fetchWithTimeout(fetchFn, context) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Fetch timeout after ${this.timeout}ms`));
            }, this.timeout);

            fetchFn()
                .then(response => {
                    clearTimeout(timer);
                    resolve(response);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    _calculateDelay(attemptNumber) {
        const exponentialDelay = this.initialDelay * Math.pow(this.backoffMultiplier, attemptNumber);
        // Adicionar jitter (aleatoriedade) para evitar thundering herd
        const jitter = Math.random() * 0.1 * exponentialDelay;
        const delay = Math.min(exponentialDelay + jitter, this.maxDelay);
        return Math.floor(delay);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ──────────────────────────────────────────────────────────────
// Enhanced Fetch com Retry e Connection Pooling
// ──────────────────────────────────────────────────────────────

export async function fetchWithRetry(url, options = {}) {
    const retryConfig = options.retryConfig || {};
    const strategy = new RetryStrategy(retryConfig);

    return strategy.execute(
        () => fetch(url, {
            ...options,
            agent: getAgent(url),
            headers: {
                'Connection': 'keep-alive',
                ...options.headers
            }
        }),
        { url }
    );
}

// ──────────────────────────────────────────────────────────────
// Circuit Breaker Avançado
// ──────────────────────────────────────────────────────────────

export class CircuitBreaker {
    constructor(options = {}) {
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.successCount = 0;
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 2;
        this.timeout = options.timeout || 60000; // ms
        this.lastFailureTime = null;
        this.metrics = {
            totalRequests: 0,
            totalFailures: 0,
            totalSuccess: 0,
            stateChanges: []
        };
    }

    async execute(fn, context = {}) {
        this.metrics.totalRequests++;

        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this._setState('HALF_OPEN');
                console.log(`[CIRCUIT] HALF_OPEN - Testing connection: ${context.url || 'unknown'}`);
            } else {
                const error = new Error('Circuit breaker is OPEN - Service temporarily unavailable');
                error.code = 'CIRCUIT_OPEN';
                throw error;
            }
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (error) {
            this._onFailure(error, context);
            throw error;
        }
    }

    _onSuccess() {
        this.metrics.totalSuccess++;
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this._setState('CLOSED');
                console.log('[CIRCUIT] CLOSED - Service recovered');
            }
        }
    }

    _onFailure(error, context) {
        this.metrics.totalFailures++;
        this.lastFailureTime = Date.now();
        this.failureCount++;

        console.error(
            `[CIRCUIT] Failure #${this.failureCount}/${this.failureThreshold}: ${error.message}`,
            context.url || ''
        );

        if (this.failureCount >= this.failureThreshold && this.state !== 'OPEN') {
            this._setState('OPEN');
            console.error(
                `[CIRCUIT] OPEN - Too many failures (${this.failureCount}). ` +
                `Circuit will retry in ${this.timeout}ms`
            );
        }
    }

    _setState(newState) {
        if (this.state !== newState) {
            this.metrics.stateChanges.push({
                timestamp: new Date().toISOString(),
                from: this.state,
                to: newState
            });
            this.state = newState;
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            currentState: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount
        };
    }

    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        console.log('[CIRCUIT] Reset to CLOSED');
    }
}

export default {
    fetchWithRetry,
    CircuitBreaker,
    RetryStrategy,
    getAgent
};
