import { NextResponse } from 'next/server';

const VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;

export async function POST(request: Request) {
  try {
    const { frames } = await request.json();

    if (!frames || frames.length === 0) {
      return NextResponse.json(
        { error: 'No frames provided' },
        { status: 400 }
      );
    }

    console.log(`Processing ${frames.length} frames...`);
    
    const frameResults = [];

    for (let i = 0; i < frames.length; i++) {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: frames[i] },
              features: [{ type: 'TEXT_DETECTION' }]
            }]
          })
        }
      );

        const data = await response.json();
        console.log('Vision API response:', JSON.stringify(data, null, 2));
        console.log('Response status:', response.status);
        const text = data.responses[0]?.textAnnotations?.[0]?.description || '[NO TEXT DETECTED]';

      frameResults.push({
        frame_number: i,
        text: text
      });

      console.log(`Processed frame ${i + 1}/${frames.length}`);
    }

    const costGBP = frames.length * 0.00118;

    return NextResponse.json({
      frames: frameResults,
      cost: costGBP,
      frame_count: frames.length
    });

  } catch (error) {
    console.error('OCR error:', error);
    return NextResponse.json(
      { error: 'OCR processing failed' },
      { status: 500 }
    );
  }
}