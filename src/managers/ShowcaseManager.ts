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
import { vector3, mergeDeep } from '../utils/helpers';

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

export class ShowcaseManager {
  private containerId: string;
  private containerElement?: HTMLElement;
  private currentTheme: SceneTheme;
  private customTheme?: CustomThemeConfig;
  private products: Map<string, Product> = new Map();
  private cameraConfig: Required<CameraConfig>;
  private lightConfig: Required<LightConfig>;
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private isLoaded: boolean = false;
  private performanceLevel: PerformanceLevel;
  private effectsEnabled: boolean;

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

    if (typeof document !== 'undefined') {
      const element = document.getElementById(this.containerId);
      if (!element) {
        throw new Error(`Container element with id '${this.containerId}' not found`);
      }
      this.containerElement = element;
      this.initializeContainer();
    }

    this.isLoaded = true;
    this.logger.log('ShowcaseManager: Showcase loaded successfully');
  }

  private initializeContainer(): void {
    if (!this.containerElement) return;

    this.containerElement.style.position = 'relative';
    this.containerElement.style.overflow = 'hidden';
    this.containerElement.style.width = '100%';
    this.containerElement.style.height = '100%';

    if (this.containerElement.dataset.initialized !== 'true') {
      this.containerElement.dataset.initialized = 'true';
      this.logger.log(`ShowcaseManager: Container '${this.containerId}' initialized`);
    }
  }

  getContainer(): HTMLElement | undefined {
    return this.containerElement;
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
  }

  getTheme(): SceneTheme {
    return this.currentTheme;
  }

  getCustomTheme(): CustomThemeConfig | undefined {
    return this.customTheme;
  }

  private applyThemeStyles(): void {
    if (!this.containerElement) return;

    const bgColors: Record<SceneTheme, string> = {
      [SceneTheme.LUXURY]: '#1a1a2e',
      [SceneTheme.MINIMAL]: '#f5f5f5',
      [SceneTheme.FUTURISTIC]: '#0f0f23',
      [SceneTheme.RETRO]: '#f4e8c1',
      [SceneTheme.NATURE]: '#2d5a27',
      [SceneTheme.CUSTOM]: this.customTheme?.backgroundColor
        ? `rgb(${Math.round((this.customTheme.backgroundColor.r || 0) * 255)}, ${Math.round((this.customTheme.backgroundColor.g || 0) * 255)}, ${Math.round((this.customTheme.backgroundColor.b || 0) * 255)})`
        : '#ffffff'
    };

    this.containerElement.style.backgroundColor = bgColors[this.currentTheme];
  }

  async loadProduct(product: Product): Promise<void> {
    this.logger.log(`ShowcaseManager: Loading product ${product.id} - ${product.name}`);

    this.products.set(product.id, {
      ...product,
      position: product.position || vector3(0, 0, 0),
      rotation: product.rotation || vector3(0, 0, 0),
      scale: product.scale || vector3(1, 1, 1)
    });

    this.eventEmitter.emit(InteractionEventType.PRODUCT_VIEW, {
      productId: product.id,
      productName: product.name
    });

    this.logger.log(`ShowcaseManager: Product ${product.id} loaded successfully`);
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
    const removed = this.products.delete(productId);
    if (removed) {
      this.logger.log(`ShowcaseManager: Product ${productId} removed`);
    }
    return removed;
  }

  clearProducts(): void {
    this.products.clear();
    this.logger.log('ShowcaseManager: All products cleared');
  }

  updateProductPosition(productId: string, position: Vector3): void {
    const product = this.products.get(productId);
    if (product) {
      product.position = position;
      this.logger.log(`ShowcaseManager: Product ${productId} position updated`);
    }
  }

  updateProductRotation(productId: string, rotation: Vector3): void {
    const product = this.products.get(productId);
    if (product) {
      product.rotation = rotation;
      this.logger.log(`ShowcaseManager: Product ${productId} rotation updated`);
    }
  }

  updateProductScale(productId: string, scale: Vector3): void {
    const product = this.products.get(productId);
    if (product) {
      product.scale = scale;
      this.logger.log(`ShowcaseManager: Product ${productId} scale updated`);
    }
  }

  setLightPreset(preset: LightPreset): void {
    this.lightConfig = { ...LIGHT_PRESETS[preset] };
    this.logger.log(`ShowcaseManager: Light preset set to ${preset}`);
  }

  setLightConfig(config: LightConfig): void {
    this.lightConfig = mergeDeep(
      { ...this.lightConfig } as unknown as Record<string, unknown>,
      config as unknown as Record<string, unknown>
    ) as unknown as Required<LightConfig>;
    this.logger.log('ShowcaseManager: Light config updated');
  }

  getLightConfig(): LightConfig {
    return { ...this.lightConfig };
  }

  setCameraConfig(config: CameraConfig): void {
    this.cameraConfig = mergeDeep(
      { ...this.cameraConfig } as unknown as Record<string, unknown>,
      config as unknown as Record<string, unknown>
    ) as unknown as Required<CameraConfig>;
    this.logger.log('ShowcaseManager: Camera config updated');
  }

  getCameraConfig(): CameraConfig {
    return { ...this.cameraConfig };
  }

  setCameraPosition(position: Vector3): void {
    this.cameraConfig.position = { ...position };
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
    this.products.clear();
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG };
    this.lightConfig = { ...LIGHT_PRESETS[LightPreset.DAY] };
    this.logger.log('ShowcaseManager: Showcase reset');
  }

  destroy(): void {
    this.products.clear();
    this.isLoaded = false;
    this.logger.log('ShowcaseManager: Destroyed');
  }
}
