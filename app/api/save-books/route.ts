import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Hardcoded test user - will be replaced with real auth
const TEST_USER_ID = '24e38981-b0ab-4209-977e-acecd6f647ed';

export async function POST(request: Request) {
  try {
    const { books } = await request.json();

    if (!books || books.length === 0) {
      return NextResponse.json(
        { error: 'No books provided' },
        { status: 400 }
      );
    }

    console.log(`Saving ${books.length} books to database...`);

    // Format books for Supabase with user_id
    const bookRecords = books.map((book: any) => ({
      title: book.title,
      author: book.author,
      price: 0, // Will be updated when pricing is added
      user_id: TEST_USER_ID, // TODO: Replace with real auth session.user.id
    }));

    // Insert all books
    const { data, error } = await supabase
      .from('listings')
      .insert(bookRecords)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save books to database' },
        { status: 500 }
      );
    }

    console.log(`✅ Saved ${data.length} books to database`);

    return NextResponse.json({
      success: true,
      saved_count: data.length,
      books: data,
    });

  } catch (error) {
    console.error('Save books error:', error);
    return NextResponse.json(
      { error: 'Failed to save books' },
      { status: 500 }
    );
  }
}