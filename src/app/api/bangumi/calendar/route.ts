import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'edge';

interface BangumiCalendarItem {
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
}

interface BangumiCalendarData {
  weekday: {
    en: string;
  };
  items: BangumiCalendarItem[];
}

function replaceImageUrl(
  data: BangumiCalendarData[],
  imageProxy: string
): BangumiCalendarData[] {
  if (!imageProxy) return data;
  return data.map((day) => ({
    ...day,
    items: (day.items || [])
      .filter((item) => item.images)
      .map((item) => {
        const replace = (url: string) =>
          url.replace('https://lain.bgm.tv', imageProxy);
        return {
          ...item,
          images: {
            large: replace(item.images.large),
            common: replace(item.images.common),
            medium: replace(item.images.medium),
            small: replace(item.images.small),
            grid: replace(item.images.grid),
          },
        };
      }),
  }));
}

export async function GET() {
  try {
    const config = await getConfig();
    const bangumiProxy =
      config.SiteConfig.BangumiProxy ||
      process.env.NEXT_PUBLIC_BANGUMI_PROXY ||
      '';
    const imageProxy =
      config.SiteConfig.BangumiImageProxy ||
      process.env.NEXT_PUBLIC_BANGUMI_IMAGE_PROXY ||
      '';

    // 自有修复：官方 api.bgm.tv 在国内访问不稳定，未配置代理时默认改用镜像 api.bangumi.vip，
    // 并保留官方源作为回退（可通过 SiteConfig.BangumiProxy 或 NEXT_PUBLIC_BANGUMI_PROXY 覆盖）。
    const baseUrl = bangumiProxy
      ? bangumiProxy.replace(/\/+$/, '')
      : 'https://api.bangumi.vip';

    const urls = bangumiProxy
      ? [`${baseUrl}/calendar`, 'https://api.bgm.tv/calendar']
      : ['https://api.bangumi.vip/calendar', 'https://api.bgm.tv/calendar'];

    let data: BangumiCalendarData[] = [];
    let lastError: unknown;

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        if (Array.isArray(json)) {
          data = json as BangumiCalendarData[];
          break;
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!data.length && lastError) {
      // eslint-disable-next-line no-console
      console.error('Bangumi 日历所有源均请求失败:', lastError);
    }

    const processed = replaceImageUrl(data, imageProxy.replace(/\/+$/, ''));

    return NextResponse.json(processed, {
      headers: {
        'Cache-Control': 'public, max-age=1800',
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Bangumi 日历接口异常:', error);
    return NextResponse.json([], { status: 200 });
  }
}
