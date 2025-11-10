'use client';

import { useState } from 'react';

interface Book {
  title: string;
  author: string;
  confidence: string;
}

export default function VideoUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const extractFrames = async (videoFile: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.src = URL.createObjectURL(videoFile);
      
      video.onloadedmetadata = () => {
        const duration = video.duration;
        const frameCount = 20;
        const interval = duration / frameCount;
        const frames: string[] = [];
        let currentFrame = 0;

        const captureFrame = () => {
          if (currentFrame >= frameCount) {
            URL.revokeObjectURL(video.src);
            resolve(frames);
            return;
          }

          video.currentTime = currentFrame * interval;
        };

        video.onseeked = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
          frames.push(base64);
          
          currentFrame++;
          captureFrame();
        };

        captureFrame();
      };

      video.onerror = () => reject(new Error('Failed to load video'));
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setVideoStream(stream);
      setIsCameraActive(true);
      
      const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setError('Camera access denied. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setIsCameraActive(false);
    setIsRecording(false);
  };

  const startRecording = () => {
    if (!videoStream) return;

    const recorder = new MediaRecorder(videoStream, {
      mimeType: 'video/webm'
    });

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const file = new File([blob], 'bookshelf-scan.webm', { type: 'video/webm' });
      
      stopCamera();
      
      await processVideo(file);
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  };

  const processVideo = async (file: File) => {
    setIsProcessing(true);
    setError('');
    setBooks([]);

    const startTime = performance.now();

    try {
      setStage('Extracting frames from video...');
      const frameStart = performance.now();
      const frames = await extractFrames(file);
      const frameTime = ((performance.now() - frameStart) / 1000).toFixed(1);
      console.log(`✅ Extracted ${frames.length} frames in ${frameTime}s`);

      setStage('Reading text with Google Vision API...');
      const ocrStart = performance.now();
      const ocrResponse = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames }),
      });

      if (!ocrResponse.ok) {
        throw new Error('OCR failed');
      }

      const ocrData = await ocrResponse.json();
      const ocrTime = ((performance.now() - ocrStart) / 1000).toFixed(1);
      console.log(`✅ OCR complete in ${ocrTime}s (cost: £${ocrData.cost.toFixed(4)})`);

      setStage('Identifying books with Claude AI...');
      const claudeStart = performance.now();
      const analysisResponse = await fetch('/api/analyze-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrFrames: ocrData.frames }),
      });

      if (!analysisResponse.ok) {
        throw new Error('Book analysis failed');
      }

      const analysisData = await analysisResponse.json();
      const claudeTime = ((performance.now() - claudeStart) / 1000).toFixed(1);
      console.log(`✅ Claude analysis complete in ${claudeTime}s`);

      setBooks(analysisData.books);
      setStage('');

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`\n🎉 TOTAL TIME: ${totalTime}s`);
      console.log(`📊 Breakdown: Frames=${frameTime}s, OCR=${ocrTime}s, Claude=${claudeTime}s`);
      console.log(`📚 Books identified: ${analysisData.books.length} (${analysisData.high_confidence_count} high confidence, ${analysisData.needs_confirmation_count} needs review)\n`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      console.error(err);
      setStage('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processVideo(file);
  };

  const handleSaveBooks = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/save-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books }),
      });

      if (!response.ok) {
        throw new Error('Failed to save books');
      }

      const data = await response.json();
      console.log(`✅ Saved ${data.saved_count} books to database`);
      
      setSaveSuccess(true);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save books to database');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Scan Your Bookshelf</h2>
      
      {!isCameraActive && !isProcessing && (
        <div className="mb-4 flex gap-3">
          <button
            onClick={startCamera}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            📹 Open Camera
          </button>
        </div>
      )}

      {isCameraActive && (
        <div className="mb-4">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              id="camera-preview"
              autoPlay
              playsInline
              muted
              className="w-full"
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              {!isRecording ? (
                <>
                  <button
                    onClick={startRecording}
                    className="px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 font-medium text-lg"
                  >
                    ⏺ Start Recording
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 font-medium text-lg animate-pulse"
                >
                  ⏹ Stop Recording
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            📱 Slowly pan across your bookshelf from left to right
          </p>
        </div>
      )}

      {!isCameraActive && !isProcessing && (
        <div className="border-t pt-4">
          <p className="text-sm text-gray-600 mb-2">Or upload a video:</p>
          <input
            type="file"
            accept="video/*"
            onChange={handleUpload}
            disabled={isProcessing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
        </div>
      )}

      {isProcessing && (
        <div className="mt-4 p-4 bg-blue-50 rounded">
          <p className="text-blue-700 font-medium">{stage}</p>
          <p className="text-sm text-blue-600 mt-1">This may take 30-60 seconds...</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {books.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Identified Books ({books.length})</h3>
            <button
              onClick={handleSaveBooks}
              disabled={isSaving}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSaving ? 'Saving...' : 'Save All to My Listings'}
            </button>
          </div>
          
          {saveSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-medium">
                ✅ Saved {books.length} books to your listings!
              </p>
              <a 
                href="/" 
                className="text-green-700 underline hover:text-green-900 mt-2 inline-block"
              >
                View your listings →
              </a>
            </div>
          )}

          <div className="grid gap-3">
            {books.map((book, idx) => (
              <div
                key={idx}
                className={`p-4 rounded border-l-4 ${
                  book.confidence === 'high'
                    ? 'bg-green-50 border-green-500'
                    : book.confidence === 'medium'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-gray-50 border-gray-400'
                }`}
              >
                <p className="font-bold text-lg">{book.title}</p>
                <p className="text-gray-700">by {book.author}</p>
                <p className="text-sm text-gray-500 mt-1 capitalize">
                  Confidence: {book.confidence}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}