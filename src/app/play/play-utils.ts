/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

/**
 * 播放页纯函数工具集合。
 *
 * 将不依赖 React 状态/生命周期、可独立测试的纯逻辑从巨型播放页中剥离，
 * 便于后续单元测试与复用。
 */

/** 切集后延迟恢复弹幕可见性的毫秒数 */
export const DANMAKU_VISIBLE_RESTORE_DELAY_MS = 1500;

/** 跳过片头片尾配置结构 */
export interface SkipConfig {
  enable: boolean;
  intro_time: number;
  outro_time: number;
}

/**
 * 将秒数格式化为 00:00 或 00:00:00。
 */
export function formatTime(seconds: number): string {
  if (seconds === 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (hours === 0) {
    // 不到一小时，格式为 00:00
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  } else {
    // 超过一小时，格式为 00:00:00
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

/**
 * 去广告：过滤 M3U8 内容中的 #EXT-X-DISCONTINUITY 标记。
 */
export function filterAdsFromM3U8(m3u8Content: string): string {
  if (!m3u8Content) return '';

  // 按行分割M3U8内容
  const lines = m3u8Content.split('\n');
  const filteredLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 只过滤#EXT-X-DISCONTINUITY标识
    if (!line.includes('#EXT-X-DISCONTINUITY')) {
      filteredLines.push(line);
    }
  }

  return filteredLines.join('\n');
}

/**
 * 计算播放源综合评分（分辨率 40% + 下载速度 40% + 网络延迟 20%）。
 */
export function calculateSourceScore(
  testResult: {
    quality: string;
    loadSpeed: string;
    pingTime: number;
  },
  maxSpeed: number,
  minPing: number,
  maxPing: number
): number {
  let score = 0;

  // 分辨率评分 (40% 权重)
  const qualityScore = (() => {
    switch (testResult.quality) {
      case '4K':
        return 100;
      case '2K':
        return 85;
      case '1080p':
        return 75;
      case '720p':
        return 60;
      case '480p':
        return 40;
      case 'SD':
        return 20;
      default:
        return 0;
    }
  })();
  score += qualityScore * 0.4;

  // 下载速度评分 (40% 权重) - 基于最大速度线性映射
  const speedScore = (() => {
    const speedStr = testResult.loadSpeed;
    if (speedStr === '未知' || speedStr === '测量中...') return 30;

    // 解析速度值
    const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
    if (!match) return 30;

    const value = parseFloat(match[1]);
    const unit = match[2];
    const speedKBps = unit === 'MB/s' ? value * 1024 : value;

    // 基于最大速度线性映射，最高100分
    const speedRatio = speedKBps / maxSpeed;
    return Math.min(100, Math.max(0, speedRatio * 100));
  })();
  score += speedScore * 0.4;

  // 网络延迟评分 (20% 权重) - 基于延迟范围线性映射
  const pingScore = (() => {
    const ping = testResult.pingTime;
    if (ping <= 0) return 0; // 无效延迟给默认分

    // 如果所有延迟都相同，给满分
    if (maxPing === minPing) return 100;

    // 线性映射：最低延迟=100分，最高延迟=0分
    const pingRatio = (maxPing - ping) / (maxPing - minPing);
    return Math.min(100, Math.max(0, pingRatio * 100));
  })();
  score += pingScore * 0.2;

  return Math.round(score * 100) / 100; // 保留两位小数
}

/**
 * 创建弹幕插件的默认配置对象。
 *
 * 每次调用返回全新对象，避免多处共享同一引用导致状态污染。
 */
export function createDanmakuDefaultConfig(): any {
  return {
    danmuku: '',
    speed: 5,
    margin: [10, '25%'],
    opacity: 1,
    color: '#FFFFFF',
    mode: 0,
    modes: [0, 1, 2],
    fontSize: 25,
    antiOverlap: true,
    synchronousPlayback: false,
    mount: undefined,
    heatmap: false,
    width: 512,
    points: [],
    filter: (danmu: any) => danmu.text.length <= 100,
    beforeVisible: () => true,
    visible: true,
    emitter: false,
    maxLength: 200,
    lockTime: 5,
    theme: 'dark',
    OPACITY: {},
    FONT_SIZE: {},
    MARGIN: {},
    SPEED: {},
    COLOR: [],
    beforeEmit(_danmu: any) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, 1000);
      });
    },
  };
}

