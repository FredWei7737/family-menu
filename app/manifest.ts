import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: '家庭菜單 Family Menu',
        short_name: '家庭菜單', // 👈 手機桌面上顯示的短名稱（不被截斷）
        description: '專為家庭打造的菜單管理與配菜工具',
        start_url: '/',
        display: 'standalone', // 👈 設定為獨立 App 模式（點開不會有網址列）
        background_color: '#ffffff',
        theme_color: '#4f46e5',
        icons: [
            {
                src: '/icon.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/apple-touch-icon.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}