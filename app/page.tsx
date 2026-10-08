'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Recipe {
  id: string
  title: string
  category: string
  steps: string
  image_url?: string
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('主菜')
  const [steps, setSteps] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // 讀取菜單列表
  const fetchRecipes = async () => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('讀取失敗:', error)
    } else {
      setRecipes(data || [])
    }
  }

  useEffect(() => {
    fetchRecipes()
  }, [])

  // 圖片壓縮函數 (最長邊縮放至 1024px，品質 0.7)
  const compressImage = (file: File, maxWidth = 1024, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          let width = img.width
          let height = img.height

          // 計算等比例縮放後的尺寸
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width)
              width = maxWidth
            }
          } else {
            if (height > maxWidth) {
              width = Math.round((width * maxWidth) / height)
              height = maxWidth
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('無法創建 Canvas 上下文'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

          // 轉成壓縮後的 JPEG 檔 Blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('圖片壓縮失敗'))
              }
            },
            'image/jpeg',
            quality
          )
        }
        img.onerror = (err) => reject(err)
      }
      reader.onerror = (err) => reject(err)
    })
  }

  // 處理照片上傳至 Supabase Storage
  const uploadImage = async (file: File) => {
    try {
      // 上傳前先壓縮圖片
      const compressedBlob = await compressImage(file, 1024, 0.7)

      const fileName = `${Date.now()}.jpg`
      const filePath = `recipes/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('recipe-images')
        .upload(filePath, compressedBlob, {
          contentType: 'image/jpeg',
        })

      if (uploadError) {
        console.error('照片上傳失敗:', uploadError)
        return null
      }

      const { data } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (err) {
      console.error('圖片壓縮/上傳發生錯誤:', err)
      return null
    }
  }

  // 新增菜色
  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)

    let imageUrl = ''
    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile)
      if (uploadedUrl) imageUrl = uploadedUrl
    }

    const { error } = await supabase
      .from('recipes')
      .insert([{ title, category, steps, image_url: imageUrl }])

    if (error) {
      alert('新增失敗: ' + error.message)
    } else {
      setTitle('')
      setSteps('')
      setImageFile(null)
      fetchRecipes() // 更新列表
    }
    setLoading(false)
  }

  // 刪除菜色
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定要刪除「${title}」嗎？`)) return

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)

    if (error) {
      alert('刪除失敗: ' + error.message)
    } else {
      fetchRecipes()
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-900">🍳 家庭菜單庫</h1>

        {/* 新增菜單表單 */}
        <form onSubmit={handleAddRecipe} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-4">
          <h2 className="font-bold text-lg text-slate-800">新增菜色</h2>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">菜名</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：蔥爆牛肉"
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">分類</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="主菜">主菜</option>
              <option value="副菜">副菜</option>
              <option value="湯品">湯品</option>
              <option value="點心">點心</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">上傳照片（可選）</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">做法與備註</label>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="填寫作法或所需食材..."
              rows={3}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 active:scale-[0.99] transition disabled:opacity-50"
          >
            {loading ? '處理並上傳中...' : '新增至菜單'}
          </button>
        </form>

        {/* 菜單清單 */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-slate-900">現有菜色 ({recipes.length})</h2>
          {recipes.length === 0 ? (
            <p className="text-slate-500 text-center py-6 bg-white rounded-2xl border border-slate-200">
              目前還沒有菜色，快來新增第一道吧！
            </p>
          ) : (
            recipes.map((item) => (
              <div key={item.id} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-slate-900">{item.title}</h3>
                    <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                      {item.category}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id, item.title)}
                    className="text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition"
                  >
                    刪除
                  </button>
                </div>

                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-48 object-cover rounded-xl border border-slate-100"
                  />
                )}

                {item.steps && (
                  <p className="text-slate-600 text-sm whitespace-pre-line leading-relaxed pt-1 border-t border-slate-100">
                    {item.steps}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}