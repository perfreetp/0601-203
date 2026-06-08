import {
  AnalyticsConfig,
  AnalyticsEvent,
  AnalyticsBatchResult,
  AnalyticsState,
  InteractionEventType,
  InteractionEvent
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { generateId, isBrowser } from '../utils/helpers';

const DEFAULT_CONFIG = {
  enabled: false,
  endpoint: '',
  batchInterval: 5000,
  batchSize: 20,
  maxRetries: 3,
  retryDelay: 2000,
  headers: {},
  autoFlush: true,
  enableOfflineStorage: true
};

const STORAGE_KEY = 'metaverse_analytics_offline_events';
const STATE_KEY = 'metaverse_analytics_state';

export class AnalyticsManager {
  private config: AnalyticsConfig & typeof DEFAULT_CONFIG;
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private pendingEvents: AnalyticsEvent[] = [];
  private offlineEvents: AnalyticsEvent[] = [];
  private totalReported: number = 0;
  private totalFailed: number = 0;
  private lastFlushTime?: number;
  private flushTimer?: ReturnType<typeof setInterval>;
  private isFlushing: boolean = false;
  private initialized: boolean = false;
  private userId?: string;
  private sessionId?: string;
  private analyticsListener?: (event: InteractionEvent) => void;

  constructor(
    config: AnalyticsConfig,
    eventEmitter: EventEmitter,
    logger: Logger
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventEmitter = eventEmitter;
    this.logger = logger;

    this.loadOfflineStorage();

    if (this.config.enabled && this.config.autoFlush && isBrowser()) {
      this.startFlushTimer();
    }

    this.initialized = true;
    this.logger.log('AnalyticsManager: Initialized', {
      enabled: this.config.enabled,
      endpoint: this.config.endpoint,
      batchSize: this.config.batchSize
    });
  }

  setSession(sessionId: string, userId?: string): void {
    this.sessionId = sessionId;
    this.userId = userId;
    this.logger.log(`AnalyticsManager: Session set - ${sessionId}`);
  }

  track(
    eventType: string,
    properties?: Record<string, unknown>,
    sessionId?: string,
    userId?: string
  ): void {
    if (!this.initialized) return;

    const event: AnalyticsEvent = {
      eventId: generateId('evt'),
      eventType,
      timestamp: Date.now(),
      sessionId: sessionId || this.sessionId || '',
      userId: userId || this.userId,
      properties,
      retryCount: 0
    };

    this.pendingEvents.push(event);
    this.logger.debug(`AnalyticsManager: Tracked ${eventType}`);

    if (this.config.enabled && this.config.autoFlush) {
      if (this.pendingEvents.length >= this.config.batchSize) {
        void this.flush();
      }
    }
  }

  trackFromInteractionEvent(event: InteractionEvent): void {
    if (!this.initialized || !this.config.enabled) return;
    this.track(event.type, event.data, event.sessionId, event.userId);
  }

  startAutoTracking(): void {
    if (this.analyticsListener) return;

    const trackedTypes: InteractionEventType[] = [
      InteractionEventType.PRODUCT_VIEW,
      InteractionEventType.HOTSPOT_CLICK,
      InteractionEventType.COUPON_CLAIM,
      InteractionEventType.PURCHASE_INTENT,
      InteractionEventType.GAME_START,
      InteractionEventType.GAME_COMPLETE,
      InteractionEventType.SHARE,
      InteractionEventType.SCREENSHOT,
      InteractionEventType.FEEDBACK_SUBMIT,
      InteractionEventType.VISIT_START,
      InteractionEventType.VISIT_END,
      InteractionEventType.TOUR_START,
      InteractionEventType.TOUR_STEP_CHANGE,
      InteractionEventType.TOUR_STEP_COMPLETE,
      InteractionEventType.TOUR_COMPLETE,
      InteractionEventType.TOUR_PAUSE,
      InteractionEventType.TOUR_RESUME,
      InteractionEventType.BENEFIT_CENTER_OPEN,
      InteractionEventType.BENEFIT_CENTER_CLOSE,
      InteractionEventType.COUPON_SELECTED,
      InteractionEventType.BENEFIT_RESTORED,
      InteractionEventType.BENEFIT_AWARDED
    ];

    this.analyticsListener = (event: InteractionEvent) => {
      if (trackedTypes.includes(event.type as InteractionEventType)) {
        this.trackFromInteractionEvent(event);
      }
    };

    for (const type of trackedTypes) {
      this.eventEmitter.on(type, this.analyticsListener);
    }

    this.logger.log('AnalyticsManager: Auto-tracking started');
  }

  stopAutoTracking(): void {
    if (!this.analyticsListener) return;

    const allTypes = Object.values(InteractionEventType);
    for (const type of allTypes) {
      this.eventEmitter.off(type, this.analyticsListener);
    }
    this.analyticsListener = undefined;
    this.logger.log('AnalyticsManager: Auto-tracking stopped');
  }

  async flush(): Promise<AnalyticsBatchResult> {
    if (!this.config.enabled || this.isFlushing) {
      return { success: false, eventCount: 0 };
    }

    if (!this.config.endpoint) {
      this.logger.warn('AnalyticsManager: No endpoint configured, storing offline');
      this.moveToOffline(this.pendingEvents);
      this.pendingEvents = [];
      this.saveOfflineStorage();
      return { success: false, eventCount: 0, error: 'No endpoint configured' };
    }

    this.isFlushing = true;
    this.lastFlushTime = Date.now();

    const toFlush = [...this.pendingEvents, ...this.offlineEvents];
    this.pendingEvents = [];
    this.offlineEvents = [];

    if (toFlush.length === 0) {
      this.isFlushing = false;
      return { success: true, eventCount: 0 };
    }

    this.logger.log(`AnalyticsManager: Flushing ${toFlush.length} events`);

    try {
      const response = await this.sendBatch(toFlush);
      this.totalReported += toFlush.length;

      this.config.onBatchSuccess?.(toFlush, response);
      this.saveOfflineStorage();

      this.logger.log(`AnalyticsManager: Flush successful (${toFlush.length} events)`);
      this.isFlushing = false;
      return { success: true, eventCount: toFlush.length, response };
    } catch (error) {
      this.logger.warn(`AnalyticsManager: Flush failed, scheduling retry`, error);

      const eventsToRetry: AnalyticsEvent[] = [];
      const eventsToDrop: AnalyticsEvent[] = [];

      for (const event of toFlush) {
        const retryCount = (event.retryCount || 0) + 1;
        event.retryCount = retryCount;
        if (retryCount < this.config.maxRetries) {
          eventsToRetry.push(event);
        } else {
          eventsToDrop.push(event);
        }
      }

      this.totalFailed += eventsToDrop.length;
      this.offlineEvents = eventsToRetry;
      this.saveOfflineStorage();

      const retriesLeft = eventsToRetry.length > 0
        ? this.config.maxRetries - (eventsToRetry[0].retryCount || 0)
        : 0;

      this.config.onBatchFailure?.(toFlush, error, retriesLeft);

      this.isFlushing = false;
      return {
        success: false,
        eventCount: toFlush.length,
        failedEvents: eventsToDrop,
        error
      };
    }
  }

  private async sendBatch(events: AnalyticsEvent[]): Promise<unknown> {
    if (!isBrowser() || typeof fetch !== 'function') {
      throw new Error('Fetch API not available');
    }

    const response = await fetch(this.config.endpoint as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify({
        batchId: generateId('batch'),
        sentAt: Date.now(),
        events
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }

  flushOfflineEvents(): Promise<AnalyticsBatchResult> {
    if (this.offlineEvents.length > 0) {
      this.logger.log(`AnalyticsManager: Replaying ${this.offlineEvents.length} offline events`);
    }
    return this.flush();
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      if (this.pendingEvents.length > 0 || this.offlineEvents.length > 0) {
        void this.flush();
      }
    }, this.config.batchInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  private moveToOffline(events: AnalyticsEvent[]): void {
    this.offlineEvents.push(...events);
    const maxOffline = this.config.batchSize * 10;
    if (this.offlineEvents.length > maxOffline) {
      const excess = this.offlineEvents.length - maxOffline;
      this.offlineEvents = this.offlineEvents.slice(excess);
    }
  }

  private loadOfflineStorage(): void {
    if (!this.config.enableOfflineStorage || !isBrowser()) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.offlineEvents = JSON.parse(stored);
        this.logger.log(`AnalyticsManager: Loaded ${this.offlineEvents.length} offline events`);
      }
      const stateStr = localStorage.getItem(STATE_KEY);
      if (stateStr) {
        const state = JSON.parse(stateStr);
        this.totalReported = state.totalReported || 0;
        this.totalFailed = state.totalFailed || 0;
      }
    } catch (error) {
      this.logger.warn('AnalyticsManager: Failed to load offline storage', error);
    }
  }

  private saveOfflineStorage(): void {
    if (!this.config.enableOfflineStorage || !isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.offlineEvents));
      localStorage.setItem(STATE_KEY, JSON.stringify({
        totalReported: this.totalReported,
        totalFailed: this.totalFailed
      }));
    } catch (error) {
      this.logger.warn('AnalyticsManager: Failed to save offline storage', error);
    }
  }

  getPendingCount(): number {
    return this.pendingEvents.length;
  }

  getOfflineCount(): number {
    return this.offlineEvents.length;
  }

  getState(): AnalyticsState {
    return {
      pendingEvents: [...this.pendingEvents],
      offlineEvents: [...this.offlineEvents],
      lastFlushTime: this.lastFlushTime,
      totalReported: this.totalReported,
      totalFailed: this.totalFailed
    };
  }

  clearOfflineEvents(): void {
    this.offlineEvents = [];
    this.saveOfflineStorage();
  }

  async destroy(): Promise<void> {
    this.stopAutoTracking();
    this.stopFlushTimer();

    if (this.pendingEvents.length > 0 && this.config.enabled) {
      try {
        await this.flush();
      } catch (e) {
        this.moveToOffline(this.pendingEvents);
        this.pendingEvents = [];
        this.saveOfflineStorage();
      }
    }

    this.initialized = false;
    this.logger.log('AnalyticsManager: Destroyed');
  }
}
