import {
  AvatarConfig,
  AvatarGesture,
  AnimationConfig,
  VoicePlaybackConfig,
  Vector3,
  Language,
  VoiceConfig,
  InteractionEventType,
  SubtitleConfig
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { I18nManager } from './I18nManager';
import { generateId, vector3 } from '../utils/helpers';

export interface Avatar {
  id: string;
  name: string;
  config: AvatarConfig;
  position: Vector3;
  currentAnimation?: string;
  isSpeaking: boolean;
  isGreeting: boolean;
  createdAt: number;
}

export class AvatarManager {
  private avatars: Map<string, Avatar> = new Map();
  private activeAvatarId?: string;
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private i18n: I18nManager;
  private audioEnabled: boolean;
  private currentPlayingAnimation?: string;
  private animationTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private audioTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    eventEmitter: EventEmitter,
    logger: Logger,
    i18n: I18nManager,
    audioEnabled: boolean = true
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.i18n = i18n;
    this.audioEnabled = audioEnabled;
  }

  async createAvatar(config: AvatarConfig): Promise<Avatar> {
    this.logger.log(`AvatarManager: Creating avatar ${config.name || 'unnamed'}`);

    const avatar: Avatar = {
      id: config.id || generateId('avatar'),
      name: config.name || '数字导购员',
      config,
      position: config.position || vector3(0, 0, -2),
      isSpeaking: false,
      isGreeting: false,
      createdAt: Date.now()
    };

    this.avatars.set(avatar.id, avatar);

    if (!this.activeAvatarId) {
      this.activeAvatarId = avatar.id;
    }

    this.logger.log(`AvatarManager: Avatar ${avatar.id} created successfully`);
    return avatar;
  }

  getAvatar(avatarId: string): Avatar | undefined {
    return this.avatars.get(avatarId);
  }

  getActiveAvatar(): Avatar | undefined {
    return this.activeAvatarId ? this.avatars.get(this.activeAvatarId) : undefined;
  }

  setActiveAvatar(avatarId: string): boolean {
    if (this.avatars.has(avatarId)) {
      this.activeAvatarId = avatarId;
      this.logger.log(`AvatarManager: Active avatar set to ${avatarId}`);
      return true;
    }
    this.logger.warn(`AvatarManager: Avatar ${avatarId} not found`);
    return false;
  }

  getAllAvatars(): Avatar[] {
    return Array.from(this.avatars.values());
  }

  removeAvatar(avatarId: string): boolean {
    this.animationTimers.forEach((timer, key) => {
      if (key.startsWith(avatarId)) {
        clearTimeout(timer);
        this.animationTimers.delete(key);
      }
    });
    this.audioTimers.forEach((timer, key) => {
      if (key.startsWith(avatarId)) {
        clearTimeout(timer);
        this.audioTimers.delete(key);
      }
    });

    const removed = this.avatars.delete(avatarId);
    if (removed && this.activeAvatarId === avatarId) {
      this.activeAvatarId = this.avatars.keys().next().value;
    }
    if (removed) {
      this.logger.log(`AvatarManager: Avatar ${avatarId} removed`);
    }
    return removed;
  }

  playAnimation(animation: AnimationConfig, avatarId?: string): Promise<void> {
    return new Promise((resolve) => {
      const targetAvatarId = avatarId || this.activeAvatarId;
      if (!targetAvatarId) {
        this.logger.warn('AvatarManager: No active avatar for animation');
        resolve();
        return;
      }

      const avatar = this.avatars.get(targetAvatarId);
      if (!avatar) {
        this.logger.warn(`AvatarManager: Avatar ${targetAvatarId} not found`);
        resolve();
        return;
      }

      avatar.currentAnimation = animation.name;
      this.currentPlayingAnimation = animation.name;
      this.logger.log(`AvatarManager: Playing animation '${animation.name}' for avatar ${targetAvatarId}`);

      const timerKey = `${targetAvatarId}_${animation.name}`;
      const existingTimer = this.animationTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      if (!animation.loop && animation.duration) {
        const timer = setTimeout(() => {
          avatar.currentAnimation = undefined;
          if (this.currentPlayingAnimation === animation.name) {
            this.currentPlayingAnimation = undefined;
          }
          this.animationTimers.delete(timerKey);
          if (animation.onComplete) {
            animation.onComplete();
          }
          resolve();
        }, animation.duration);
        this.animationTimers.set(timerKey, timer);
      } else {
        resolve();
      }
    });
  }

  playGesture(gesture: AvatarGesture, avatarId?: string): Promise<void> {
    const gestureAnimationMap: Record<AvatarGesture, AnimationConfig> = {
      [AvatarGesture.WAVE]: { name: 'wave', loop: false, duration: 2000 },
      [AvatarGesture.POINT]: { name: 'point', loop: false, duration: 1500 },
      [AvatarGesture.CLAP]: { name: 'clap', loop: false, duration: 2000 },
      [AvatarGesture.THINK]: { name: 'think', loop: true, duration: 3000 },
      [AvatarGesture.BOW]: { name: 'bow', loop: false, duration: 1500 },
      [AvatarGesture.HAND_SHAKE]: { name: 'hand_shake', loop: false, duration: 2000 },
      [AvatarGesture.THUMBS_UP]: { name: 'thumbs_up', loop: false, duration: 1500 },
      [AvatarGesture.HEART]: { name: 'heart', loop: false, duration: 2000 }
    };

    const config = gestureAnimationMap[gesture];
    this.logger.log(`AvatarManager: Playing gesture ${gesture}`);
    return this.playAnimation(config, avatarId);
  }

  stopAnimation(avatarId?: string): void {
    const targetAvatarId = avatarId || this.activeAvatarId;
    if (!targetAvatarId) return;

    const avatar = this.avatars.get(targetAvatarId);
    if (avatar) {
      avatar.currentAnimation = undefined;
    }

    this.animationTimers.forEach((timer, key) => {
      if (key.startsWith(targetAvatarId)) {
        clearTimeout(timer);
        this.animationTimers.delete(key);
      }
    });

    this.logger.log(`AvatarManager: Animation stopped for avatar ${targetAvatarId}`);
  }

  async greet(avatarId?: string): Promise<void> {
    const targetAvatarId = avatarId || this.activeAvatarId;
    if (!targetAvatarId) {
      this.logger.warn('AvatarManager: No active avatar for greeting');
      return;
    }

    const avatar = this.avatars.get(targetAvatarId);
    if (!avatar) {
      this.logger.warn(`AvatarManager: Avatar ${targetAvatarId} not found`);
      return;
    }

    avatar.isGreeting = true;
    this.logger.log(`AvatarManager: Avatar ${targetAvatarId} is greeting`);

    const greetingText = avatar.config.greetingText || this.i18n.t('greeting.default');

    await Promise.all([
      this.playGesture(AvatarGesture.WAVE, targetAvatarId),
      this.speak({ text: greetingText }, targetAvatarId)
    ]);

    this.eventEmitter.emit(InteractionEventType.AVATAR_INTERACT, {
      avatarId: targetAvatarId,
      action: 'greet',
      text: greetingText
    });

    setTimeout(() => {
      avatar.isGreeting = false;
    }, 3000);
  }

  async introduceProduct(productName: string, avatarId?: string): Promise<void> {
    const introText = this.i18n.t('greeting.product').replace('{product}', productName);

    await Promise.all([
      this.playGesture(AvatarGesture.POINT, avatarId),
      this.speak({ text: introText }, avatarId)
    ]);

    this.eventEmitter.emit(InteractionEventType.AVATAR_INTERACT, {
      avatarId: avatarId || this.activeAvatarId,
      action: 'introduce_product',
      productName,
      text: introText
    });
  }

  async speak(config: VoicePlaybackConfig, avatarId?: string): Promise<void> {
    return new Promise((resolve) => {
      const targetAvatarId = avatarId || this.activeAvatarId;
      if (!targetAvatarId) {
        this.logger.warn('AvatarManager: No active avatar for speaking');
        resolve();
        return;
      }

      const avatar = this.avatars.get(targetAvatarId);
      if (!avatar) {
        resolve();
        return;
      }

      avatar.isSpeaking = true;

      if (config.subtitles && config.subtitles.length > 0) {
        const currentLang = this.i18n.getLanguage();
        const subtitle = config.subtitles.find((s) => s.language === currentLang) ||
          config.subtitles.find((s) => s.language === Language.ZH_CN) ||
          config.subtitles[0];
        if (subtitle) {
          this.i18n.setSubtitle(subtitle);
        }
      } else if (config.text) {
        const subtitle: SubtitleConfig = {
          language: this.i18n.getLanguage(),
          text: config.text
        };
        this.i18n.setSubtitle(subtitle);
      }

      this.logger.log(`AvatarManager: Avatar ${targetAvatarId} speaking`, config.text || config.audioUrl);

      const timerKey = `${targetAvatarId}_speech`;
      const existingTimer = this.audioTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const estimatedDuration = config.text ? Math.max(config.text.length * 200, 2000) : 3000;
      const timer = setTimeout(() => {
        avatar.isSpeaking = false;
        this.i18n.clearSubtitle();
        this.audioTimers.delete(timerKey);
        if (config.onComplete) {
          config.onComplete();
        }
        resolve();
      }, estimatedDuration);
      this.audioTimers.set(timerKey, timer);
    });
  }

  stopSpeaking(avatarId?: string): void {
    const targetAvatarId = avatarId || this.activeAvatarId;
    if (!targetAvatarId) return;

    const avatar = this.avatars.get(targetAvatarId);
    if (avatar) {
      avatar.isSpeaking = false;
    }

    this.i18n.clearSubtitle();

    const timerKey = `${targetAvatarId}_speech`;
    const timer = this.audioTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.audioTimers.delete(timerKey);
    }

    this.logger.log(`AvatarManager: Avatar ${targetAvatarId} stopped speaking`);
  }

  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
    this.logger.log(`AvatarManager: Audio ${enabled ? 'enabled' : 'disabled'}`);
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  updateAvatarPosition(avatarId: string, position: Vector3): void {
    const avatar = this.avatars.get(avatarId);
    if (avatar) {
      avatar.position = position;
      this.logger.log(`AvatarManager: Avatar ${avatarId} position updated`);
    }
  }

  updateAvatarConfig(avatarId: string, updates: Partial<AvatarConfig>): void {
    const avatar = this.avatars.get(avatarId);
    if (avatar) {
      avatar.config = { ...avatar.config, ...updates };
      if (updates.name) {
        avatar.name = updates.name;
      }
      if (updates.position) {
        avatar.position = updates.position;
      }
      this.logger.log(`AvatarManager: Avatar ${avatarId} config updated`);
    }
  }

  getVoiceConfig(avatarId?: string): VoiceConfig | undefined {
    const targetAvatarId = avatarId || this.activeAvatarId;
    const avatar = targetAvatarId ? this.avatars.get(targetAvatarId) : undefined;
    return avatar?.config.voice;
  }

  isAvatarReady(avatarId?: string): boolean {
    const targetAvatarId = avatarId || this.activeAvatarId;
    return targetAvatarId ? this.avatars.has(targetAvatarId) : false;
  }

  destroy(): void {
    this.animationTimers.forEach((timer) => clearTimeout(timer));
    this.animationTimers.clear();
    this.audioTimers.forEach((timer) => clearTimeout(timer));
    this.audioTimers.clear();
    this.avatars.clear();
    this.activeAvatarId = undefined;
    this.currentPlayingAnimation = undefined;
    this.logger.log('AvatarManager: Destroyed');
  }
}
