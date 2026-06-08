export enum SceneTheme {
  LUXURY = 'luxury',
  MINIMAL = 'minimal',
  FUTURISTIC = 'futuristic',
  RETRO = 'retro',
  NATURE = 'nature',
  CUSTOM = 'custom'
}

export enum LightPreset {
  DAY = 'day',
  NIGHT = 'night',
  STUDIO = 'studio',
  DRAMATIC = 'dramatic',
  WARM = 'warm',
  COOL = 'cool'
}

export enum AvatarGender {
  MALE = 'male',
  FEMALE = 'female',
  NEUTRAL = 'neutral'
}

export enum AvatarGesture {
  WAVE = 'wave',
  POINT = 'point',
  CLAP = 'clap',
  THINK = 'think',
  BOW = 'bow',
  HAND_SHAKE = 'hand_shake',
  THUMBS_UP = 'thumbs_up',
  HEART = 'heart'
}

export enum HotspotType {
  PRODUCT = 'product',
  INFO = 'info',
  COUPON = 'coupon',
  GAME = 'game',
  PURCHASE = 'purchase',
  LINK = 'link'
}

export enum InteractionEventType {
  HOTSPOT_CLICK = 'hotspot_click',
  HOTSPOT_HOVER = 'hotspot_hover',
  AVATAR_INTERACT = 'avatar_interact',
  VISIT_START = 'visit_start',
  VISIT_END = 'visit_end',
  PRODUCT_VIEW = 'product_view',
  PURCHASE_INTENT = 'purchase_intent',
  SHARE = 'share',
  SCREENSHOT = 'screenshot',
  FEEDBACK_SUBMIT = 'feedback_submit',
  GAME_START = 'game_start',
  GAME_COMPLETE = 'game_complete',
  COUPON_CLAIM = 'coupon_claim',
  LANGUAGE_CHANGE = 'language_change',
  TOUR_START = 'tour_start',
  TOUR_STEP_CHANGE = 'tour_step_change',
  TOUR_PAUSE = 'tour_pause',
  TOUR_RESUME = 'tour_resume',
  TOUR_COMPLETE = 'tour_complete',
  TOUR_STEP_COMPLETE = 'tour_step_complete',
  BENEFIT_CENTER_OPEN = 'benefit_center_open',
  BENEFIT_CENTER_CLOSE = 'benefit_center_close',
  COUPON_SELECTED = 'coupon_selected',
  BENEFIT_RESTORED = 'benefit_restored',
  BENEFIT_AWARDED = 'benefit_awarded'
}

export enum Language {
  ZH_CN = 'zh-CN',
  ZH_TW = 'zh-TW',
  EN_US = 'en-US',
  JA_JP = 'ja-JP',
  KO_KR = 'ko-KR'
}

