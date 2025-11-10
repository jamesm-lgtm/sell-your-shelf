'use client'
import VideoUpload from './components/VideoUpload';
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function Home() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBooks() {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error:', error)
      } else {
        setBooks(data)
      }
      setLoading(false)
    }

    fetchBooks()
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          My Book Marketplace
        </h1>
        <VideoUpload />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {books.map((book) => (
            <div key={book.id} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-2">{book.title}</h2>
              <p className="text-gray-600 mb-4">{book.author}</p>
              <p className="text-2xl font-bold text-green-600">
                £{book.price}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}