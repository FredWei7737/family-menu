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
            {loading ? '儲存中...' : '新增至菜單'}
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
              <div key={item.id} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-slate-900">{item.title}</h3>
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                    {item.category}
                  </span>
                </div>
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