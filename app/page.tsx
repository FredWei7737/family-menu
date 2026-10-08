'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Recipe {
  id: string
  title: string
  category: string
  steps: string
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('主菜')
  const [steps, setSteps] = useState('')
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

  // 新增菜色
  const handleAddRecipe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    const { error } = await supabase
      .from('recipes')
      .insert([{ title, category, steps }])

    if (error) {
      alert('新增失敗: ' + error.message)
    } else {
      setTitle('')
      setSteps('')
      fetchRecipes() // 更新列表
    }
    setLoading(false)
  }

  return (
    <main className="max-w-2xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-center mb-6">🍳 家庭菜單庫</h1>

      {/* 新增菜單表單 */}
      <form onSubmit={handleAddRecipe} className="bg-slate-50 p-4 rounded-xl border mb-8 space-y-4">
        <h2 className="font-semibold text-lg">新增菜色</h2>
        <div>
          <label className="block text-sm font-medium mb-1">菜名</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：蔥爆牛肉"
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">分類</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white"
          >
            <option value="主菜">主菜</option>
            <option value="副菜">副菜</option>
            <option value="湯品">湯品</option>
            <option value="點心">點心</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">做法與備註</label>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="填寫作法或所需食材..."
            rows={3}
            className="w-full p-2 border rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '儲存中...' : '新增至菜單'}
        </button>
      </form>

      {/* 菜單清單 */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">現有菜色 ({recipes.length})</h2>
        {recipes.length === 0 ? (
          <p className="text-gray-500 text-center py-4">目前還沒有菜色，快來新增第一道吧！</p>
        ) : (
          recipes.map((item) => (
            <div key={item.id} className="p-4 border rounded-xl bg-white shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">{item.title}</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {item.category}
                </span>
              </div>
              {item.steps && <p className="text-gray-600 text-sm whitespace-pre-line">{item.steps}</p>}
            </div>
          ))
        )}
      </div>
    </main>
  )
}