export enum PerformanceLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ColorRGBA {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface SDKConfig {
  containerId: string;
  appId: string;
  appSecret?: string;
  userId?: string;
  theme?: SceneTheme;
  language?: Language;
  performanceLevel?: PerformanceLevel;
  enableEffects?: boolean;
  enableAudio?: boolean;
  autoPlay?: boolean;
  debug?: boolean;
  customTheme?: CustomThemeConfig;
  analytics?: AnalyticsConfig;
}

export interface CustomThemeConfig {
  primaryColor?: ColorRGBA;
  backgroundColor?: ColorRGBA;
  accentColor?: ColorRGBA;
  floorTextureUrl?: string;
  wallTextureUrl?: string;
  skyboxUrls?: string[];
}

export interface AnalyticsConfig {
  enabled: boolean;
  endpoint?: string;
  batchInterval?: number;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  onBatchSuccess?: (batch: AnalyticsEvent[], response: unknown) => void;
  onBatchFailure?: (batch: AnalyticsEvent[], error: unknown, retriesLeft: number) => void;
  autoFlush?: boolean;
  enableOfflineStorage?: boolean;
}

export interface AnalyticsEvent {
  eventType: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  properties?: Record<string, unknown>;
  eventId?: string;
  retryCount?: number;
}

export interface AnalyticsBatchResult {
  success: boolean;
  eventCount: number;
  failedEvents?: AnalyticsEvent[];
  response?: unknown;
  error?: unknown;
}

export interface AnalyticsState {
  pendingEvents: AnalyticsEvent[];
  offlineEvents: AnalyticsEvent[];
  lastFlushTime?: number;
  totalReported: number;
  totalFailed: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  modelUrl: string;
  thumbnailUrl?: string;
  position?: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProductDescription {
  productId: string;
  title: string;
  content: string;
  images?: string[];
  specs?: Record<string, string>;
  audioUrl?: string;
  subtitles?: SubtitleConfig[];
}

export interface SubtitleConfig {
  language: Language;
  text: string;
  timestamp?: number;
}

export interface AvatarConfig {
  id?: string;
  name?: string;
  gender?: AvatarGender;
  modelUrl?: string;
  appearance?: AvatarAppearance;
  voice?: VoiceConfig;
  greetingText?: string;
  position?: Vector3;
}

export interface AvatarAppearance {
  hairStyle?: string;
  hairColor?: ColorRGBA;
  skinColor?: ColorRGBA;
  outfitStyle?: string;
  outfitColor?: ColorRGBA;
  accessories?: string[];
}

export interface VoiceConfig {
  voiceType?: string;
  pitch?: number;
  speed?: number;
  volume?: number;
  language?: Language;
}

export interface AnimationConfig {
  name: string;
  loop?: boolean;
  speed?: number;
  duration?: number;
  onComplete?: () => void;
}

export interface HotspotConfig {
  id: string;
  type: HotspotType;
  position: Vector3;
  productId?: string;
  title?: string;
  description?: string;
  iconUrl?: string;
  onClick?: (hotspot: Hotspot) => void;
  onHover?: (hotspot: Hotspot) => void;
  metadata?: Record<string, unknown>;
}

export interface Hotspot {
  id: string;
  type: HotspotType;
  position: Vector3;
  productId?: string;
  title: string;
  description: string;
  iconUrl?: string;
  visible: boolean;
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface Coupon {
  id: string;
  title: string;
  description?: string;
  discountType: 'percentage' | 'fixed' | 'shipping';
  discountValue: number;
  minPurchaseAmount?: number;
  expiryDate?: string;
  productIds?: string[];
  claimed?: boolean;
  claimedAt?: number;
  isTemporary?: boolean;
  source?: 'coupon_hotspot' | 'game_reward' | 'tour_reward' | 'temporary_reward';
}

export interface PlayedGameRecord {
  gameId: string;
  startedAt: number;
  completedAt?: number;
  completed: boolean;
  reward?: GameReward;
  matchedCouponId?: string;
}

export enum BenefitType {
  COUPON = 'coupon',
  GAME_REWARD = 'game_reward',
  TOUR_REWARD = 'tour_reward',
  BADGE = 'badge',
  POINTS = 'points'
}

export interface BenefitItem {
  id: string;
  type: BenefitType;
  title: string;
  description?: string;
  icon?: string;
  couponId?: string;
  reward?: GameReward;
  acquiredAt: number;
  source: 'coupon_hotspot' | 'game_reward' | 'tour_reward' | 'imported';
  isValid?: boolean;
  expiryDate?: string;
  metadata?: Record<string, unknown>;
}

export interface BenefitState {
  coupons: Coupon[];
  benefits: BenefitItem[];
  playedGameRecords: PlayedGameRecord[];
  selectedCouponId?: string;
  lastBenefitAt?: number;
  lastBenefitType?: BenefitType;
}

export interface CameraConfig {
  position?: Vector3;
  target?: Vector3;
  fov?: number;
  near?: number;
  far?: number;
  autoRotate?: boolean;
  rotateSpeed?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
}

export interface LightConfig {
  preset?: LightPreset;
  ambientIntensity?: number;
  directionalIntensity?: number;
  directionalPosition?: Vector3;
  pointLights?: PointLightConfig[];
  shadowEnabled?: boolean;
}

export interface PointLightConfig {
  position: Vector3;
  color?: ColorRGBA;
  intensity?: number;
  distance?: number;
}

export interface MiniGame {
  id: string;
  name: string;
  description?: string;
  type: 'lucky_draw' | 'quiz' | 'puzzle' | 'catch' | 'scratch';
  config?: Record<string, unknown>;
  rewards?: GameReward[];
}

export interface GameReward {
  id: string;
  name: string;
  type: 'coupon' | 'product' | 'points' | 'badge';
  value: unknown;
  probability?: number;
}

export interface TourStep {
  id: string;
  title: string;
  description?: string;
  productId?: string;
  hotspotId?: string;
  focusPosition?: Vector3;
  cameraTarget?: Vector3;
  avatarGreeting?: string;
  avatarGesture?: AvatarGesture;
  avatarSpeech?: string;
  highlightHotspotIds?: string[];
  minDuration?: number;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
  metadata?: Record<string, unknown>;
}

export interface TourStepProgress {
  stepId: string;
  completed: boolean;
  startTime?: number;
  endTime?: number;
  duration: number;
  completedAt?: number;
}

export interface TourConfig {
  id: string;
  name: string;
  description?: string;
  steps: TourStep[];
  loop?: boolean;
  autoStart?: boolean;
}

export interface TourState {
  tourId: string;
  currentStepIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  stepProgress: TourStepProgress[];
  startTime?: number;
  endTime?: number;
}

export interface VisitProgress {
  userId: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  viewedProducts: string[];
  clickedHotspots: string[];
  claimedCoupons: string[];
  playedGames: string[];
  playedGameRecords: PlayedGameRecord[];
  benefits: BenefitItem[];
  selectedCouponId?: string;
  currentPosition?: Vector3;
  completed: boolean;
  tourState?: TourState;
}

export interface SharePosterConfig {
  title?: string;
  subtitle?: string;
  includeQRCode?: boolean;
  qrCodeUrl?: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
  watermark?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
  width?: number;
  height?: number;
}

export interface ScreenshotConfig {
  format?: 'png' | 'jpeg';
  quality?: number;
  width?: number;
  height?: number;
  includeUI?: boolean;
  watermark?: string;
}

export interface ScreenshotResult {
  dataUrl: string;
  blob?: Blob;
  width: number;
  height: number;
}

export interface UserFeedback {
  userId?: string;
  sessionId: string;
  rating: number;
  comment?: string;
  category?: string;
  timestamp: number;
}

export interface InteractionEvent {
  type: InteractionEventType;
  timestamp: number;
  sessionId: string;
  userId?: string;
  data?: Record<string, unknown>;
}

export interface VisitDurationRecord {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime: number;
  duration: number;
  area?: string;
  productId?: string;
}

export interface SDKState {
  initialized: boolean;
  sceneLoaded: boolean;
  avatarReady: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  performanceLevel: PerformanceLevel;
  currentTheme: SceneTheme;
  currentLanguage: Language;
  effectsEnabled: boolean;
  audioEnabled: boolean;
}

export type EventCallback = (event: InteractionEvent) => void;

export interface IEventEmitter {
  on(event: InteractionEventType, callback: EventCallback): void;
  off(event: InteractionEventType, callback: EventCallback): void;
  once(event: InteractionEventType, callback: EventCallback): void;
  emit(event: InteractionEventType, data?: Record<string, unknown>): void;
  removeAllListeners(event?: InteractionEventType): void;
}

export interface IShareManager {
  takeScreenshot(config?: ScreenshotConfig): Promise<ScreenshotResult>;
  generatePoster(config?: SharePosterConfig): Promise<ScreenshotResult>;
  shareToPlatform(platform: string, data: ShareData): Promise<void>;
  downloadImage(dataUrl: string, filename?: string): void;
}

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  imageUrl?: string;
}

export interface VoicePlaybackConfig {
  text?: string;
  audioUrl?: string;
  subtitles?: SubtitleConfig[];
  volume?: number;
  onComplete?: () => void;
}
