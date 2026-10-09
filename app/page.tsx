'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'
import { toPng } from 'html-to-image';

interface Recipe {
  id: string
  title: string
  category?: string
  tags?: string
  device?: string
  ingredients?: string
  steps?: string
  recipe_url?: string
  image_url?: string
  is_favorite?: boolean
}

export default function Home() {
  // 目前選中的分頁：'menu' (首頁選單) | 'add' (新增) | 'search' (搜尋) | 'manage' (管理)
  const [activeTab, setActiveTab] = useState<'menu' | 'add' | 'search' | 'manage'>('menu')

  // ---------- 新增菜色表單狀態 ----------
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('主菜')
  const [tags, setTags] = useState('')
  const [device, setDevice] = useState('IH爐')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [recipeUrl, setRecipeUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // ---------- 搜尋動態關鍵字狀態 ----------
  const [keywords, setKeywords] = useState<string[]>([''])
  const [searchResults, setSearchResults] = useState<Recipe[]>([])
  const [isSearched, setIsSearched] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // ---------- 菜單管理狀態 ----------
  const [manageRecipes, setManageRecipes] = useState<Recipe[]>([])
  const [manageCategory, setManageCategory] = useState<string>('全部')
  const [manageDevice, setManageDevice] = useState<string>('全部')
  const [manageSearchText, setManageSearchText] = useState<string>('')
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // ---------- 詳細卡片彈窗與分享 Ref ----------
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const modalContentRef = useRef<HTMLDivElement>(null)

  // 網址載入時檢查是否有指定菜色 ID (自動彈窗)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const recipeId = params.get('recipe')
    if (recipeId) {
      fetchRecipeById(recipeId)
    }
  }, [])
  // 💡 新增：監聽手機實體返回鍵 / iOS 手勢滑動
  useEffect(() => {
    const handlePopState = () => {
      // 當使用者按返回鍵或滑動返回時，如果 Modal 是打開的，就將它關閉
      setSelectedRecipe(null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // 💡 新增：開啟 Modal 函式（寫入 History 紀錄）
  const handleOpenModal = (recipe: Recipe) => {
    setSelectedRecipe(recipe)
    window.history.pushState({ modalOpen: true }, '')
  }

  // 💡 新增：關閉 Modal 函式（同步退回 History）
  const handleCloseModal = () => {
    if (selectedRecipe) {
      setSelectedRecipe(null)
      if (window.history.state?.modalOpen) {
        window.history.back()
      }
    }
  }

  // 當切換到「管理菜單」分頁時載入列表
  useEffect(() => {
    if (activeTab === 'manage') {
      fetchManageRecipes()
    }
  }, [activeTab])

  // 依據 ID 抓取單一菜色
  const fetchRecipeById = async (id: string) => {
    const { data, error } = await supabase.from('recipes').select('*').eq('id', id).single()
    if (data && !error) {
      setSelectedRecipe(data)
    }
  }

  // 載入管理菜單列表（好評優先, 建立時間倒序）
  const fetchManageRecipes = async () => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      setManageRecipes(data)
    }
  }

  // 圖片前端自動壓縮函數 (最長邊 1024px, JPEG 品質 0.7)
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
            reject(new Error('無法創建 Canvas'))
            return
          }

          ctx.drawImage(img, 0, 0, width, height)

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

  // 上傳圖片至 Supabase Storage
  const uploadImage = async (file: File) => {
    try {
      const compressedBlob = await compressImage(file, 1024, 0.7)
      const fileName = `${Date.now()}.jpg`
      const filePath = `recipes/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('recipe-images')
        .upload(filePath, compressedBlob, { contentType: 'image/jpeg' })

      if (uploadError) {
        console.error('照片上傳失敗:', uploadError)
        return null
      }

      const { data } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (err) {
      console.error('圖片壓縮或上傳錯誤:', err)
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

    const { error } = await supabase.from('recipes').insert([
      {
        title,
        category,
        tags,
        device,
        ingredients,
        steps,
        recipe_url: recipeUrl,
        image_url: imageUrl,
        is_favorite: false,
      },
    ])

    if (error) {
      alert('新增失敗: ' + error.message)
    } else {
      alert('🎉 成功新增菜色！')
      setTitle('')
      setTags('')
      setIngredients('')
      setSteps('')
      setRecipeUrl('')
      setImageFile(null)
      setActiveTab('menu')
    }
    setLoading(false)
  }

  // 切換好評（愛心）狀態
  const toggleFavorite = async (recipe: Recipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const newFavStatus = !recipe.is_favorite

    // 樂觀更新前端介面
    const updateFavState = (list: Recipe[]) =>
      list
        .map((item) => (item.id === recipe.id ? { ...item, is_favorite: newFavStatus } : item))
        .sort((a, b) => Number(b.is_favorite || 0) - Number(a.is_favorite || 0))

    setManageRecipes(updateFavState(manageRecipes))
    setSearchResults(updateFavState(searchResults))
    if (selectedRecipe?.id === recipe.id) {
      setSelectedRecipe({ ...selectedRecipe, is_favorite: newFavStatus })
    }

    const { error } = await supabase
      .from('recipes')
      .update({ is_favorite: newFavStatus })
      .eq('id', recipe.id)

    if (error) {
      alert('切換好評失敗: ' + error.message)
      // 若失敗復原
      fetchManageRecipes()
    }
  }

  // ---------- 搜尋邏輯（好評排序優先） ----------

  const handleKeywordChange = (index: number, value: string) => {
    const updated = [...keywords]
    updated[index] = value
    setKeywords(updated)
  }

  const addKeywordInput = () => {
    if (keywords.length >= 5) return
    setKeywords([...keywords, ''])
  }

  const removeKeywordInput = (index: number) => {
    if (keywords.length <= 1) return
    const updated = keywords.filter((_, i) => i !== index)
    setKeywords(updated)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchLoading(true)
    setIsSearched(true)

    const validKeywords = keywords.map((k) => k.trim()).filter(Boolean)

    let query = supabase.from('recipes').select('*')

    if (validKeywords.length > 0) {
      validKeywords.forEach((kw) => {
        const term = `%${kw}%`
        // 💡 字串欄位用 .ilike.${term}
        query = query.or(
          `title.ilike.${term},category.ilike.${term},device.ilike.${term},steps.ilike.${term},ingredients.ilike.{${kw}},tags.ilike.{${kw}}`
        )
      })
    }

    // 優先依照 好評 (is_favorite = true) 排序，再按時間排序
    const { data, error } = await query
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('搜尋失敗:', error)
      alert('搜尋失敗: ' + error.message)
    } else {
      setSearchResults(data || [])
    }
    setSearchLoading(false)
  }

  // ---------- 菜單管理：編輯與刪除 ----------

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRecipe) return
    setEditLoading(true)

    let imageUrl = editingRecipe.image_url
    if (editImageFile) {
      const uploadedUrl = await uploadImage(editImageFile)
      if (uploadedUrl) imageUrl = uploadedUrl
    }

    const { error } = await supabase
      .from('recipes')
      .update({
        title: editingRecipe.title,
        category: editingRecipe.category,
        device: editingRecipe.device,
        tags: editingRecipe.tags,
        ingredients: editingRecipe.ingredients,
        steps: editingRecipe.steps,
        recipe_url: editingRecipe.recipe_url,
        image_url: imageUrl,
      })
      .eq('id', editingRecipe.id)

    if (error) {
      alert('更新失敗: ' + error.message)
    } else {
      alert('修改成功！')
      setEditingRecipe(null)
      setEditImageFile(null)
      fetchManageRecipes()
    }
    setEditLoading(false)
  }

  const handleDeleteRecipe = async (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`確定要刪除菜色「${recipe.title}」嗎？刪除後無法復原。`)) return

    // 如果有圖片，嘗試刪除 Supabase Storage 照片
    if (recipe.image_url) {
      try {
        const urlParts = recipe.image_url.split('/')
        const fileName = urlParts[urlParts.length - 1]
        await supabase.storage.from('recipe-images').remove([`recipes/${fileName}`])
      } catch (err) {
        console.error('刪除照片失敗:', err)
      }
    }

    const { error } = await supabase.from('recipes').delete().eq('id', recipe.id)

    if (error) {
      alert('刪除失敗: ' + error.message)
    } else {
      setManageRecipes(manageRecipes.filter((item) => item.id !== recipe.id))
    }
  }

  // 過濾管理頁面的菜色列表
  const filteredManageRecipes = manageRecipes.filter((item) => {
    const matchCategory = manageCategory === '全部' || item.category === manageCategory
    const matchDevice = manageDevice === '全部' || item.device === manageDevice
    const matchSearch =
      !manageSearchText.trim() ||
      item.title.toLowerCase().includes(manageSearchText.toLowerCase()) ||
      item.tags?.toLowerCase().includes(manageSearchText.toLowerCase())
    return matchCategory && matchDevice && matchSearch
  })

  // ---------- 分享功能 ----------

  const handleShareUrl = async () => {
    if (!selectedRecipe) return
    const shareUrl = `${window.location.origin}${window.location.pathname}?recipe=${selectedRecipe.id}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedRecipe.title,
          text: `看看這道美味菜色：${selectedRecipe.title}`,
          url: shareUrl,
        })
      } catch (err) {
        console.log('取消分享:', err)
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      alert('已複製菜單連結到剪貼簿！')
    }
  }

  const handleShareImage = async () => {
    if (!modalContentRef.current || !selectedRecipe) return;
    setIsCapturing(true);

    try {
      // 1. 稍微延遲，確保圖片和 DOM 渲染穩定 (html-to-image 內建圖片載入處理，所以這裡只需短暫延遲)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 2. 使用 html-to-image 生成 PNG (對 Modern CSS 支援度極高)
      // 我們生成 2 倍解析度，確保分享出去不模糊
      const dataUrl = await toPng(modalContentRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff', // 強制白色背景，避免截出透明圖
        // 若 Modal 有捲軸，強制設定為完整的滾動高度
        width: modalContentRef.current.scrollWidth,
        height: modalContentRef.current.scrollHeight,
        style: {
          // 修正 html-to-image 偶爾在 flex 佈局上的偏差
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });

      // 3. 嘗試使用原生分享 API (手機端優先)
      if (navigator.share && navigator.canShare) {
        try {
          // 將 Data URL 轉為 Blob
          const response = await fetch(dataUrl);
          const blob = await response.blob();

          // 封裝成檔案
          const file = new File([blob], `${selectedRecipe.title}.png`, { type: 'image/png' });

          // 檢查是否可以分享檔案 (localhost 通常不行，手機版通常可以)
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: selectedRecipe.title,
              text: `跟你分享美味食譜：${selectedRecipe.title}`,
            });
            // 分享成功後離開
            setIsCapturing(false);
            return;
          }
        } catch (shareError) {
          console.log('不支援原生分享或使用者取消:', shareError);
          // 如果分享失敗，將自動降級到下面的「直接下載」流程
        }
      }

      // 4. 降級方案：直接下載圖片 (Localhost 或不支援分享的電腦瀏覽器)
      const link = document.createElement('a');
      link.download = `${selectedRecipe.title}.png`;
      link.href = dataUrl;
      link.click();

    } catch (err) {
      console.error('生成圖片失敗:', err);
      alert('生成圖片時發生錯誤。這通常是因為使用了較新的 CSS 顏色格式 (如 lab/oklch)，已嘗試修復。');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 p-4 sm:p-6">
      <div className="max-w-md mx-auto">
        {/* 頁頭 */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            🍳 家庭菜單庫
          </h1>
          {activeTab !== 'menu' && (
            <button
              onClick={() => setActiveTab('menu')}
              className="text-sm font-semibold bg-white border border-slate-300 px-3 py-1.5 rounded-xl shadow-sm hover:bg-slate-50"
            >
              ← 回主選單
            </button>
          )}
        </header>

        {/* 1. 主功能選單 (2x2 方塊導覽) */}
        {activeTab === 'menu' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setActiveTab('add')}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition min-h-[140px]"
            >
              <span className="text-4xl">➕</span>
              <span className="font-bold text-lg text-slate-800">新增菜色</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition min-h-[140px]"
            >
              <span className="text-4xl">🔍</span>
              <span className="font-bold text-lg text-slate-800">搜尋菜單</span>
            </button>

            <button
              onClick={() => setActiveTab('manage')}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-3 active:scale-95 transition min-h-[140px]"
            >
              <span className="text-4xl">📖</span>
              <span className="font-bold text-lg text-slate-800">菜單管理</span>
            </button>

            <div className="bg-slate-200/60 border-2 border-dashed border-slate-300 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 min-h-[140px]">
              <span className="text-3xl opacity-50">💡</span>
              <span className="font-bold text-sm text-slate-500">待開發區</span>
              <span className="text-xs text-slate-400">（預留位置）</span>
            </div>
          </div>
        )}

        {/* 2. 新增菜色頁面 */}
        {activeTab === 'add' && (
          <form
            onSubmit={handleAddRecipe}
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4"
          >
            <h2 className="font-bold text-xl text-slate-900 border-b border-slate-100 pb-3">
              ➕ 新增菜色
            </h2>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">
                菜名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：番茄炒蛋、氣炸牛肉粒"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">分類</label>
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
                <label className="block text-sm font-semibold mb-1 text-slate-700">主要設備</label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="IH爐">IH爐</option>
                  <option value="氣炸鍋">氣炸鍋</option>
                  <option value="微波爐">微波爐</option>
                  <option value="電鍋">電鍋</option>
                  <option value="烤箱">烤箱</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">標籤</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如：牛肉, 快手菜, 小朋友愛吃"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">成品照片</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">參考網址 (食譜/影片連結)</label>
              <input
                type="url"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">食材與份量</label>
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="例如：牛肉 300g, 蔥 2支, 醬油 1大匙"
                rows={2}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">料理步驟</label>
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="填寫料理作法細節..."
                rows={3}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 active:scale-[0.99] transition disabled:opacity-50 mt-2"
            >
              {loading ? '處理中...' : '儲存至菜單'}
            </button>
          </form>
        )}

        {/* 3. 動態關鍵字搜尋頁面 */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <form onSubmit={handleSearch} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-bold text-xl text-slate-900">🔍 搜尋菜單</h2>
                <span className="text-xs font-semibold text-slate-400">最多可設定 5 個條件</span>
              </div>

              {/* 動態關鍵字輸入欄位 */}
              <div className="space-y-3">
                {keywords.map((kw, index) => {
                  const isLast = index === keywords.length - 1
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={kw}
                          onChange={(e) => handleKeywordChange(index, e.target.value)}
                          placeholder={`關鍵字 ${index + 1} (例如：牛肉、氣炸鍋)`}
                          className="flex-1 p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        {keywords.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeKeywordInput(index)}
                            className="p-2.5 text-slate-400 hover:text-red-500 rounded-xl border border-slate-200 hover:bg-red-50 transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {isLast && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={searchLoading}
                            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 active:scale-[0.99] transition text-sm disabled:opacity-50"
                          >
                            {searchLoading ? '搜尋中...' : '尋找菜單'}
                          </button>

                          {keywords.length < 5 && (
                            <button
                              type="button"
                              onClick={addKeywordInput}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2.5 rounded-xl font-semibold text-sm transition shrink-0"
                            >
                              ＋ 新增關鍵字
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </form>

            {/* 精簡版搜尋結果列表 (好評菜色排前面) */}
            {isSearched && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-bold text-slate-800 text-sm">
                    搜尋結果 ({searchResults.length})
                  </h3>
                  <span className="text-xs text-rose-500 font-semibold">❤️ 好評菜色優先推薦</span>
                </div>

                {searchResults.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                    沒有找到符合條件的菜色 🍲
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleOpenModal(item)}
                        className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-3 cursor-pointer hover:border-blue-300 active:scale-[0.99] transition relative"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            {/* 好評愛心按鈕 */}
                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(item, e)}
                              className="text-lg hover:scale-110 transition shrink-0"
                              title="好評標記"
                            >
                              {item.is_favorite ? '❤️' : '🤍'}
                            </button>
                            <h4 className="font-bold text-slate-900 truncate text-base">
                              {item.title}
                            </h4>
                          </div>
                          {item.device && (
                            <span className="inline-block text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-md ml-6">
                              {item.device}
                            </span>
                          )}
                        </div>

                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            crossOrigin="anonymous" // 👈 關鍵：必須加上這行，html2canvas 才能讀取外連圖片
                            loading="lazy"
                            className="w-16 h-16 object-cover rounded-xl border border-slate-100 shrink-0"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. 菜單管理頁面 (分類、搜尋、列表、編輯、刪除) */}
        {activeTab === 'manage' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
              <h2 className="font-bold text-lg text-slate-900">📖 菜單管理</h2>

              {/* 搜尋框 */}
              <input
                type="text"
                value={manageSearchText}
                onChange={(e) => setManageSearchText(e.target.value)}
                placeholder="搜尋管理庫內的菜名或標籤..."
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* 第一層：主要分類膠囊切換 */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                {['全部', '主菜', '副菜', '湯品', '點心'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setManageCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${manageCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* 第二層：設備過濾 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold shrink-0">設備：</span>
                <select
                  value={manageDevice}
                  onChange={(e) => setManageDevice(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 text-xs font-semibold focus:outline-none"
                >
                  <option value="全部">全部設備</option>
                  <option value="IH爐">IH爐</option>
                  <option value="氣炸鍋">氣炸鍋</option>
                  <option value="微波爐">微波爐</option>
                  <option value="電鍋">電鍋</option>
                  <option value="烤箱">烤箱</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>

            {/* 菜色清單 */}
            <div className="space-y-2.5">
              {filteredManageRecipes.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                  沒有找到符合條件的菜色
                </div>
              ) : (
                filteredManageRecipes.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenModal(item)}
                    className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-3 cursor-pointer hover:border-blue-300 transition"
                  >
                    {/* 左側資訊 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(item, e)}
                          className="text-lg hover:scale-110 transition shrink-0"
                          title="好評標記"
                        >
                          {item.is_favorite ? '❤️' : '🤍'}
                        </button>
                        <h4 className="font-bold text-slate-900 truncate text-base">
                          {item.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 ml-6">
                        {item.category && (
                          <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        )}
                        {item.device && (
                          <span className="text-[10px] font-semibold bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">
                            {item.device}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 💡 料理縮圖（有圖片顯示縮圖，無圖片顯示預設圖示） */}
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        crossOrigin="anonymous"
                        loading="lazy"
                        className="w-12 h-12 object-cover rounded-xl border border-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100 shrink-0 flex items-center justify-center text-lg">
                        🍳
                      </div>
                    )}

                    {/* 右側操作：編輯與刪除按鈕 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingRecipe(item)
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200"
                      >
                        ✏️ 編輯
                      </button>
                      <button
                        onClick={(e) => handleDeleteRecipe(item, e)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. 菜色詳細內容彈窗 (Modal) */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0" onClick={handleCloseModal}></div>

          <div className="relative bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
            <div ref={modalContentRef} className="p-6 overflow-y-auto space-y-4 bg-white">
              {selectedRecipe.image_url && (
                <div className="-mx-6 -mt-6 mb-4">
                  <img
                    src={selectedRecipe.image_url}
                    alt={selectedRecipe.title}
                    crossOrigin="anonymous" // 👈 關鍵：必須加上這行，html2canvas 才能讀取外連圖片
                    className="w-full h-56 object-cover"
                  />
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(selectedRecipe)}
                    className="text-2xl hover:scale-110 transition"
                  >
                    {selectedRecipe.is_favorite ? '❤️' : '🤍'}
                  </button>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {selectedRecipe.title}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100 hover:bg-slate-200 transition"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {selectedRecipe.category && (
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
                    {selectedRecipe.category}
                  </span>
                )}
                {selectedRecipe.device && (
                  <span className="text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-lg">
                    {selectedRecipe.device}
                  </span>
                )}
                {selectedRecipe.tags &&
                  selectedRecipe.tags.split(',').map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg"
                    >
                      #{tag.trim()}
                    </span>
                  ))}
              </div>

              {selectedRecipe.ingredients && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    🥗 食材與份量
                  </h4>
                  <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                    {selectedRecipe.ingredients}
                  </p>
                </div>
              )}

              {selectedRecipe.steps && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    🍳 料理步驟
                  </h4>
                  <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                    {selectedRecipe.steps}
                  </p>
                </div>
              )}

              {selectedRecipe.recipe_url && (
                <div className="pt-2">
                  <a
                    href={selectedRecipe.recipe_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
                  >
                    🔗 查看外部食譜/教學影片 →
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
              <button
                onClick={handleShareUrl}
                className="flex-1 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-100 transition flex items-center justify-center gap-1.5"
              >
                🔗 分享網址
              </button>
              <button
                onClick={handleShareImage}
                disabled={isCapturing}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                🖼️ {isCapturing ? '生成圖片中...' : '分享圖片'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 編輯菜色彈窗 (Modal) */}
      {editingRecipe && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0" onClick={() => setEditingRecipe(null)}></div>

          <form
            onSubmit={handleSaveEdit}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-xl p-5 z-10 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-xl text-slate-900">✏️ 編輯菜色</h3>
              <button
                type="button"
                onClick={() => setEditingRecipe(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full bg-slate-100 hover:bg-slate-200 transition"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">菜名</label>
              <input
                type="text"
                value={editingRecipe.title}
                onChange={(e) => setEditingRecipe({ ...editingRecipe, title: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">分類</label>
                <select
                  value={editingRecipe.category || '主菜'}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, category: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm"
                >
                  <option value="主菜">主菜</option>
                  <option value="副菜">副菜</option>
                  <option value="湯品">湯品</option>
                  <option value="點心">點心</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">主要設備</label>
                <select
                  value={editingRecipe.device || 'IH爐'}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, device: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm"
                >
                  <option value="IH爐">IH爐</option>
                  <option value="氣炸鍋">氣炸鍋</option>
                  <option value="微波爐">微波爐</option>
                  <option value="電鍋">電鍋</option>
                  <option value="烤箱">烤箱</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">標籤</label>
              <input
                type="text"
                value={editingRecipe.tags || ''}
                onChange={(e) => setEditingRecipe({ ...editingRecipe, tags: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">
                更新照片 (若不選擇則維持原圖)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">食材與份量</label>
              <textarea
                value={editingRecipe.ingredients || ''}
                onChange={(e) => setEditingRecipe({ ...editingRecipe, ingredients: e.target.value })}
                rows={2}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">料理步驟</label>
              <textarea
                value={editingRecipe.steps || ''}
                onChange={(e) => setEditingRecipe({ ...editingRecipe, steps: e.target.value })}
                rows={3}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={editLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 mt-2"
            >
              {editLoading ? '儲存中...' : '確認修改'}
            </button>
          </form>
        </div>
      )}
    </main>
  )
}