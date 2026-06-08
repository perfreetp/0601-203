import {
  SceneTheme,
  LightPreset,
  Product,
  CameraConfig,
  LightConfig,
  CustomThemeConfig,
  Vector3,
  PerformanceLevel,
  InteractionEventType
} from '../types';
import { EventEmitter } from '../core/EventEmitter';
import { Logger } from '../core/Logger';
import { vector3, mergeDeep, isBrowser } from '../utils/helpers';

const DEFAULT_CAMERA_CONFIG: Required<CameraConfig> = {
  position: { x: 0, y: 1.6, z: 5 },
  target: { x: 0, y: 1, z: 0 },
  fov: 60,
  near: 0.1,
  far: 100,
  autoRotate: false,
  rotateSpeed: 1,
  enableZoom: true,
  enablePan: true
};

const LIGHT_PRESETS: Record<LightPreset, Required<LightConfig>> = {
  [LightPreset.DAY]: {
    preset: LightPreset.DAY,
    ambientIntensity: 0.8,
    directionalIntensity: 1.2,
    directionalPosition: { x: 5, y: 10, z: 5 },
    pointLights: [],
    shadowEnabled: true
  },
  [LightPreset.NIGHT]: {
    preset: LightPreset.NIGHT,
    ambientIntensity: 0.3,
    directionalIntensity: 0.5,
    directionalPosition: { x: -5, y: 8, z: -5 },
    pointLights: [
      { position: { x: 2, y: 3, z: 0 }, intensity: 0.8, distance: 10 },
      { position: { x: -2, y: 3, z: 0 }, intensity: 0.8, distance: 10 }
    ],
    shadowEnabled: false
  },
  [LightPreset.STUDIO]: {
    preset: LightPreset.STUDIO,
    ambientIntensity: 0.6,
    directionalIntensity: 1.5,
    directionalPosition: { x: 0, y: 10, z: 5 },
    pointLights: [
      { position: { x: -3, y: 5, z: 3 }, intensity: 0.6, distance: 15 },
      { position: { x: 3, y: 5, z: 3 }, intensity: 0.6, distance: 15 }
    ],
    shadowEnabled: true
  },
  [LightPreset.DRAMATIC]: {
    preset: LightPreset.DRAMATIC,
    ambientIntensity: 0.2,
    directionalIntensity: 2,
    directionalPosition: { x: 0, y: 15, z: 0 },
    pointLights: [],
    shadowEnabled: true
  },
  [LightPreset.WARM]: {
    preset: LightPreset.WARM,
    ambientIntensity: 0.7,
    directionalIntensity: 1,
    directionalPosition: { x: 3, y: 8, z: 3 },
    pointLights: [
      { position: { x: 0, y: 2, z: 0 }, color: { r: 1, g: 0.8, b: 0.6, a: 1 }, intensity: 0.5, distance: 8 }
    ],
    shadowEnabled: false
  },
  [LightPreset.COOL]: {
    preset: LightPreset.COOL,
    ambientIntensity: 0.7,
    directionalIntensity: 1,
    directionalPosition: { x: -3, y: 8, z: -3 },
    pointLights: [
      { position: { x: 0, y: 2, z: 0 }, color: { r: 0.6, g: 0.8, b: 1, a: 1 }, intensity: 0.5, distance: 8 }
    ],
    shadowEnabled: false
  }
};

const THEME_STYLES: Record<SceneTheme, { bg: string; floor: string; accent: string; productCard: string }> = {
  [SceneTheme.LUXURY]: {
    bg: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    floor: 'linear-gradient(180deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.3) 100%)',
    accent: '#d4af37',
    productCard: 'linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%)'
  },
  [SceneTheme.MINIMAL]: {
    bg: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
    floor: 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.08) 100%)',
    accent: '#333333',
    productCard: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%)'
  },
  [SceneTheme.FUTURISTIC]: {
    bg: 'linear-gradient(180deg, #0a0a1a 0%, #0f1729 50%, #1a1a3e 100%)',
    floor: 'linear-gradient(180deg, rgba(0,200,255,0.1) 0%, rgba(0,150,255,0.2) 100%)',
    accent: '#00c8ff',
    productCard: 'linear-gradient(135deg, rgba(0,200,255,0.15) 0%, rgba(0,100,200,0.1) 100%)'
  },
  [SceneTheme.RETRO]: {
    bg: 'linear-gradient(180deg, #f4e8c1 0%, #e8d5a3 100%)',
    floor: 'linear-gradient(180deg, rgba(139,69,19,0.1) 0%, rgba(139,69,19,0.2) 100%)',
    accent: '#8b4513',
    productCard: 'linear-gradient(135deg, #fff8e7 0%, #f4e8c1 100%)'
  },
  [SceneTheme.NATURE]: {
    bg: 'linear-gradient(180deg, #87ceeb 0%, #98d98e 70%, #2d5a27 100%)',
    floor: 'linear-gradient(180deg, rgba(45,90,39,0.2) 0%, rgba(45,90,39,0.4) 100%)',
    accent: '#2d5a27',
    productCard: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'
  },
  [SceneTheme.CUSTOM]: {
    bg: '#ffffff',
    floor: 'rgba(0,0,0,0.05)',
    accent: '#333333',
    productCard: '#ffffff'
  }
};

