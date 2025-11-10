import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { getBookIdentificationPrompt } from '@/app/prompts/book-identification';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { ocrFrames } = await request.json();

    if (!ocrFrames || ocrFrames.length === 0) {
      return NextResponse.json(
        { error: 'No OCR data provided' },
        { status: 400 }
      );
    }

    console.log(`Analyzing ${ocrFrames.length} frames with Claude...`);

    // Format OCR data for Claude
    const ocrText = ocrFrames
      .map((frame: any) => `=== FRAME ${frame.frame_number} ===\n${frame.text}`)
      .join('\n\n');

    // Get the prompt from the dedicated file
    const prompt = getBookIdentificationPrompt(ocrText);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    console.log('Claude raw response:', responseText);

    // Parse Claude's JSON response - strip markdown aggressively
let result;
try {
  // Remove markdown code blocks and any surrounding whitespace
  let cleanedText = responseText.trim();
  
  // Remove opening markdown (handles ```json or just ```)
  cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
  
  // Remove closing markdown
  cleanedText = cleanedText.replace(/\n?\s*```\s*$/i, '');
  
  // Final trim
  cleanedText = cleanedText.trim();
  
  console.log('Cleaned JSON (first 200 chars):', cleanedText.substring(0, 200));
  
  result = JSON.parse(cleanedText);
} catch (parseError) {
  console.error('Failed to parse Claude response as JSON:', responseText);
  return NextResponse.json(
    { error: 'Claude returned invalid JSON' },
    { status: 500 }
  );
}

    // Flatten both arrays into one for now (we'll build the UI for needs_confirmation later)
    const allBooks = [
      ...(result.high_confidence || []),
      ...(result.needs_confirmation?.map((book: any) => ({
        title: book.suggested_title,
        author: book.suggested_author,
        confidence: 'medium',
        evidence: book.reasoning
      })) || [])
    ];

    console.log(`Identified ${allBooks.length} books`);

    return NextResponse.json({
      books: allBooks,
      total_identified: allBooks.length,
      high_confidence_count: result.high_confidence?.length || 0,
      needs_confirmation_count: result.needs_confirmation?.length || 0,
    });

  } catch (error) {
    console.error('Book analysis error:', error);
    return NextResponse.json(
      { error: 'Book analysis failed' },
      { status: 500 }
    );
  }
}