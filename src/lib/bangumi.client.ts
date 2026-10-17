'use client';
export interface BangumiCalendarData {
  weekday: {
    en: string;
  };
  items: {
    id: number;
    name: string;
    name_cn: string;
    rating: {
      score: number;
    };
    air_date: string;
    images: {
      large: string;
      common: string;
      medium: string;
      small: string;
      grid: string;
    };
  }[];
}

export async function GetBangumiCalendarData(): Promise<BangumiCalendarData[]> {
  try {
    // 改走站内 API 路由（src/app/api/bangumi/calendar/route.ts，edge 运行时）：
    // 该路由默认使用国内镜像 api.bangumi.vip、失败回退官方 api.bgm.tv，
    // 并顺带处理图片代理与 30 分钟缓存；镜像地址可用 SiteConfig.BangumiProxy 覆盖。
    const response = await fetch('/api/bangumi/calendar', {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data as BangumiCalendarData[];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Bangumi 日历请求失败:', error);
    return [];
  }
}
