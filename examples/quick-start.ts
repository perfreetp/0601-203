import {
  MetaverseSDK,
  SceneTheme,
  Language,
  LightPreset,
  HotspotType,
  AvatarGender,
  AvatarGesture,
  InteractionEventType
} from '../src';

async function quickStart() {
  const sdk = new MetaverseSDK({
    containerId: 'showcase-container',
    appId: 'your-app-id',
    userId: 'user-123',
    theme: SceneTheme.FUTURISTIC,
    language: Language.ZH_CN,
    enableEffects: true,
    enableAudio: true,
    autoPlay: true,
    debug: true
  });

  sdk.on(InteractionEventType.HOTSPOT_CLICK, (event) => {
    console.log('热点被点击:', event.data);
  });

  sdk.on(InteractionEventType.PRODUCT_VIEW, (event) => {
    console.log('商品被浏览:', event.data);
  });

  sdk.on(InteractionEventType.COUPON_CLAIM, (event) => {
    console.log('优惠券被领取:', event.data);
  });

  sdk.on(InteractionEventType.VISIT_END, (event) => {
    console.log('参观结束:', event.data);
  });

  await sdk.init();
  console.log('SDK初始化成功');

  sdk.setLightPreset(LightPreset.STUDIO);

  sdk.setCameraConfig({
    autoRotate: true,
    rotateSpeed: 0.5,
    fov: 50
  });

  await sdk.loadProducts([
    {
      id: 'product-001',
      name: '限量版运动鞋',
      description: '高端定制款运动鞋，采用最新科技材料',
      price: 1299,
      currency: 'CNY',
      modelUrl: 'https://example.com/models/sneaker.glb',
      thumbnailUrl: 'https://example.com/images/sneaker.jpg',
      position: { x: -2, y: 0, z: 0 }
    },
    {
      id: 'product-002',
      name: '智能手表 Pro',
      description: '全新一代智能手表，健康监测更精准',
      price: 2499,
      currency: 'CNY',
      modelUrl: 'https://example.com/models/watch.glb',
      thumbnailUrl: 'https://example.com/images/watch.jpg',
      position: { x: 2, y: 0, z: 0 }
    }
  ]);

  sdk.setProductDescription({
    productId: 'product-001',
    title: '限量版运动鞋',
    content: '采用最新飞织技术，轻盈透气，缓震效果出色...',
    images: ['https://example.com/images/sneaker-detail.jpg'],
    specs: {
      '鞋面材质': '飞织面料',
      '鞋底材质': '气垫橡胶',
      '重量': '280g',
      '适合场景': '日常穿搭/运动'
    },
    subtitles: [
      { language: Language.ZH_CN, text: '欢迎了解我们的限量版运动鞋' },
      { language: Language.EN_US, text: 'Welcome to our limited edition sneakers' }
    ]
  });

  await sdk.createAvatar({
    name: '小美',
    gender: AvatarGender.FEMALE,
    greetingText: '您好！欢迎来到我们的虚拟展厅，我是您的专属导购小美~',
    position: { x: 0, y: 0, z: -3 },
    voice: {
      pitch: 1.1,
      speed: 1.0,
      volume: 0.8
    }
  });

  await sdk.greet();

  await sdk.introduceProduct('限量版运动鞋');

  await sdk.playGesture(AvatarGesture.THUMBS_UP);

  sdk.addHotspots([
    {
      id: 'hotspot-product-1',
      type: HotspotType.PRODUCT,
      position: { x: -2, y: 1.5, z: 0 },
      productId: 'product-001',
      title: '查看详情',
      description: '点击查看运动鞋详细信息'
    },
    {
      id: 'hotspot-product-2',
      type: HotspotType.PRODUCT,
      position: { x: 2, y: 1.5, z: 0 },
      productId: 'product-002',
      title: '查看详情'
    },
    {
      id: 'hotspot-coupon-1',
      type: HotspotType.COUPON,
      position: { x: 0, y: 2, z: 2 },
      title: '领取优惠券',
      description: '新用户专享优惠券'
    },
    {
      id: 'hotspot-purchase-1',
      type: HotspotType.PURCHASE,
      position: { x: 0, y: 1, z: -2 },
      title: '立即购买'
    },
    {
      id: 'hotspot-game-1',
      type: HotspotType.GAME,
      position: { x: 3, y: 1.5, z: -2 },
      title: '幸运抽奖',
      description: '参与抽奖赢取好礼'
    }
  ]);

  sdk.addCoupons([
    {
      id: 'coupon-001',
      title: '新用户满减券',
      description: '满500减100',
      discountType: 'fixed',
      discountValue: 100,
      minPurchaseAmount: 500,
      expiryDate: '2025-12-31'
    },
    {
      id: 'coupon-002',
      title: '全场8折券',
      discountType: 'percentage',
      discountValue: 20
    }
  ]);

  sdk.addGames([
    {
      id: 'game-lucky-001',
      name: '幸运大转盘',
      type: 'lucky_draw',
      rewards: [
        { id: 'r1', name: '50元优惠券', type: 'coupon', value: 50, probability: 0.3 },
        { id: 'r2', name: '100元优惠券', type: 'coupon', value: 100, probability: 0.15 },
        { id: 'r3', name: '积分x100', type: 'points', value: 100, probability: 0.35 },
        { id: 'r4', name: '限定徽章', type: 'badge', value: 'exclusive', probability: 0.2 }
      ]
    }
  ]);

  console.log('参观时长:', sdk.getTotalVisitDuration(), 'ms');

  sdk.startAreaTracking('shoes-zone');

  setTimeout(async () => {
    sdk.stopAreaTracking();

    const screenshot = await sdk.takeScreenshot({
      format: 'png',
      width: 1920,
      height: 1080,
      watermark: 'Metaverse Showcase'
    });
    console.log('截图已生成:', screenshot.dataUrl.substring(0, 50) + '...');

    const poster = await sdk.generatePoster({
      title: '品牌虚拟展厅',
      subtitle: '点击进入元宇宙购物体验',
      includeQRCode: true,
      watermark: 'Brand Name'
    });
    console.log('海报已生成:', poster.dataUrl.substring(0, 50) + '...');

    sdk.downloadImage(poster.dataUrl, 'showcase-poster.png');

    await sdk.shareToPlatform('wechat', {
      title: '品牌虚拟展厅',
      text: '一起体验元宇宙购物吧！',
      url: 'https://example.com/showcase'
    });
  }, 3000);

  sdk.submitFeedback({
    userId: 'user-123',
    rating: 5,
    comment: '体验非常棒！数字人导购很贴心',
    category: '整体体验'
  });

  console.log('平均评分:', sdk.getAverageRating());

  sdk.setLanguage(Language.EN_US);
  console.log('切换语言:', sdk.t('greeting.default'));

  sdk.setEffectsEnabled(false);
  console.log('特效已关闭（低负载模式）');

  const progress = sdk.saveVisitProgress();
  console.log('参观进度已保存:', progress?.sessionId);
  console.log('已浏览商品:', progress?.viewedProducts);
  console.log('已点击热点:', progress?.clickedHotspots);
  console.log('已领取优惠券:', progress?.claimedCoupons);
  console.log('已玩小游戏:', progress?.playedGames);

  if (progress?.sessionId) {
    const restoredProgress = sdk.loadVisitProgress(progress.sessionId);
    console.log('从 sessionId 恢复的进度:', restoredProgress?.viewedProducts);
  }

  const posterNoQR = await sdk.generatePoster({
    title: '品牌虚拟展厅',
    subtitle: '点击进入元宇宙购物体验',
    includeQRCode: false,
    watermark: 'Brand Name'
  });
  console.log('无二维码海报已生成:', posterNoQR.dataUrl.substring(0, 50) + '...');

  const posterWithQRUrl = await sdk.generatePoster({
    title: '品牌虚拟展厅',
    subtitle: '扫码进入元宇宙购物体验',
    includeQRCode: true,
    qrCodeUrl: 'https://example.com/qrcode.png',
    watermark: 'Brand Name'
  });
  console.log('带二维码URL海报已生成:', posterWithQRUrl.dataUrl.substring(0, 50) + '...');

  sdk.on(InteractionEventType.FEEDBACK_SUBMIT, (event) => {
    console.log('反馈已提交:', event.data);
  });

  sdk.on(InteractionEventType.SCREENSHOT, (event) => {
    console.log('截图事件:', event.data);
  });

  sdk.on(InteractionEventType.LANGUAGE_CHANGE, (event) => {
    console.log('语言变更:', event.data);
  });

  // sdk.destroy();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', quickStart);
}