/** 弹幕设置本地存储键 */
export const DANMAKU_SETTINGS_STORAGE_KEY = 'danmaku_settings';

/**
 * 可持久化到本地的弹幕设置字段。
 *
 * 仅包含用户可调的展示类设置，不包含 danmuku 地址、mount 等运行时字段。
 */
export interface DanmakuSettings {
  /** 弹幕是否可见 */
  visible: boolean;
  /** 不透明度，范围 [0, 1] */
  opacity: number;
  /** 字号（像素） */
  fontSize: number;
  /** 弹幕速度，范围 [1, 10] */
  speed: number;
  /** 显示区域 [上边距, 下边距] */
  margin: [number | string, number | string];
  /** 发送弹幕的模式：0-滚动，1-顶部，2-底部 */
  mode: number;
  /** 可见的弹幕模式列表 */
  modes: number[];
  /** 是否防止弹幕重叠 */
  antiOverlap: boolean;
  /** 是否同步视频速度 */
  synchronousPlayback: boolean;
  /** 默认弹幕颜色 */
  color: string;
}

/** 将数值限制在 [min, max] 区间内，非法值返回 undefined */
function clampNumber(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

/** 校验弹幕上下边距（支持像素数字与百分比字符串） */
function normalizeMargin(
  value: unknown
): [number | string, number | string] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;

  const normalizeEdge = (edge: unknown): number | string | undefined => {
    if (typeof edge === 'number' && Number.isFinite(edge)) return edge;
    if (typeof edge === 'string' && /^\d+(\.\d+)?%$/.test(edge)) return edge;
    return undefined;
  };

  const top = normalizeEdge(value[0]);
  const bottom = normalizeEdge(value[1]);
  if (top === undefined || bottom === undefined) return undefined;

  return [top, bottom];
}

/**
 * 从（可能不完整或不可信的）弹幕配置对象中提取可持久化的设置字段。
 *
 * 同时用于写入前的字段提取与读取后的数据校验，避免脏数据注入播放器配置。
 */
export function pickDanmakuSettings(config: any): Partial<DanmakuSettings> {
  const result: Partial<DanmakuSettings> = {};
  if (!config || typeof config !== 'object') return result;

  if (typeof config.visible === 'boolean') result.visible = config.visible;

  const opacity = clampNumber(config.opacity, 0, 1);
  if (opacity !== undefined) result.opacity = opacity;

  const fontSize = clampNumber(config.fontSize, 12, 120);
  if (fontSize !== undefined) result.fontSize = fontSize;

  const speed = clampNumber(config.speed, 1, 10);
  if (speed !== undefined) result.speed = speed;

  const margin = normalizeMargin(config.margin);
  if (margin) result.margin = margin;

  const mode = clampNumber(config.mode, 0, 2);
  if (mode !== undefined) result.mode = Math.round(mode);

  if (Array.isArray(config.modes)) {
    const modes = config.modes.filter(
      (m: unknown): m is number =>
        typeof m === 'number' && Number.isFinite(m) && m >= 0 && m <= 2
    );
    result.modes = Array.from(new Set(modes));
  }

  if (typeof config.antiOverlap === 'boolean') {
    result.antiOverlap = config.antiOverlap;
  }

  if (typeof config.synchronousPlayback === 'boolean') {
    result.synchronousPlayback = config.synchronousPlayback;
  }

  if (typeof config.color === 'string' && config.color) {
    result.color = config.color;
  }

  return result;
}

/**
 * 读取本地保存的弹幕设置（含校验），无有效数据时返回空对象。
 */
