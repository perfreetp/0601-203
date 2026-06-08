import {
  AvatarConfig,
  AvatarGesture,
  AnimationConfig,
  VoicePlaybackConfig,
  Vector3,
  Language,
  VoiceConfig,
  InteractionEventType,
  SubtitleConfig,
  AvatarGender
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { I18nManager } from './I18nManager';
import { ShowcaseManager } from './ShowcaseManager';
import { generateId, vector3, isBrowser } from '../utils/helpers';

export interface Avatar {
  id: string;
  name: string;
  config: AvatarConfig;
  position: Vector3;
  currentAnimation?: string;
  isSpeaking: boolean;
  isGreeting: boolean;
  createdAt: number;
  element?: HTMLElement;
  subtitleElement?: HTMLElement;
}

const GESTURE_EMOJI: Record<AvatarGesture, string> = {
  [AvatarGesture.WAVE]: '👋',
  [AvatarGesture.POINT]: '👆',
  [AvatarGesture.CLAP]: '👏',
  [AvatarGesture.THINK]: '🤔',
  [AvatarGesture.BOW]: '🙇',
  [AvatarGesture.HAND_SHAKE]: '🤝',
  [AvatarGesture.THUMBS_UP]: '👍',
  [AvatarGesture.HEART]: '❤️'
};

const GENDER_EMOJI: Record<AvatarGender, string> = {
  [AvatarGender.MALE]: '👨',
  [AvatarGender.FEMALE]: '👩',
  [AvatarGender.NEUTRAL]: '🧑'
};

export class AvatarManager {
  private avatars: Map<string, Avatar> = new Map();
  private activeAvatarId?: string;
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private i18n: I18nManager;
  private showcaseManager: ShowcaseManager;
  private audioEnabled: boolean;
  private currentPlayingAnimation?: string;
  private animationTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private audioTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private gestureAnimationTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    eventEmitter: EventEmitter,
    logger: Logger,
    i18n: I18nManager,
    showcaseManager: ShowcaseManager,
    audioEnabled: boolean = true
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.i18n = i18n;
    this.showcaseManager = showcaseManager;
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
    this.renderAvatarElement(avatar);

    if (!this.activeAvatarId) {
      this.activeAvatarId = avatar.id;
    }

    this.logger.log(`AvatarManager: Avatar ${avatar.id} created successfully`);
    return avatar;
  }

  private renderAvatarElement(avatar: Avatar): void {
    if (!isBrowser()) return;

    const avatarsLayer = this.showcaseManager.getAvatarsLayer();
    const uiLayer = this.showcaseManager.getUILayer();
    if (!avatarsLayer || !uiLayer) return;

    const { x, y, z } = avatar.position;
    const leftPct = 50 + x * 12;
    const bottomPct = 10 + y * 8;
    const zIndex = Math.round(50 - z * 8);

    const el = document.createElement('div');
    el.className = 'mv-avatar';
    el.dataset.avatarId = avatar.id;
    el.style.cssText = `
      position: absolute;
      left: ${leftPct}%;
      bottom: ${bottomPct}%;
      transform: translateX(-50%) translateZ(${z * 40}px);
      z-index: ${zIndex};
      pointer-events: auto;
      transition: transform 0.3s ease;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    `;

    const avatarBody = document.createElement('div');
    avatarBody.className = 'mv-avatar-body';
    avatarBody.style.cssText = `
      width: 100px;
      height: 160px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      position: relative;
    `;

    const head = document.createElement('div');
    head.className = 'mv-avatar-head';
    const gender = avatar.config.gender || AvatarGender.NEUTRAL;
    head.style.cssText = `
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ffe0bd 0%, #ffdbac 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      border: 3px solid #fff;
      margin-bottom: -4px;
    `;
    head.textContent = GENDER_EMOJI[gender];
    avatarBody.appendChild(head);

    const nameTag = document.createElement('div');
    nameTag.style.cssText = `
      position: absolute;
      top: -28px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #fff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      white-space: nowrap;
    `;
    nameTag.textContent = avatar.name;
    avatarBody.appendChild(nameTag);

    const body = document.createElement('div');
    body.className = 'mv-avatar-torso';
    body.style.cssText = `
      width: 80px;
      height: 100px;
      background: linear-gradient(180deg, #4a90d9 0%, #357abd 100%);
      border-radius: 40px 40px 12px 12px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    avatarBody.appendChild(body);

    const gestureDisplay = document.createElement('div');
    gestureDisplay.className = 'mv-avatar-gesture';
    gestureDisplay.style.cssText = `
      position: absolute;
      top: 20px;
      right: -20px;
      font-size: 32px;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.3s ease;
    `;
    avatarBody.appendChild(gestureDisplay);

    const greetingBadge = document.createElement('div');
    greetingBadge.className = 'mv-avatar-greeting';
    greetingBadge.style.cssText = `
      position: absolute;
      top: -10px;
      right: -10px;
      background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
      color: #fff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      opacity: 0;
      transform: scale(0.8);
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(238,90,90,0.4);
    `;
    greetingBadge.textContent = '✨ 迎宾中';
    avatarBody.appendChild(greetingBadge);

    const speakingIndicator = document.createElement('div');
    speakingIndicator.className = 'mv-avatar-speaking';
    speakingIndicator.style.cssText = `
      position: absolute;
      bottom: 80px;
      display: flex;
      gap: 3px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    for (let i = 0; i < 3; i++) {
      const bar = document.createElement('div');
      bar.style.cssText = `
        width: 4px;
        height: 12px;
        background: #4a90d9;
        border-radius: 2px;
        animation: mv-speech 0.6s ease-in-out infinite;
        animation-delay: ${i * 0.15}s;
      `;
      speakingIndicator.appendChild(bar);
    }
    avatarBody.appendChild(speakingIndicator);

    container.appendChild(avatarBody);
    el.appendChild(container);

    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'mv-avatar-subtitle';
    subtitleEl.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: calc(${bottomPct}% + 180px);
      max-width: 280px;
      min-width: 140px;
      background: rgba(0,0,0,0.82);
      color: #fff;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      text-align: center;
      z-index: ${zIndex + 10};
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
      backdrop-filter: blur(8px);
    `;
    uiLayer.appendChild(subtitleEl);

    const styleEl = document.getElementById('mv-avatar-styles');
    if (!styleEl && isBrowser()) {
      const style = document.createElement('style');
      style.id = 'mv-avatar-styles';
      style.textContent = `
        @keyframes mv-speech {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        @keyframes mv-gesture-bounce {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.3) rotate(10deg); }
        }
        @keyframes mv-greet-pulse {
          0%, 100% { box-shadow: 0 2px 8px rgba(238,90,90,0.4); }
          50% { box-shadow: 0 2px 20px rgba(238,90,90,0.8); }
        }
      `;
      document.head.appendChild(style);
    }

    avatarsLayer.appendChild(el);
    avatar.element = el;
    avatar.subtitleElement = subtitleEl;
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
    this.gestureAnimationTimers.forEach((timer, key) => {
      if (key.startsWith(avatarId)) {
        clearTimeout(timer);
        this.gestureAnimationTimers.delete(key);
      }
    });

    const avatar = this.avatars.get(avatarId);
    if (avatar) {
      avatar.element?.remove();
      avatar.subtitleElement?.remove();
    }

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

      if (avatar.element) {
        const body = avatar.element.querySelector('.mv-avatar-body');
        if (body) {
          (body as HTMLElement).style.animation = `mv-speech 0.5s ease-in-out infinite`;
        }
      }

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
          if (avatar.element) {
            const body = avatar.element.querySelector('.mv-avatar-body');
            if (body) {
              (body as HTMLElement).style.animation = '';
            }
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
    return new Promise((resolve) => {
      const targetAvatarId = avatarId || this.activeAvatarId;
      if (!targetAvatarId) {
        resolve();
        return;
      }

      const avatar = this.avatars.get(targetAvatarId);
      if (!avatar || !avatar.element) {
        resolve();
        return;
      }

      const gestureEl = avatar.element.querySelector('.mv-avatar-gesture') as HTMLElement;
      if (gestureEl) {
        gestureEl.textContent = GESTURE_EMOJI[gesture];
        gestureEl.style.opacity = '1';
        gestureEl.style.transform = 'scale(1)';
        gestureEl.style.animation = 'mv-gesture-bounce 0.6s ease-in-out infinite';
      }

      const gestureAnimationConfig: AnimationConfig = {
        name: `gesture_${gesture}`,
        loop: false,
        duration: 2000
      };

      const timerKey = `${targetAvatarId}_gesture`;
      const existingTimer = this.gestureAnimationTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      this.playAnimation(gestureAnimationConfig, targetAvatarId).then(() => {
        if (gestureEl) {
          gestureEl.style.opacity = '0';
          gestureEl.style.transform = 'scale(0.5)';
          gestureEl.style.animation = '';
        }
        resolve();
      });

      const timer = setTimeout(() => {
        if (gestureEl) {
          gestureEl.style.opacity = '0';
          gestureEl.style.transform = 'scale(0.5)';
          gestureEl.style.animation = '';
        }
        this.gestureAnimationTimers.delete(timerKey);
      }, 2500);
      this.gestureAnimationTimers.set(timerKey, timer);
    });
  }

  stopAnimation(avatarId?: string): void {
    const targetAvatarId = avatarId || this.activeAvatarId;
    if (!targetAvatarId) return;

    const avatar = this.avatars.get(targetAvatarId);
    if (avatar) {
      avatar.currentAnimation = undefined;
      if (avatar.element) {
        const body = avatar.element.querySelector('.mv-avatar-body') as HTMLElement;
        const gestureEl = avatar.element.querySelector('.mv-avatar-gesture') as HTMLElement;
        if (body) body.style.animation = '';
        if (gestureEl) {
          gestureEl.style.opacity = '0';
          gestureEl.style.animation = '';
        }
      }
    }

    this.animationTimers.forEach((timer, key) => {
      if (key.startsWith(targetAvatarId)) {
        clearTimeout(timer);
        this.animationTimers.delete(key);
      }
    });
    this.gestureAnimationTimers.forEach((timer, key) => {
      if (key.startsWith(targetAvatarId)) {
        clearTimeout(timer);
        this.gestureAnimationTimers.delete(key);
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

    if (avatar.element) {
      const greetingBadge = avatar.element.querySelector('.mv-avatar-greeting') as HTMLElement;
      if (greetingBadge) {
        greetingBadge.style.opacity = '1';
        greetingBadge.style.transform = 'scale(1)';
        greetingBadge.style.animation = 'mv-greet-pulse 1.2s ease-in-out infinite';
      }
    }

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
      if (avatar.element) {
        const greetingBadge = avatar.element.querySelector('.mv-avatar-greeting') as HTMLElement;
        if (greetingBadge) {
          greetingBadge.style.opacity = '0';
          greetingBadge.style.transform = 'scale(0.8)';
          greetingBadge.style.animation = '';
        }
      }
    }, 3500);
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

      let subtitleText = '';
      if (config.subtitles && config.subtitles.length > 0) {
        const currentLang = this.i18n.getLanguage();
        const subtitle = config.subtitles.find((s) => s.language === currentLang) ||
          config.subtitles.find((s) => s.language === Language.ZH_CN) ||
          config.subtitles[0];
        if (subtitle) {
          subtitleText = subtitle.text;
          const subConfig: SubtitleConfig = {
            language: subtitle.language,
            text: subtitle.text
          };
          this.i18n.setSubtitle(subConfig);
        }
      } else if (config.text) {
        subtitleText = config.text;
        const subtitle: SubtitleConfig = {
          language: this.i18n.getLanguage(),
          text: config.text
        };
        this.i18n.setSubtitle(subtitle);
      }

      if (avatar.subtitleElement && subtitleText) {
        avatar.subtitleElement.textContent = subtitleText;
        avatar.subtitleElement.style.opacity = '1';
      }

      if (avatar.element) {
        const speakingIndicator = avatar.element.querySelector('.mv-avatar-speaking') as HTMLElement;
        if (speakingIndicator) {
          speakingIndicator.style.opacity = '1';
        }
      }

      this.logger.log(`AvatarManager: Avatar ${targetAvatarId} speaking`, config.text || config.audioUrl);

      const timerKey = `${targetAvatarId}_speech`;
      const existingTimer = this.audioTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const estimatedDuration = config.text ? Math.max(config.text.length * 150, 2000) : 3000;
      const timer = setTimeout(() => {
        avatar.isSpeaking = false;
        this.i18n.clearSubtitle();
        if (avatar.subtitleElement) {
          avatar.subtitleElement.style.opacity = '0';
        }
        if (avatar.element) {
          const speakingIndicator = avatar.element.querySelector('.mv-avatar-speaking') as HTMLElement;
          if (speakingIndicator) {
            speakingIndicator.style.opacity = '0';
          }
        }
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
      if (avatar.subtitleElement) {
        avatar.subtitleElement.style.opacity = '0';
      }
      if (avatar.element) {
        const speakingIndicator = avatar.element.querySelector('.mv-avatar-speaking') as HTMLElement;
        if (speakingIndicator) {
          speakingIndicator.style.opacity = '0';
        }
      }
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
      if (avatar.element) {
        const { x, y, z } = position;
        const leftPct = 50 + x * 12;
        const bottomPct = 10 + y * 8;
        avatar.element.style.left = `${leftPct}%`;
        avatar.element.style.bottom = `${bottomPct}%`;
        avatar.element.style.transform = `translateX(-50%) translateZ(${z * 40}px)`;
      }
      if (avatar.subtitleElement) {
        const bottomPct = 10 + position.y * 8;
        avatar.subtitleElement.style.bottom = `calc(${bottomPct}% + 180px)`;
      }
      this.logger.log(`AvatarManager: Avatar ${avatarId} position updated`);
    }
  }

  updateAvatarConfig(avatarId: string, updates: Partial<AvatarConfig>): void {
    const avatar = this.avatars.get(avatarId);
    if (avatar) {
      avatar.config = { ...avatar.config, ...updates };
      if (updates.name && avatar.element) {
        const nameTag = avatar.element.querySelector('.mv-avatar-body > div:nth-child(2)') as HTMLElement;
        if (nameTag) {
          nameTag.textContent = updates.name;
        }
      }
      if (updates.position) {
        this.updateAvatarPosition(avatarId, updates.position);
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
    this.gestureAnimationTimers.forEach((timer) => clearTimeout(timer));
    this.gestureAnimationTimers.clear();

    this.avatars.forEach((avatar) => {
      avatar.element?.remove();
      avatar.subtitleElement?.remove();
    });
    this.avatars.clear();
    this.activeAvatarId = undefined;
    this.currentPlayingAnimation = undefined;
    this.logger.log('AvatarManager: Destroyed');
  }
}
