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
    // 自有修复：官方 api.bgm.tv 在国内访问不稳定，改用镜像 api.bangumi.vip
    const response = await fetch('https://api.bangumi.vip/calendar');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: BangumiCalendarData) => ({
      ...item,
      items: item.items.filter((bangumiItem) => bangumiItem.images),
    }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('获取 Bangumi 日历失败:', error);
    return [];
  }
}