export class ShowcaseManager {
  private containerId: string;
  private containerElement?: HTMLElement;
  private sceneElement?: HTMLElement;
  private floorElement?: HTMLElement;
  private productsLayer?: HTMLElement;
  private avatarsLayer?: HTMLElement;
  private hotspotsLayer?: HTMLElement;
  private uiLayer?: HTMLElement;

  private currentTheme: SceneTheme;
  private customTheme?: CustomThemeConfig;
  private products: Map<string, Product> = new Map();
  private productElements: Map<string, HTMLElement> = new Map();
  private cameraConfig: Required<CameraConfig>;
  private lightConfig: Required<LightConfig>;
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private isLoaded: boolean = false;
  private performanceLevel: PerformanceLevel;
  private effectsEnabled: boolean;
  private animationFrameId?: number;
  private rotationAngle: number = 0;

  constructor(
    containerId: string,
    eventEmitter: EventEmitter,
    logger: Logger,
    initialTheme: SceneTheme = SceneTheme.MINIMAL,
    performanceLevel: PerformanceLevel = PerformanceLevel.MEDIUM,
    effectsEnabled: boolean = true
  ) {
    this.containerId = containerId;
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.currentTheme = initialTheme;
    this.performanceLevel = performanceLevel;
    this.effectsEnabled = effectsEnabled;
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG };
    this.lightConfig = { ...LIGHT_PRESETS[LightPreset.DAY] };
  }

  async load(): Promise<void> {
    this.logger.log('ShowcaseManager: Loading showcase...');

    if (!isBrowser()) {
      this.isLoaded = true;
      this.logger.log('ShowcaseManager: Non-browser environment, skipping DOM init');
      return;
    }

    const element = document.getElementById(this.containerId);
    if (!element) {
      throw new Error(`Container element with id '${this.containerId}' not found`);
    }
    this.containerElement = element;
    this.initializeContainer();
    this.buildSceneStructure();
    this.applyThemeStyles();
    this.startRenderLoop();

    this.isLoaded = true;
    this.logger.log('ShowcaseManager: Showcase loaded successfully');
  }

  private initializeContainer(): void {
    if (!this.containerElement) return;

    this.containerElement.style.position = 'relative';
    this.containerElement.style.overflow = 'hidden';
    this.containerElement.style.width = '100%';
    this.containerElement.style.height = '100%';
    this.containerElement.style.minHeight = '400px';
    this.containerElement.style.perspective = '1200px';
    this.containerElement.style.userSelect = 'none';

    if (this.containerElement.dataset.initialized !== 'true') {
      this.containerElement.dataset.initialized = 'true';
      this.containerElement.innerHTML = '';
      this.logger.log(`ShowcaseManager: Container '${this.containerId}' initialized`);
    }
  }

  private buildSceneStructure(): void {
    if (!this.containerElement) return;

    this.sceneElement = document.createElement('div');
    this.sceneElement.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      transform-style: preserve-3d;
      transition: transform 0.5s ease;
    `;
    this.containerElement.appendChild(this.sceneElement);

    this.floorElement = document.createElement('div');
    this.floorElement.style.cssText = `
      position: absolute;
      left: 10%; right: 10%;
      bottom: 0;
      height: 40%;
      border-radius: 50% 50% 0 0;
      pointer-events: none;
      transition: background 0.5s ease;
    `;
    this.sceneElement.appendChild(this.floorElement);

    this.productsLayer = document.createElement('div');
    this.productsLayer.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      transform-style: preserve-3d;
      pointer-events: none;
    `;
    this.sceneElement.appendChild(this.productsLayer);

    this.avatarsLayer = document.createElement('div');
    this.avatarsLayer.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      transform-style: preserve-3d;
      pointer-events: none;
    `;
    this.sceneElement.appendChild(this.avatarsLayer);

    this.hotspotsLayer = document.createElement('div');
    this.hotspotsLayer.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
    `;
    this.sceneElement.appendChild(this.hotspotsLayer);

    this.uiLayer = document.createElement('div');
    this.uiLayer.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
    `;
    this.containerElement.appendChild(this.uiLayer);

    this.logger.log('ShowcaseManager: Scene structure built');
  }

  getProductsLayer(): HTMLElement | undefined {
    return this.productsLayer;
  }

  getAvatarsLayer(): HTMLElement | undefined {
    return this.avatarsLayer;
  }

  getHotspotsLayer(): HTMLElement | undefined {
    return this.hotspotsLayer;
  }

  getUILayer(): HTMLElement | undefined {
    return this.uiLayer;
  }

  getSceneElement(): HTMLElement | undefined {
    return this.sceneElement;
  }

  getContainer(): HTMLElement | undefined {
    return this.containerElement;
  }

  getThemeStyles(): { bg: string; floor: string; accent: string; productCard: string } {
    const styles = THEME_STYLES[this.currentTheme];
    if (this.currentTheme === SceneTheme.CUSTOM && this.customTheme) {
      const bg = this.customTheme.backgroundColor;
      const accent = this.customTheme.primaryColor;
      if (bg) {
        styles.bg = `rgb(${Math.round(bg.r * 255)}, ${Math.round(bg.g * 255)}, ${Math.round(bg.b * 255)})`;
      }
      if (accent) {
        styles.accent = `rgb(${Math.round(accent.r * 255)}, ${Math.round(accent.g * 255)}, ${Math.round(accent.b * 255)})`;
      }
    }
    return { ...styles };
  }

  isSceneLoaded(): boolean {
    return this.isLoaded;
  }

  setTheme(theme: SceneTheme, customTheme?: CustomThemeConfig): void {
    this.currentTheme = theme;
    if (customTheme) {
      this.customTheme = customTheme;
    }
    this.logger.log(`ShowcaseManager: Theme set to ${theme}`);
    this.applyThemeStyles();
    this.refreshAllProductStyles();
  }

  getTheme(): SceneTheme {
    return this.currentTheme;
  }

  getCustomTheme(): CustomThemeConfig | undefined {
    return this.customTheme;
  }

  private applyThemeStyles(): void {
    if (!this.containerElement || !this.floorElement) return;

    const styles = this.getThemeStyles();
    this.containerElement.style.background = styles.bg;
    this.floorElement.style.background = styles.floor;
  }

  private startRenderLoop(): void {
    const render = () => {
      if (this.cameraConfig.autoRotate && this.sceneElement) {
        this.rotationAngle += 0.1 * this.cameraConfig.rotateSpeed;
        this.sceneElement.style.transform = `rotateY(${this.rotationAngle}deg)`;
      }
      this.animationFrameId = requestAnimationFrame(render);
    };
    this.animationFrameId = requestAnimationFrame(render);
  }

  async loadProduct(product: Product): Promise<void> {
    this.logger.log(`ShowcaseManager: Loading product ${product.id} - ${product.name}`);

    const enhancedProduct: Product = {
      ...product,
      position: product.position || vector3(0, 0, 0),
      rotation: product.rotation || vector3(0, 0, 0),
      scale: product.scale || vector3(1, 1, 1)
    };

    this.products.set(product.id, enhancedProduct);
    this.renderProductElement(enhancedProduct);

    this.eventEmitter.emit(InteractionEventType.PRODUCT_VIEW, {
      productId: product.id,
      productName: product.name
    });

    this.logger.log(`ShowcaseManager: Product ${product.id} loaded successfully`);
  }

  private renderProductElement(product: Product): void {
    if (!this.productsLayer || !isBrowser()) return;

    const existingEl = this.productElements.get(product.id);
    if (existingEl) {
      existingEl.remove();
    }

    const el = document.createElement('div');
    el.className = 'mv-product';
    el.dataset.productId = product.id;
    el.style.cssText = this.getProductStyle(product);

    const card = document.createElement('div');
    card.style.cssText = this.getProductCardStyle();

    if (product.thumbnailUrl) {
      const img = document.createElement('div');
      img.style.cssText = `
        width: 100%;
        height: 100px;
        background-image: url(${product.thumbnailUrl});
        background-size: cover;
        background-position: center;
        border-radius: 8px 8px 0 0;
        background-color: rgba(128,128,128,0.2);
      `;
      card.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        width: 100%;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        background: linear-gradient(135deg, rgba(128,128,128,0.15), rgba(128,128,128,0.25));
        border-radius: 8px 8px 0 0;
      `;
      placeholder.textContent = '📦';
      card.appendChild(placeholder);
    }

    const info = document.createElement('div');
    info.style.cssText = `
      padding: 10px 12px;
    `;

    const name = document.createElement('div');
    name.style.cssText = `
      font-size: 13px;
      font-weight: 600;
      color: ${this.getThemeStyles().accent};
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    name.textContent = product.name;
    info.appendChild(name);

    if (product.price !== undefined) {
      const price = document.createElement('div');
      price.style.cssText = `
        font-size: 15px;
        font-weight: 700;
        color: #e74c3c;
      `;
      const currency = product.currency || '¥';
      price.textContent = `${currency}${product.price.toFixed(0)}`;
      info.appendChild(price);
    }

    if (product.description) {
      const desc = document.createElement('div');
      desc.style.cssText = `
        font-size: 11px;
        color: #999;
        margin-top: 4px;
        line-height: 1.4;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      `;
      desc.textContent = product.description;
      info.appendChild(desc);
    }

    card.appendChild(info);
    el.appendChild(card);

    if (this.areEffectsEnabled()) {
      const glow = document.createElement('div');
      glow.style.cssText = `
        position: absolute;
        top: -10px; left: -10px; right: -10px; bottom: -10px;
        background: radial-gradient(circle, ${this.getThemeStyles().accent}33 0%, transparent 70%);
        border-radius: 16px;
        z-index: -1;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      `;
      el.appendChild(glow);

      el.addEventListener('mouseenter', () => {
        glow.style.opacity = '1';
        el.style.transform = `${el.style.transform} scale(1.05)`;
      });
      el.addEventListener('mouseleave', () => {
        glow.style.opacity = '0';
        this.updateProductTransform(el, product);
      });
    }

    this.productsLayer.appendChild(el);
    this.productElements.set(product.id, el);
  }

  private getProductStyle(product: Product): string {
    const { x, y, z } = product.position || vector3(0, 0, 0);
    const scale = product.scale?.x || 1;

    const leftPct = 50 + x * 15;
    const bottomPct = 15 + y * 10;
    const zScale = 1 + z * 0.1;

    return `
      position: absolute;
      left: ${leftPct}%;
      bottom: ${bottomPct}%;
      transform: translateX(-50%) translateZ(${z * 50}px) scale(${scale * zScale});
      transform-style: preserve-3d;
      transition: transform 0.3s ease;
      pointer-events: auto;
      cursor: pointer;
      z-index: ${Math.round(100 - z * 10)};
    `;
  }

  private getProductCardStyle(): string {
    const styles = this.getThemeStyles();
    return `
      width: 140px;
      background: ${styles.productCard};
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
      border: 1px solid ${styles.accent}22;
      backdrop-filter: blur(10px);
    `;
  }

  private updateProductTransform(el: HTMLElement, product: Product): void {
    const { z } = product.position || vector3(0, 0, 0);
    const scale = product.scale?.x || 1;
    const zScale = 1 + z * 0.1;
    el.style.transform = `translateX(-50%) translateZ(${z * 50}px) scale(${scale * zScale})`;
  }

  private refreshAllProductStyles(): void {
    this.products.forEach((product) => {
      const el = this.productElements.get(product.id);
      if (el) {
        el.remove();
        this.renderProductElement(product);
      }
    });
  }

  async loadProducts(products: Product[]): Promise<void> {
    this.logger.log(`ShowcaseManager: Loading ${products.length} products...`);
    await Promise.all(products.map((p) => this.loadProduct(p)));
  }

  getProduct(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  removeProduct(productId: string): boolean {
    const el = this.productElements.get(productId);
    if (el) {
      el.remove();
      this.productElements.delete(productId);
    }
    const removed = this.products.delete(productId);
    if (removed) {
      this.logger.log(`ShowcaseManager: Product ${productId} removed`);
    }
    return removed;
  }

  clearProducts(): void {
    this.productElements.forEach((el) => el.remove());
    this.productElements.clear();
    this.products.clear();
    this.logger.log('ShowcaseManager: All products cleared');
  }

  updateProductPosition(productId: string, position: Vector3): void {
    const product = this.products.get(productId);
    if (product) {
      product.position = position;
      const el = this.productElements.get(productId);
      if (el) {
        const leftPct = 50 + position.x * 15;
        const bottomPct = 15 + position.y * 10;
        el.style.left = `${leftPct}%`;
        el.style.bottom = `${bottomPct}%`;
        this.updateProductTransform(el, product);
      }
      this.logger.log(`ShowcaseManager: Product ${productId} position updated`);
    }
  }

  updateProductRotation(productId: string, rotation: Vector3): void {
    const product = this.products.get(productId);
    if (product) {
      product.rotation = rotation;
      const el = this.productElements.get(productId);
      if (el) {
        el.style.transform += ` rotateY(${rotation.y}deg)`;
      }
      this.logger.log(`ShowcaseManager: Product ${productId} rotation updated`);
    }
  }

  updateProductScale(productId: string, scale: Vector3): void {
    const product = this.products.get(productId);
    if (product) {
      product.scale = scale;
      const el = this.productElements.get(productId);
      if (el) {
        this.updateProductTransform(el, product);
      }
      this.logger.log(`ShowcaseManager: Product ${productId} scale updated`);
    }
  }

  setLightPreset(preset: LightPreset): void {
    this.lightConfig = { ...LIGHT_PRESETS[preset] };
    this.applyLightStyles();
    this.logger.log(`ShowcaseManager: Light preset set to ${preset}`);
  }

  setLightConfig(config: LightConfig): void {
    this.lightConfig = mergeDeep(
      { ...this.lightConfig } as unknown as Record<string, unknown>,
      config as unknown as Record<string, unknown>
    ) as unknown as Required<LightConfig>;
    this.applyLightStyles();
    this.logger.log('ShowcaseManager: Light config updated');
  }

  private applyLightStyles(): void {
    if (!this.containerElement) return;
    const intensity = this.lightConfig.ambientIntensity;
    this.containerElement.style.filter = `brightness(${0.7 + intensity * 0.4})`;
  }

  getLightConfig(): LightConfig {
    return { ...this.lightConfig };
  }

  setCameraConfig(config: CameraConfig): void {
    this.cameraConfig = mergeDeep(
      { ...this.cameraConfig } as unknown as Record<string, unknown>,
      config as unknown as Record<string, unknown>
    ) as unknown as Required<CameraConfig>;
    this.applyCameraStyles();
    this.logger.log('ShowcaseManager: Camera config updated');
  }

  getCameraConfig(): CameraConfig {
    return { ...this.cameraConfig };
  }

  private applyCameraStyles(): void {
    if (!this.sceneElement) return;
    const { position, fov } = this.cameraConfig;
    this.sceneElement.style.transform = `
      translateZ(${position.z * -30}px)
      translateY(${position.y * -20}px)
      rotateY(${this.rotationAngle}deg)
    `;
    if (this.containerElement) {
      this.containerElement.style.perspective = `${800 + fov * 10}px`;
    }
  }

  setCameraPosition(position: Vector3): void {
    this.cameraConfig.position = { ...position };
    this.applyCameraStyles();
    this.logger.log('ShowcaseManager: Camera position updated');
  }

  setCameraTarget(target: Vector3): void {
    this.cameraConfig.target = { ...target };
    this.logger.log('ShowcaseManager: Camera target updated');
  }

  setAutoRotate(enabled: boolean, speed?: number): void {
    this.cameraConfig.autoRotate = enabled;
    if (speed !== undefined) {
      this.cameraConfig.rotateSpeed = speed;
    }
    this.logger.log(`ShowcaseManager: Camera auto-rotate ${enabled ? 'enabled' : 'disabled'}`);
  }

  setPerformanceLevel(level: PerformanceLevel): void {
    this.performanceLevel = level;
    this.logger.log(`ShowcaseManager: Performance level set to ${level}`);
  }

  setEffectsEnabled(enabled: boolean): void {
    this.effectsEnabled = enabled;
    this.logger.log(`ShowcaseManager: Effects ${enabled ? 'enabled' : 'disabled'}`);
  }

  areEffectsEnabled(): boolean {
    return this.effectsEnabled && this.performanceLevel !== PerformanceLevel.LOW;
  }

  getPerformanceLevel(): PerformanceLevel {
    return this.performanceLevel;
  }

  play(): void {
    this.logger.log('ShowcaseManager: Showcase playing');
  }

  pause(): void {
    this.logger.log('ShowcaseManager: Showcase paused');
  }

  reset(): void {
    this.clearProducts();
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG };
    this.lightConfig = { ...LIGHT_PRESETS[LightPreset.DAY] };
    this.rotationAngle = 0;
    this.logger.log('ShowcaseManager: Showcase reset');
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.productElements.forEach((el) => el.remove());
    this.productElements.clear();
    this.products.clear();
    if (this.containerElement) {
      this.containerElement.innerHTML = '';
    }
    this.isLoaded = false;
    this.logger.log('ShowcaseManager: Destroyed');
  }
}
