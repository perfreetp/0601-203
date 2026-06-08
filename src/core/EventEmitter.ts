import {
  IEventEmitter,
  InteractionEventType,
  EventCallback,
  InteractionEvent
} from '../types';

export class EventEmitter implements IEventEmitter {
  private listeners: Map<InteractionEventType, Set<EventCallback>> = new Map();
  private sessionId: string;
  private userId?: string;

  constructor(sessionId: string, userId?: string) {
    this.sessionId = sessionId;
    this.userId = userId;
  }

  on(event: InteractionEventType, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: InteractionEventType, callback: EventCallback): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  once(event: InteractionEventType, callback: EventCallback): void {
    const onceCallback = (e: InteractionEvent) => {
      this.off(event, onceCallback);
      callback(e);
    };
    this.on(event, onceCallback);
  }

  emit(event: InteractionEventType, data?: Record<string, unknown>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const eventObj: InteractionEvent = {
        type: event,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        data
      };
      callbacks.forEach((callback) => {
        try {
          callback(eventObj);
        } catch (error) {
          console.error(`[EventEmitter] Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: InteractionEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  destroy(): void {
    this.removeAllListeners();
  }
}