export function loadDanmakuSettings(): Partial<DanmakuSettings> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(DANMAKU_SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    return pickDanmakuSettings(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * 将弹幕设置写入本地存储。
 *
 * 默认与已有设置合并，便于只更新部分字段；replace 为 true 时整体覆盖。
 */
export function saveDanmakuSettings(
  settings: Partial<DanmakuSettings>,
  options: { replace?: boolean } = {}
): void {
  if (typeof window === 'undefined') return;

  try {
    const merged = options.replace
      ? settings
      : { ...loadDanmakuSettings(), ...settings };
    window.localStorage.setItem(
      DANMAKU_SETTINGS_STORAGE_KEY,
      JSON.stringify(merged)
    );
  } catch {
    // localStorage 不可用（如隐私模式）时静默失败，不影响播放
  }
}

/**
 * 创建弹幕插件初始配置：默认配置叠加本地已保存的设置，刷新后可自动恢复。
 */
export function createDanmakuInitialConfig(): any {
  return {
    ...createDanmakuDefaultConfig(),
    ...loadDanmakuSettings(),
  };
}

// -----------------------------------------------------------------------------
// 弹幕插件（artplayer-plugin-danmuku）性能修复
// -----------------------------------------------------------------------------
//
// 背景：弹幕量大的剧集（例如单集 3 万条以上）在播放中调整「弹幕字号」会整页卡死。
//
// 根因（依据 artplayer-plugin-danmuku@5.2.0 源码）：
//   1) setState() 用 Array.prototype.filter 整体重建状态数组，每次调用开销为 O(该状态数组长度)：
//        setState(t, e) {
//          this.states[t.$state] = this.states[t.$state].filter(x => x !== t);
//          ...
//        }
//   2) reset() 对「整条队列」逐条调用 makeWait()，而 makeWait() 内部又调用 setState()：
//        reset() { this.queue.forEach(t => this.makeWait(t)); ... }
//      两者叠加，单次 reset 的复杂度为 O(n²)。
//   3) config() 中只有字号会触发 reset，其余设置不会：
//        config(t) { ... t.fontSize && this.reset() ... }
//      这正解释了为何只有「字号」卡死，而透明度／速度／显示区域都正常。
//
// 实测（Chromium，单集 37767 条弹幕）：
//   一次 config({ fontSize }) 原实现耗时 15~22 秒；而字号滑块会随指针移动连续触发 config，
//   于是主线程被长时间占满，表现为页面彻底卡死。
//   应用本补丁后：一次 config({ fontSize }) 约 1 毫秒；整集 load() 由 10.7 秒降至约 0.7 秒。
//
// 正确性：补丁仅改变「同一状态数组内元素顺序」这一无副作用细节
// （插件自身在 reset 时也会重排该数组），状态归属、DOM 节点、引用池回收均与原实现逐一比对一致。

/** 由安装的钩子捕获到的弹幕插件内部实例（真身） */
let capturedDanmukuInstance: any = null;

/** 捕获钩子是否已安装，避免重复包装 */
let danmukuCaptureHookInstalled = false;

/**
 * 安装「弹幕插件内部实例」捕获钩子。
 *
 * 插件对外只暴露一个门面对象，其 config / load / reset 都是
 * `内部实例.方法.bind(内部实例)`，无法通过门面拿到真身。但插件构造函数中存在：
 *
 *     this.validator = art.constructor.validator
 *
 * 且 config() / emit() 会以 `this.validator(...)` 形式调用它（此时 this 即内部实例）。
 * 因此把 Artplayer 类上的 validator 静态 getter 包一层，即可在首次调用时捕获真身，
 * 并立即为其打上性能补丁。
 *
 * 必须在 `new Artplayer(...)` 之前调用。若插件版本变化导致结构不符，会自动跳过，
 * 不影响播放功能。
 */
export function installDanmukuInstanceCaptureHook(Artplayer: any): void {
  if (danmukuCaptureHookInstalled || !Artplayer) return;

  const descriptor = Object.getOwnPropertyDescriptor(Artplayer, 'validator');
  if (!descriptor || typeof descriptor.get !== 'function') return;

  danmukuCaptureHookInstalled = true;

  Object.defineProperty(Artplayer, 'validator', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get(this: any) {
      const realValidator = descriptor.get!.call(this);
      if (typeof realValidator !== 'function') return realValidator;

      return function capturedValidator(this: any, ...args: any[]) {
        const receiver = this;
        if (
          receiver &&
          typeof receiver === 'object' &&
          Array.isArray(receiver.queue) &&
          receiver.states &&
          typeof receiver.makeWait === 'function'
        ) {
          // 记住最新实例（播放器重建时会构造新实例，这里始终指向当前这个）
          if (capturedDanmukuInstance !== receiver) {
            capturedDanmukuInstance = receiver;
          }
          // 捕获即打补丁：此时实例刚开始构造，任何昂贵调用都还没发生
          try {
            patchDanmukuPerformance(receiver);
          } catch (_) {
            // 补丁失败不应影响插件本身的正常工作
          }
        }
        return realValidator.apply(receiver, args);
      };
    },
  });
}

/** 取出已捕获的弹幕插件内部实例；未捕获到则返回 null */
export function getCapturedDanmukuInstance(): any {
  return capturedDanmukuInstance;
}

/**
 * 为弹幕插件内部实例打上性能补丁，消除大弹幕量下的 O(n²) 卡死。
 *
 * 幂等，可安全重复调用。
 *
 * @param instance 插件内部实例，由 getCapturedDanmukuInstance() 取得
 * @param facade   插件对外的门面对象（可选）
 * @param art      该门面所属的 Artplayer 实例（可选，用于校验门面与实例是否同一个播放器）
 * @returns 是否成功（或此前已经）打上补丁
 */
export function patchDanmukuPerformance(
  instance: any,
  facade?: any,
  art?: any
): boolean {
  if (
    !instance ||
    !Array.isArray(instance.queue) ||
    !instance.states ||
    typeof instance.makeWait !== 'function' ||
    typeof instance.setState !== 'function'
  ) {
    return false;
  }

  // ① setState：把 O(n) 的整体重建换成 indexOf + splice。
  //    同一条弹幕在同一状态数组内至多出现一次，因此两者结果完全一致，
  //    但省去了每次重建整个数组的开销。
  if (typeof (instance as any).__danmakuPatchedSetState !== 'function') {
    (instance as any).__danmakuPatchedSetState = function (
      this: any,
      danmu: any,
      nextState: string
    ) {
      const list = this.states[danmu.$state];
      if (list) {
        const index = list.indexOf(danmu);
        if (index !== -1) list.splice(index, 1);
      }
      danmu.$state = nextState;
      if (danmu.$ref) danmu.$ref.dataset.state = nextState;
      this.states[nextState].push(danmu);
    };
    instance.setState = (instance as any).__danmakuPatchedSetState;
  }

  // ② reset：保持原有语义，但跳过「本就在 wait 状态且没有 DOM 节点」的条目。
  //    这类条目再走一遍 makeWait 只是把它们在 states.wait 里挪个位置，
  //    既不会上屏也不产生任何可见变化，却贡献了 O(n²) 里的绝大部分耗时。
  if (typeof (instance as any).__danmakuPatchedReset !== 'function') {
    const rawMakeWait = instance.makeWait.bind(instance);
    (instance as any).__danmakuPatchedReset = function (this: any) {
      const queue = this.queue;
      for (let i = 0; i < queue.length; i++) {
        const danmu = queue[i];
        if (danmu.$state === 'wait' && !danmu.$ref) continue;
        rawMakeWait(danmu);
      }
      this.art.emit('artplayerPluginDanmuku:reset');
      return this;
    };
    instance.reset = (instance as any).__danmakuPatchedReset;
  }

  // ③ 门面对象里的 reset 在插件构造时就被 bind 到了旧实现，这里同步替换，
  //    避免任何直接调用门面 reset 的路径仍走旧实现（门面对象未被冻结）。
  //    先用 art 引用确认门面与实例同属一个播放器，避免误改到其它实例。
  const samePlayer = art ? instance.art === art : true;
  if (samePlayer && facade && typeof facade === 'object' && facade !== instance) {
    try {
      facade.reset = (instance as any).__danmakuPatchedReset.bind(instance);
    } catch (_) {
      // 门面不可写时忽略，不影响核心修复
    }
  }

  return true;
}

/**
 * 创建"去广告"自定义 HLS Loader。
 *
 * 在 manifest / level 请求成功后，对返回的 M3U8 内容执行广告过滤。
 * 仅在开启去广告功能时替换默认 Loader。
 */
export function createCustomHlsLoader(Hls: any): any {
  return class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      this.load = function (context: any, config: any, callbacks: any) {
        if (
          (context as any).type === 'manifest' ||
          (context as any).type === 'level'
        ) {
          const onSuccess = callbacks.onSuccess;
          callbacks.onSuccess = function (
            response: any,
            stats: any,
            context: any
          ) {
            if (response.data && typeof response.data === 'string') {
              response.data = filterAdsFromM3U8(response.data);
            }
            return onSuccess(response, stats, context, null);
          };
        }
        load(context, config, callbacks);
      };
    }
  };
}
